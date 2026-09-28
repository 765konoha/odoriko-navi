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
--   2. 「要対応」があれば、参加者管理で重複している方を削除する
--   3. select * from normalize_participant_serials(true);  -- 反映
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
-- 次の場合は付け替えずに「要対応」として返す(どちらを残すかは人が決める)。
--   - 同じ祭りに、両方の表記で登録されている(同じ人が2人いる)
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
  clash text;
begin
  for r in
    select p.serial as old, normalize_serial(p.serial) as new
    from participants p
    where p.serial <> normalize_serial(p.serial)
    order by p.serial
  loop
    old_serial := r.old;
    new_serial := r.new;

    select string_agg(f.name, '、' order by f.name) into clash
    from festival_participants a
    join festival_participants b
      on b.festival_id = a.festival_id and b.serial = r.new
    join festivals f on f.id = a.festival_id
    where a.serial = r.old;
    if clash is not null then
      result := '要対応: 「' || clash || '」に ' || r.old || ' と ' || r.new
        || ' の両方が登録されています。参加者管理でどちらかを削除してから、もう一度実行してください';
      return next;
      continue;
    end if;

    if exists (
      select 1 from prop_transfers t
      where (t.from_serial = r.old and t.to_serial = r.new)
         or (t.from_serial = r.new and t.to_serial = r.old)
    ) then
      result := '要対応: ' || r.old || ' と ' || r.new
        || ' の間に小道具の受け渡し記録があるため、自動では付け替えません(記録の扱いを決める必要があります)';
      return next;
      continue;
    end if;

    if not p_apply then
      result := '変更予定';
      return next;
      continue;
    end if;

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

    result := '変更済み';
    return next;
  end loop;
end $$;

comment on function normalize_participant_serials(boolean) is
  '全角のシリアルを半角にそろえる。引数なしは確認だけ、true で反映';

-- 名簿を書き換える関数なので、アプリ(anon / authenticated)からは呼ばせない。
-- SQL Editor(postgres)から実行する。
revoke all on function normalize_participant_serials(boolean)
  from public, anon, authenticated;
