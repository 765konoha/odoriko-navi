-- =========================================================
-- 踊り子マスタ(participants)の管理
--
-- 祭りの名簿を貼り付けるときにシリアルを打ち間違えると、マスタに
-- 存在しないはずのシリアルが増え、シリアル選択画面にも出てしまう。
-- 管理画面から次の2つを行えるようにする。
--   * 統合: 間違ったシリアルの記録(名簿・出欠・小道具・通知・利用状況)を
--           正しいシリアルへ付け替えて、間違った方を消す
--   * 削除: 間違ったシリアルを記録ごと消す(小道具の記録がある場合は不可)
--
-- どちらも、まず p_apply = false で「何が起きるか」を返し、
-- 画面で確認してから p_apply = true で反映する。
--
-- 表は追加しない。関数だけを追加するので、流しても既存のデータは変わらない。
-- =========================================================

-- 「,」でつないだシリアルの一覧の中の1つを置き換える(重複はまとめる)。
-- 小道具の履歴の変更前・変更後は、複数人のときこの形で残している(0024)
create or replace function serial_list_replace(p_list text, p_old text, p_new text)
returns text
language sql
immutable
as $$
  select case
    when p_list is null or not (p_old = any (string_to_array(p_list, ','))) then p_list
    else (
      select string_agg(s, ',' order by first_pos)
      from (
        select s, min(pos) as first_pos
        from unnest(string_to_array(p_list, ',')) with ordinality as u(raw, pos)
        cross join lateral (select case when raw = p_old then p_new else raw end as s) x
        group by s
      ) d
    )
  end
$$;

revoke all on function serial_list_replace(text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------
-- 一覧: マスタのシリアルと、それぞれがどこで使われているか
-- ---------------------------------------------------------
create or replace function admin_participant_master()
returns table (
  serial           text,
  created_at       timestamptz,
  name             text,
  nickname         text,
  festival_names   text[],
  attendance_count integer,
  prop_count       integer,
  transfer_count   integer,
  push_count       integer,
  last_seen_at     timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;
  return query
  select
    p.serial,
    p.created_at,
    d.name,
    d.nickname,
    coalesce((
      select array_agg(f.name order by f.name)
      from festival_participants fp join festivals f on f.id = fp.festival_id
      where fp.serial = p.serial
    ), '{}'),
    (select count(*)::int from rehearsal_attendances a where a.serial = p.serial),
    (select count(*)::int from prop_items i
      where i.current_holder_serial = p.serial
         or exists (select 1 from prop_item_co_holders c
                    where c.prop_item_id = i.id and c.serial = p.serial)),
    (select count(*)::int from prop_transfers t
      where t.from_serial = p.serial or t.to_serial = p.serial
         or exists (select 1 from prop_transfer_receivers r
                    where r.transfer_id = t.id and r.serial = p.serial)),
    (select count(*)::int from push_subscriptions s where s.serial = p.serial),
    (select sa.last_seen_at from serial_access sa where sa.serial = p.serial)
  from participants p
  left join participant_display d on d.serial = p.serial
  order by p.serial;
end $$;

revoke all on function admin_participant_master() from public, anon;
grant execute on function admin_participant_master() to authenticated;

-- ---------------------------------------------------------
-- 統合: p_from の記録を p_to へ付け替え、p_from をマスタから消す
--
-- 返す行の level は info(そのまま進む)/ warn(消えるものがある)/
-- error(このままでは統合できない)。error がある間は反映しない。
--
-- 同じものに両方が入っている場合は p_to の方を残す。
--   * 同じ祭りの名簿に両方 → p_from の登録(役職・荷物グループの所属ごと)を消す
--   * 同じリハに両方の出欠 → p_to の回答を残す
--   * 利用状況 → 初回は早い方、最終は遅い方、回数は合計
-- 未完了の受け渡しの渡す側と受け取る側に分かれている場合は、統合すると
-- 自分から自分への受け渡しになるため、先に受け渡しを取り消してもらう。
-- ---------------------------------------------------------
create or replace function admin_merge_participant(
  p_from  text,
  p_to    text,
  p_apply boolean default false
) returns table (level text, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_errors text[] := '{}';
  v_n      integer;
  v_m      integer;
  v_names  text;
  r        record;
  v_fa     serial_access;
  v_ta     serial_access;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;

  if p_from is null or p_to is null or p_from = p_to then
    v_errors := v_errors || '統合元と統合先に別々のシリアルを選んでください。'::text;
  else
    if not exists (select 1 from participants where serial = p_from) then
      v_errors := v_errors || ('シリアル「' || p_from || '」が見つかりません。最新の一覧を読み込み直してください。');
    end if;
    if not exists (select 1 from participants where serial = p_to) then
      v_errors := v_errors || ('シリアル「' || p_to || '」が見つかりません。最新の一覧を読み込み直してください。');
    end if;
  end if;

  if cardinality(v_errors) = 0 then
    select string_agg(i.display_name, '、' order by i.display_name) into v_names
    from prop_transfers t join prop_items i on i.id = t.prop_item_id
    where t.status = 'pending'
      and ((p_from = any (prop_transfer_givers(t.id)) and p_to = any (prop_transfer_receivers_of(t.id)))
        or (p_to = any (prop_transfer_givers(t.id)) and p_from = any (prop_transfer_receivers_of(t.id))));
    if v_names is not null then
      v_errors := v_errors || ('「' || v_names || '」で ' || p_from || ' と ' || p_to
        || ' の間の受け渡し予定があります。小道具管理で受け渡しを取り消してから統合してください。');
    end if;
  end if;

  if cardinality(v_errors) > 0 then
    if p_apply then
      raise exception '%', v_errors[1];
    end if;
    return query select 'error'::text, e from unnest(v_errors) as e;
    return;
  end if;

  -- ---- 何が起きるか ----
  for r in
    select f.name as festival, fa.name, fa.nickname
    from festival_participants fa
    join festival_participants fb on fb.festival_id = fa.festival_id and fb.serial = p_to
    join festivals f on f.id = fa.festival_id
    where fa.serial = p_from
    order by f.name
  loop
    level := 'warn';
    message := '「' || r.festival || '」は両方の名簿に載っているため、' || p_from
      || '(' || coalesce(nullif(r.nickname, ''), r.name)
      || ')の登録を消して ' || p_to || ' の登録を残します。役職・荷物グループの設定も ' || p_to || ' の方が残ります。';
    return next;
  end loop;

  select string_agg(f.name, '、' order by f.name) into v_names
  from festival_participants fa join festivals f on f.id = fa.festival_id
  where fa.serial = p_from
    and not exists (select 1 from festival_participants fb
                    where fb.festival_id = fa.festival_id and fb.serial = p_to);
  if v_names is not null then
    level := 'info';
    message := '祭りの名簿: 「' || v_names || '」の登録を ' || p_to || ' に付け替えます。';
    return next;
  end if;

  select count(*) filter (where not exists (
           select 1 from rehearsal_attendances b
           where b.rehearsal_id = a2.rehearsal_id and b.serial = p_to)),
         count(*) filter (where exists (
           select 1 from rehearsal_attendances b
           where b.rehearsal_id = a2.rehearsal_id and b.serial = p_to))
    into v_n, v_m
  from rehearsal_attendances a2 where a2.serial = p_from;
  if v_n > 0 then
    level := 'info';
    message := 'リハの出欠: ' || v_n || '件を ' || p_to || ' に付け替えます。';
    return next;
  end if;
  if v_m > 0 then
    level := 'warn';
    message := 'リハの出欠: ' || v_m || '件は両方に回答があるため、' || p_to || ' の回答を残します。';
    return next;
  end if;

  select count(*) into v_n from prop_items i
  where i.current_holder_serial = p_from
     or exists (select 1 from prop_item_co_holders c where c.prop_item_id = i.id and c.serial = p_from);
  select count(*) into v_m from prop_transfers t
  where t.from_serial = p_from or t.to_serial = p_from or t.created_by_serial = p_from
     or exists (select 1 from prop_transfer_receivers c where c.transfer_id = t.id and c.serial = p_from);
  if v_n > 0 or v_m > 0 then
    level := 'info';
    message := '小道具: 持っている小道具 ' || v_n || '件、受け渡しの記録 ' || v_m || '件を '
      || p_to || ' に付け替えます(履歴の表示も ' || p_to || ' になります)。';
    return next;
  end if;
  select count(*) into v_n from prop_event_assignments where user_serial = p_from;
  if v_n > 0 then
    level := 'info';
    message := '小道具の使用予定: ' || v_n || '件を ' || p_to || ' に付け替えます。';
    return next;
  end if;

  select count(*) into v_n from push_subscriptions where serial = p_from;
  if v_n > 0 then
    level := 'info';
    message := 'プッシュ通知: ' || v_n || '台の端末を ' || p_to || ' 宛てに付け替えます。';
    return next;
  end if;

  if exists (select 1 from serial_access where serial = p_from) then
    level := 'info';
    message := '利用状況: ' || p_to || ' の記録にまとめます。';
    return next;
  end if;

  level := 'info';
  message := p_from || ' はマスタから消えます。';
  return next;

  if not p_apply then
    return;
  end if;

  -- ---- 反映 ----
  delete from festival_participants fa
    where fa.serial = p_from
      and exists (select 1 from festival_participants fb
                  where fb.festival_id = fa.festival_id and fb.serial = p_to);
  update festival_participants set serial = p_to where serial = p_from;

  update push_subscriptions set serial = p_to where serial = p_from;

  select * into v_fa from serial_access where serial = p_from;
  select * into v_ta from serial_access where serial = p_to;
  if v_fa.serial is not null and v_ta.serial is not null then
    update serial_access set
      first_seen_at = least(v_fa.first_seen_at, v_ta.first_seen_at),
      last_seen_at  = greatest(v_fa.last_seen_at, v_ta.last_seen_at),
      installed     = v_fa.installed or v_ta.installed,
      installed_at  = case
        when v_fa.installed_at is null then v_ta.installed_at
        when v_ta.installed_at is null then v_fa.installed_at
        else least(v_fa.installed_at, v_ta.installed_at) end,
      last_festival_slug = case when v_fa.last_seen_at > v_ta.last_seen_at
        then v_fa.last_festival_slug else v_ta.last_festival_slug end,
      last_platform = case when v_fa.last_seen_at > v_ta.last_seen_at
        then v_fa.last_platform else v_ta.last_platform end,
      access_count  = v_fa.access_count + v_ta.access_count
      where serial = p_to;
    delete from serial_access where serial = p_from;
  elsif v_fa.serial is not null then
    update serial_access set serial = p_to where serial = p_from;
  end if;

  delete from rehearsal_attendances x
    where x.serial = p_from
      and exists (select 1 from rehearsal_attendances y
                  where y.rehearsal_id = x.rehearsal_id and y.serial = p_to);
  update rehearsal_attendances set serial = p_to where serial = p_from;

  update prop_items set current_holder_serial = p_to
    where current_holder_serial = p_from;
  delete from prop_item_co_holders c
    where c.serial = p_from
      and exists (select 1 from prop_item_co_holders d
                  where d.prop_item_id = c.prop_item_id and d.serial = p_to);
  update prop_item_co_holders set serial = p_to where serial = p_from;
  -- 代表と一緒に持つ人が同じになった行は要らない
  delete from prop_item_co_holders c
    using prop_items i
    where i.id = c.prop_item_id and c.serial = i.current_holder_serial;

  update prop_event_assignments set user_serial = p_to where user_serial = p_from;

  update prop_transfers set from_serial = p_to where from_serial = p_from;
  update prop_transfers set to_serial = p_to where to_serial = p_from;
  update prop_transfers set created_by_serial = p_to where created_by_serial = p_from;
  delete from prop_transfer_receivers c
    where c.serial = p_from
      and exists (select 1 from prop_transfer_receivers d
                  where d.transfer_id = c.transfer_id and d.serial = p_to);
  update prop_transfer_receivers set serial = p_to where serial = p_from;
  delete from prop_transfer_receivers c
    using prop_transfers t
    where t.id = c.transfer_id and c.serial = t.to_serial;

  update prop_history set actor_serial = p_to where actor_serial = p_from;
  -- 状態の変更(condition_changed)の変更前後はシリアルではない
  update prop_history
    set from_value = serial_list_replace(from_value, p_from, p_to),
        to_value   = serial_list_replace(to_value, p_from, p_to)
    where action <> 'condition_changed'
      and (p_from = any (string_to_array(from_value, ','))
           or p_from = any (string_to_array(to_value, ',')));

  delete from participants where serial = p_from;
end $$;

revoke all on function admin_merge_participant(text, text, boolean) from public, anon;
grant execute on function admin_merge_participant(text, text, boolean) to authenticated;

-- ---------------------------------------------------------
-- 削除: p_serial をマスタから消す
--
-- 祭りの名簿の登録・リハの出欠・利用状況も一緒に消える。
-- 通知の購読は消さず、シリアル無し(全員向けだけ届く)に戻る。
-- 小道具の記録(持ち主・受け渡し・使用予定)がある場合は、履歴が
-- 欠けるので削除せず、正しいシリアルへの統合を案内する。
-- ---------------------------------------------------------
create or replace function admin_delete_participant(
  p_serial text,
  p_apply  boolean default false
) returns table (level text, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_n     integer;
  v_names text;
  r       record;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;

  if not exists (select 1 from participants where serial = p_serial) then
    if p_apply then
      raise exception 'シリアル「%」が見つかりません。最新の一覧を読み込み直してください。', p_serial;
    end if;
    return query select 'error'::text,
      'シリアル「' || coalesce(p_serial, '') || '」が見つかりません。最新の一覧を読み込み直してください。';
    return;
  end if;

  if exists (select 1 from prop_items i
             where i.current_holder_serial = p_serial
                or exists (select 1 from prop_item_co_holders c
                           where c.prop_item_id = i.id and c.serial = p_serial))
     or exists (select 1 from prop_transfers t
                where t.from_serial = p_serial or t.to_serial = p_serial
                   or t.created_by_serial = p_serial
                   or exists (select 1 from prop_transfer_receivers c
                              where c.transfer_id = t.id and c.serial = p_serial))
     or exists (select 1 from prop_event_assignments where user_serial = p_serial)
  then
    if p_apply then
      raise exception '小道具の記録があるため削除できません。正しいシリアルへ統合してください。';
    end if;
    return query select 'error'::text,
      '小道具の記録(持ち主・受け渡し・使用予定)があるため削除できません。正しいシリアルへ統合してください。';
    return;
  end if;

  for r in
    select f.name as festival, fp.name, fp.nickname,
           exists (select 1 from baggage_groups g where g.leader_participant_id = fp.id) as is_leader
    from festival_participants fp join festivals f on f.id = fp.festival_id
    where fp.serial = p_serial
    order by f.name
  loop
    level := 'warn';
    message := '「' || r.festival || '」の名簿から ' || coalesce(nullif(r.nickname, ''), r.name)
      || ' を消します(役職・荷物グループの所属も消えます)。'
      || case when r.is_leader then '荷物リーダーは未設定になります。' else '' end;
    return next;
  end loop;

  select count(*) into v_n from rehearsal_attendances where serial = p_serial;
  if v_n > 0 then
    level := 'warn';
    message := 'リハの出欠 ' || v_n || '件を消します。';
    return next;
  end if;

  select count(*) into v_n from push_subscriptions where serial = p_serial;
  if v_n > 0 then
    level := 'warn';
    message := 'プッシュ通知: ' || v_n || '台の端末が、全員向けのお知らせだけ届く状態に戻ります。';
    return next;
  end if;

  if exists (select 1 from serial_access where serial = p_serial) then
    level := 'info';
    message := '利用状況の記録を消します。';
    return next;
  end if;

  level := 'info';
  message := p_serial || ' はマスタから消えます。';
  return next;

  if not p_apply then
    return;
  end if;

  delete from festival_participants where serial = p_serial;
  delete from participants where serial = p_serial;
end $$;

revoke all on function admin_delete_participant(text, boolean) from public, anon;
grant execute on function admin_delete_participant(text, boolean) to authenticated;
