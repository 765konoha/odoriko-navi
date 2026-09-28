-- =========================================================
-- シリアルの表記ゆれ(全角・半角)をそろえる
--
-- 同じ「K-015」が全角の「Ｋ－０１５」でも登録されていて、別人として
-- 扱われていた。アプリ側は取り込み・登録の入口で表記をそろえるように
-- した(supabase/functions/_shared/serial.ts)。ここでは同じ規則の
-- normalize_serial() を用意し、既に入っている全角のシリアルを直す
-- normalize_participant_serials() を用意する。
--
-- このファイルを流しただけでは、データは変わらない。
-- SQL Editor で次の順に実行する。
--   1. select * from normalize_participant_serials();      -- 確認だけ
--   2. select * from normalize_participant_serials(true);  -- 反映
-- 何度実行しても、直すものが無くなれば何もしない。
-- =========================================================

-- 規則は _shared/serial.ts の normalizeSerial() と同じ。変えるときは両方を合わせる。
--   - 全角の英数字・記号(！〜～)と全角スペースを半角にする
--   - 英数字にはさまれた長音符・ダッシュをハイフンにする
--   - 前後の空白を除く
-- 日本語(「カメラマン」など)には触れない。大文字・小文字も変えない。
create or replace function normalize_serial(p text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    regexp_replace(
      translate(
        p,
        '！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～　',
        '!"#$%&''()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~ '
      ),
      '(?<=[A-Za-z0-9])[ー‐‑–—−ｰ](?=[A-Za-z0-9])', '-', 'g'
    ),
    '^\s+|\s+$', '', 'g'
  )
$$;

comment on function normalize_serial(text) is
  'シリアルの表記をそろえる(全角英数記号→半角)。_shared/serial.ts と同じ規則';

-- 全角のシリアルを半角にそろえる。p_apply = false(既定)なら確認だけ。
--
-- シリアルは participants の主キーで、8つの表から参照されている
-- (どれも ON UPDATE CASCADE ではない)。そのため新しい表記をマスターに
-- 足し、参照している行をすべて付け替えてから、古い表記を消す。
--
-- 同じ祭りに両方の表記で登録されている(同じ人が2人いる)ときは、
-- 半角の方を残し、全角の方の設定をそこへまとめてから全角の方を消す。
--   - 役職 … 両方の役職を合わせる
--   - 個人宛てのお知らせ … 両方の宛先を合わせる
--   - 荷物グループ … 半角の方が未配属なら、全角の方のグループを引き継ぐ
--   - 荷物リーダー … 全角の方がリーダーなら、半角の方をリーダーにする
--   - 名前・ニックネーム … 半角の方を残す(違えば結果に出す)
--
-- 次の場合はまとめずに「要対応」として返す(どちらを残すかは人が決める)。
--   - 両方が別々の荷物グループに入っている
--   - 両方が別々の荷物グループのリーダーになっている
--   - 両方の表記の間で小道具の受け渡しの記録がある(付け替えると自分から自分への
--     受け渡しになり、制約に反する。取り消し済みの記録も行としては残るので同じ)
--
-- 利用状況(serial_access)と出欠(rehearsal_attendances)は、両方の表記に
-- 行があれば新しい表記の方を残す。出欠はシートから取り込み直せる。
create or replace function normalize_participant_serials(p_apply boolean default false)
returns table (old_serial text, new_serial text, result text)
language plpgsql
as $$
declare
  r record;
  m record;
  blocked text;
  notes text[];
  add_roles int;
  add_ann int;
begin
  for r in
    select p.serial as old, normalize_serial(p.serial) as new
    from participants p
    where p.serial <> normalize_serial(p.serial)
    order by p.serial
  loop
    old_serial := r.old;
    new_serial := r.new;
    blocked := null;
    notes := array[]::text[];

    -- 同じ祭りに両方の表記がいる組を調べる(src=全角 / dst=半角)
    for m in
      select f.name as festival,
             a.id as src, a.name as src_name, a.nickname as src_nick,
             a.baggage_group_id as src_bg,
             b.id as dst, b.name as dst_name, b.nickname as dst_nick,
             b.baggage_group_id as dst_bg,
             (select g.id from baggage_groups g
               where g.leader_participant_id = a.id limit 1) as src_leads,
             (select g.id from baggage_groups g
               where g.leader_participant_id = b.id limit 1) as dst_leads
      from festival_participants a
      join festival_participants b
        on b.festival_id = a.festival_id and b.serial = r.new
      join festivals f on f.id = a.festival_id
      where a.serial = r.old
      order by f.name
    loop
      if m.src_bg is not null and m.dst_bg is not null and m.src_bg <> m.dst_bg then
        blocked := '「' || m.festival || '」で ' || r.old || ' と ' || r.new
          || ' が別々の荷物グループに入っています。参加者管理でどちらかに合わせてから、もう一度実行してください';
        exit;
      end if;
      if m.src_leads is not null and m.dst_leads is not null
         and m.src_leads <> m.dst_leads then
        blocked := '「' || m.festival || '」で ' || r.old || ' と ' || r.new
          || ' が別々の荷物グループのリーダーです。荷物グループの画面でどちらかを外してから、もう一度実行してください';
        exit;
      end if;

      select count(*) into add_roles
        from festival_participant_roles x
       where x.festival_participant_id = m.src
         and not exists (
           select 1 from festival_participant_roles y
            where y.festival_participant_id = m.dst and y.role_id = x.role_id);
      select count(*) into add_ann
        from announcement_participants x
       where x.festival_participant_id = m.src
         and not exists (
           select 1 from announcement_participants y
            where y.festival_participant_id = m.dst
              and y.announcement_id = x.announcement_id);

      notes := notes || (
        '「' || m.festival || '」で2人を1人にまとめます(役職 +' || add_roles
        || '・個人宛てのお知らせ +' || add_ann
        || case when m.dst_bg is null and m.src_bg is not null
                then '・荷物グループを引き継ぐ' else '' end
        || case when m.src_leads is not null and m.dst_leads is null
                then '・荷物リーダーを引き継ぐ' else '' end
        || ')'
        || case when (m.src_name, m.src_nick) is distinct from (m.dst_name, m.dst_nick)
                then '。名前は ' || m.dst_name || '/' || m.dst_nick || ' を残します('
                     || r.old || ' 側: ' || m.src_name || '/' || m.src_nick || ')'
                else '' end
      );
    end loop;

    if blocked is null and exists (
      select 1 from prop_transfers t
      where (t.from_serial = r.old and t.to_serial = r.new)
         or (t.from_serial = r.new and t.to_serial = r.old)
    ) then
      blocked := r.old || ' と ' || r.new
        || ' の間に小道具の受け渡し記録があるため、自動では付け替えません(記録の扱いを決める必要があります)';
    end if;

    -- 要対応なら、この人には何も書き込まない(調べ終わるまで書き込んでいない)
    if blocked is not null then
      result := '要対応: ' || blocked;
      return next;
      continue;
    end if;

    if not p_apply then
      result := case when cardinality(notes) = 0 then '変更予定'
                     else '変更予定: ' || array_to_string(notes, ' / ') end;
      return next;
      continue;
    end if;

    -- 同じ祭りに2人いる組を1人にまとめる(全角の方の設定を半角の方へ写してから消す)
    for m in
      select a.id as src, a.baggage_group_id as src_bg,
             b.id as dst, b.baggage_group_id as dst_bg
      from festival_participants a
      join festival_participants b
        on b.festival_id = a.festival_id and b.serial = r.new
      where a.serial = r.old
    loop
      insert into festival_participant_roles (festival_participant_id, role_id)
        select m.dst, x.role_id from festival_participant_roles x
         where x.festival_participant_id = m.src
        on conflict do nothing;
      insert into announcement_participants (announcement_id, festival_participant_id)
        select x.announcement_id, m.dst from announcement_participants x
         where x.festival_participant_id = m.src
        on conflict do nothing;
      if m.dst_bg is null and m.src_bg is not null then
        update festival_participants set baggage_group_id = m.src_bg where id = m.dst;
      end if;
      update baggage_groups set leader_participant_id = m.dst
        where leader_participant_id = m.src;
      -- 役職・お知らせの宛先は ON DELETE CASCADE で一緒に消える(写し済み)
      delete from festival_participants where id = m.src;
    end loop;

    insert into participants (serial) values (r.new)
      on conflict (serial) do nothing;

    update festival_participants set serial = r.new where serial = r.old;
    update push_subscriptions set serial = r.new where serial = r.old;

    delete from serial_access
      where serial = r.old
        and exists (select 1 from serial_access s where s.serial = r.new);
    update serial_access set serial = r.new where serial = r.old;

    delete from rehearsal_attendances a
      where a.serial = r.old
        and exists (
          select 1 from rehearsal_attendances b
          where b.rehearsal_id = a.rehearsal_id and b.serial = r.new
        );
    update rehearsal_attendances set serial = r.new where serial = r.old;

    update prop_items set current_holder_serial = r.new
      where current_holder_serial = r.old;
    update prop_event_assignments set user_serial = r.new
      where user_serial = r.old;
    update prop_transfers set from_serial = r.new where from_serial = r.old;
    update prop_transfers set to_serial = r.new where to_serial = r.old;
    update prop_transfers set created_by_serial = r.new
      where created_by_serial = r.old;
    update prop_history set actor_serial = r.new where actor_serial = r.old;
    update prop_history set from_value = r.new where from_value = r.old;
    update prop_history set to_value = r.new where to_value = r.old;

    delete from participants where serial = r.old;

    result := case when cardinality(notes) = 0 then '変更済み'
                   else '変更済み: ' || array_to_string(notes, ' / ') end;
    return next;
  end loop;
end $$;

comment on function normalize_participant_serials(boolean) is
  '全角のシリアルを半角にそろえる。引数なしは確認だけ、true で反映';

-- 名簿を書き換える関数なので、アプリ(anon / authenticated)からは呼ばせない。
-- SQL Editor(postgres)から実行する。
revoke all on function normalize_participant_serials(boolean)
  from public, anon, authenticated;
