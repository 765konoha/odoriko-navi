-- =========================================================
-- 小道具の共同保有者
--
-- 1つの小道具を2人以上で持つ(家族で預かる・2人で使う大きな道具など)
-- ことがあるため、現在の保有者(1人)とは別に「共同保有者」を持てる
-- ようにする。
--
--   * 共同保有者は 0人以上。既存の小道具は 0人のまま(何も変わらない)
--   * 設定するのは小道具担当(管理画面)。履歴に残す
--   * 共同保有者は、その小道具を「保管中」として見られ、
--     次の受け渡し(現在の保有者からのもの)の案内も受け取る
--   * 受け渡しが完了して保有者が替わったら、共同保有者は外す
--     (共同で持っていたのは前の保有者のもとにあった間のため)
--   * 現在の保有者と同じ人は共同保有者にしない
--
-- 既存の RPC は引数を変えずに置き換える(古い版のアプリもそのまま動く)。
-- =========================================================

create table prop_item_co_holders (
  prop_item_id uuid not null references prop_items(id) on delete cascade,
  serial       text not null references participants(serial) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (prop_item_id, serial)
);

create index idx_prop_item_co_holders_serial on prop_item_co_holders (serial);

comment on table prop_item_co_holders is
  '小道具の共同保有者(現在の保有者とは別。受け渡しの完了で外れる)';

alter table prop_item_co_holders enable row level security;
create policy "anon read prop_item_co_holders"
  on prop_item_co_holders for select to anon using (true);
create policy "admin all prop_item_co_holders"
  on prop_item_co_holders for all to authenticated using (true) with check (true);

-- 履歴に「共同保有者を変更」を足す
alter table prop_history drop constraint prop_history_action_check;
alter table prop_history add constraint prop_history_action_check
  check (action in (
    'item_created','transfer_created','transfer_target_changed',
    'transfer_completed','transfer_cancelled','holder_changed_by_admin',
    'condition_changed','assignment_changed','transfer_schedule_changed',
    'co_holders_changed'));

-- =========================================================
-- 内部用: 共同保有者を外して履歴に残す(外す人がいなければ何もしない)
-- p_only を渡すとその人だけを外す
-- =========================================================

create or replace function prop_drop_co_holders(
  p_item_id uuid,
  p_note    text,
  p_actor_serial text default null,
  p_actor_is_admin boolean default false,
  p_only    text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_before text;
  v_after  text;
begin
  select string_agg(serial, ',' order by serial) into v_before
    from prop_item_co_holders where prop_item_id = p_item_id;
  if v_before is null then
    return;
  end if;

  delete from prop_item_co_holders
   where prop_item_id = p_item_id
     and (p_only is null or serial = p_only);
  if not found then
    return;
  end if;

  select string_agg(serial, ',' order by serial) into v_after
    from prop_item_co_holders where prop_item_id = p_item_id;
  insert into prop_history
    (prop_item_id, action, actor_serial, actor_is_admin, from_value, to_value, note)
    values (p_item_id, 'co_holders_changed', p_actor_serial, p_actor_is_admin,
            v_before, v_after, p_note);
end $$;

revoke all on function prop_drop_co_holders(uuid, text, text, boolean, text)
  from public, anon, authenticated;

-- =========================================================
-- RPC: 共同保有者の設定(管理者のみ)
-- 渡した一覧で置き換える。空の一覧なら全員外す
-- =========================================================

create or replace function prop_admin_set_co_holders(
  p_item_id uuid,
  p_serials text[],
  p_note    text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item   prop_items;
  v_new    text[];
  v_before text;
  v_after  text;
  v_bad    text;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;
  select * into v_item from prop_items where id = p_item_id for update;
  if not found then
    raise exception '小道具が見つかりません。最新情報を取得してください。';
  end if;

  -- 空・重複・現在の保有者を除く
  select coalesce(array_agg(distinct s order by s), '{}') into v_new
    from unnest(coalesce(p_serials, '{}')) as s
   where s is not null and btrim(s) <> ''
     and s is distinct from v_item.current_holder_serial;

  if cardinality(v_new) > 0 and v_item.current_holder_serial is null then
    raise exception '先に現在保有者を設定してください。';
  end if;
  select s into v_bad from unnest(v_new) as s
   where not exists (select 1 from participants p where p.serial = s)
   limit 1;
  if v_bad is not null then
    raise exception '指定したシリアル「%」が見つかりません。', v_bad;
  end if;

  select string_agg(serial, ',' order by serial) into v_before
    from prop_item_co_holders where prop_item_id = p_item_id;
  v_after := nullif(array_to_string(v_new, ','), '');
  if v_before is not distinct from v_after then
    return;
  end if;

  delete from prop_item_co_holders where prop_item_id = p_item_id;
  insert into prop_item_co_holders (prop_item_id, serial)
    select p_item_id, s from unnest(v_new) as s;

  insert into prop_history
    (prop_item_id, action, actor_is_admin, from_value, to_value, note)
    values (p_item_id, 'co_holders_changed', true, v_before, v_after, p_note);
end $$;

revoke all on function prop_admin_set_co_holders(uuid, text[], text) from public;
grant execute on function prop_admin_set_co_holders(uuid, text[], text) to authenticated;

-- =========================================================
-- RPC: 受取完了(0015 と同じ。完了したら共同保有者を外す)
-- =========================================================

create or replace function prop_complete_transfer(
  p_transfer_id  uuid,
  p_actor_serial text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t    prop_transfers;
  v_item prop_items;
begin
  select * into v_t from prop_transfers where id = p_transfer_id for update;
  if not found or v_t.status <> 'pending' or v_t.to_serial is distinct from p_actor_serial then
    raise exception '受け渡し情報が変更されています。最新情報を取得してください。';
  end if;
  select * into v_item from prop_items where id = v_t.prop_item_id for update;
  -- 先に受け取る人がいる場合は、その受け渡しが終わるまで完了させない
  if prop_head_transfer(v_t.prop_item_id) is distinct from v_t.id then
    raise exception 'ひとつ前の受け渡しがまだ完了していません。';
  end if;
  -- 保有者が変わっていたら完了させない(管理者手動変更との競合対策)
  if v_item.current_holder_serial is distinct from v_t.from_serial then
    raise exception '小道具の状態が変更されています。最新情報を取得してください。';
  end if;

  update prop_transfers
    set status = 'completed', completed_at = now()
    where id = p_transfer_id;
  update prop_items
    set current_holder_serial = v_t.to_serial, updated_at = now()
    where id = v_item.id;
  insert into prop_history
    (prop_item_id, transfer_id, action, actor_serial, from_value, to_value)
    values (v_item.id, v_t.id, 'transfer_completed', p_actor_serial,
            v_t.from_serial, v_t.to_serial);

  perform prop_drop_co_holders(v_item.id, '受け渡しの完了により解除',
                               p_actor_serial, false);
end $$;

-- =========================================================
-- RPC: 運営による受取完了の代理報告(0016 と同じ。完了したら共同保有者を外す)
-- =========================================================

create or replace function prop_admin_complete_transfer(
  p_transfer_id uuid,
  p_note        text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t    prop_transfers;
  v_item prop_items;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;

  select * into v_t from prop_transfers where id = p_transfer_id for update;
  if not found or v_t.status <> 'pending' then
    raise exception '受け渡し情報が変更されています。最新情報を取得してください。';
  end if;
  select * into v_item from prop_items where id = v_t.prop_item_id for update;

  -- 順番を飛ばすと保有者の流れが崩れるため、鎖の先頭から順に完了させる
  if prop_head_transfer(v_t.prop_item_id) is distinct from v_t.id then
    raise exception 'ひとつ前の受け渡しがまだ完了していません。先にそちらを完了してください。';
  end if;
  -- 保有者が食い違う場合は、受け渡しではなく保有者変更で直すべき状態
  if v_item.current_holder_serial is distinct from v_t.from_serial then
    raise exception '小道具の状態が変更されています。保有者の変更から修正してください。';
  end if;

  update prop_transfers
    set status = 'completed', completed_at = now()
    where id = p_transfer_id;
  update prop_items
    set current_holder_serial = v_t.to_serial, updated_at = now()
    where id = v_item.id;
  insert into prop_history
    (prop_item_id, transfer_id, action, actor_is_admin, from_value, to_value, note)
    values (v_item.id, v_t.id, 'transfer_completed', true,
            v_t.from_serial, v_t.to_serial,
            coalesce(p_note, '運営による代理報告'));

  perform prop_drop_co_holders(v_item.id, '受け渡しの完了により解除',
                               null, true);
end $$;

-- =========================================================
-- RPC: 管理者による現在保有者の手動変更(0012 と同じ)
-- 共同保有者はそのまま残す。ただし新しい保有者が共同保有者に
-- 入っていれば、その人だけ外す(保有者と共同保有者を兼ねさせない)
-- =========================================================

create or replace function prop_admin_set_holder(
  p_item_id           uuid,
  p_new_holder_serial text,
  p_note              text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item prop_items;
  v_t    prop_transfers;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;
  select * into v_item from prop_items where id = p_item_id for update;
  if not found then
    raise exception '小道具が見つかりません。最新情報を取得してください。';
  end if;
  if p_new_holder_serial is not null
     and not exists (select 1 from participants where serial = p_new_holder_serial) then
    raise exception '指定したシリアルが見つかりません。';
  end if;

  -- pending は自動キャンセル(保有者だけ変更して受け渡しを残さない)
  for v_t in
    select * from prop_transfers
    where prop_item_id = p_item_id and status = 'pending' for update
  loop
    update prop_transfers
      set status = 'cancelled', cancelled_at = now(),
          cancelled_reason = '管理者による保有者変更のためキャンセル'
      where id = v_t.id;
    insert into prop_history
      (prop_item_id, transfer_id, action, actor_is_admin, from_value, to_value, note)
      values (p_item_id, v_t.id, 'transfer_cancelled', true,
              v_t.from_serial, v_t.to_serial, '管理者による保有者変更のためキャンセル');
  end loop;

  update prop_items
    set current_holder_serial = p_new_holder_serial, updated_at = now()
    where id = p_item_id;
  insert into prop_history
    (prop_item_id, action, actor_is_admin, from_value, to_value, note)
    values (p_item_id, 'holder_changed_by_admin', true,
            v_item.current_holder_serial, p_new_holder_serial, p_note);

  if p_new_holder_serial is null then
    -- 保有者がいなくなったら、共同保有者も外す
    perform prop_drop_co_holders(p_item_id, '保有者を未設定にしたため解除',
                                 null, true);
  else
    perform prop_drop_co_holders(p_item_id, '現在の保有者になったため解除',
                                 null, true, p_new_holder_serial);
  end if;
end $$;

-- =========================================================
-- シリアルの表記をそろえる関数(0023)に、共同保有者の表を足す
-- =========================================================

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

    -- 共同保有者(0024)。同じ小道具に両方の表記がいれば新しい表記の方を残す
    delete from prop_item_co_holders c
      where c.serial = r.old
        and exists (
          select 1 from prop_item_co_holders d
          where d.prop_item_id = c.prop_item_id and d.serial = r.new
        );
    update prop_item_co_holders set serial = r.new where serial = r.old;

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


revoke all on function normalize_participant_serials(boolean)
  from public, anon, authenticated;
