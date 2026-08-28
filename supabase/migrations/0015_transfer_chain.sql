-- =========================================================
-- 受け渡しの複数日対応(1日目 A→B、2日目 B→C)と予定日の変更
--
-- これまでは1つの小道具に受け渡し予定を1件しか持てなかったため、
-- 複数日にわたる受け渡しを先に登録できなかった。
-- 「予定を鎖のようにつなぐ」形に変更する。
--   鎖の順番は作成順(created_at)。予定日はあくまで表示用の情報。
--   次の受け渡しの出し手は、ひとつ前の予定の受取者になる。
-- =========================================================

-- 予定を複数持てるようにする(順番と整合性は下のRPCで守る)
drop index if exists uq_prop_transfers_pending;

-- 予定日の変更を履歴に残せるようにする
alter table prop_history drop constraint prop_history_action_check;
alter table prop_history add constraint prop_history_action_check
  check (action in (
    'item_created','transfer_created','transfer_target_changed',
    'transfer_completed','transfer_cancelled','holder_changed_by_admin',
    'condition_changed','assignment_changed','transfer_schedule_changed'));

-- =========================================================
-- 鎖の状態を読むための補助関数
-- =========================================================

/** 次に受け渡しを作れる人(最後の予定の受取者。予定が無ければ現在の保有者) */
create or replace function prop_expected_holder(p_item_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select t.to_serial from prop_transfers t
      where t.prop_item_id = p_item_id and t.status = 'pending'
      order by t.created_at desc limit 1),
    (select i.current_holder_serial from prop_items i where i.id = p_item_id)
  );
$$;

/** 鎖の先頭(次に受け取れる予定)の id */
create or replace function prop_head_transfer(p_item_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select t.id from prop_transfers t
   where t.prop_item_id = p_item_id and t.status = 'pending'
   order by t.created_at asc limit 1;
$$;

grant execute on function prop_expected_holder(uuid) to anon, authenticated;
grant execute on function prop_head_transfer(uuid) to anon, authenticated;

-- =========================================================
-- RPC: 受け渡し予定の作成(鎖の末尾に足す)
-- 出し手は「最後の予定の受取者」= prop_expected_holder
-- =========================================================

create or replace function prop_create_transfer(
  p_item_id      uuid,
  p_actor_serial text,
  p_to_serial    text,
  p_scheduled_at timestamptz default null,
  p_note         text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_item     prop_items;
  v_expected text;
  v_id       uuid;
begin
  select * into v_item from prop_items where id = p_item_id for update;
  if not found then
    raise exception '小道具が見つかりません。最新情報を取得してください。';
  end if;
  if v_item.is_archived then
    raise exception 'この小道具は利用終了しています。';
  end if;
  if v_item.condition in ('lost','retired') then
    raise exception 'この小道具は紛失・使用停止のため受け渡しを開始できません。';
  end if;

  v_expected := prop_expected_holder(p_item_id);
  if v_expected is null then
    raise exception '保有者が未設定のため受け渡しを開始できません。';
  end if;
  -- 鎖の末尾の受取者だけが次の受け渡しを作れる
  if v_expected is distinct from p_actor_serial then
    raise exception '受け渡しの順番が変わっています。最新情報を取得してください。';
  end if;
  if p_to_serial = p_actor_serial then
    raise exception '自分自身への受け渡しはできません。';
  end if;
  if not exists (select 1 from participants where serial = p_to_serial) then
    raise exception '受け渡し先のシリアルが見つかりません。';
  end if;

  insert into prop_transfers
    (prop_item_id, from_serial, to_serial, scheduled_at, note, created_by_serial)
    values (p_item_id, p_actor_serial, p_to_serial, p_scheduled_at, p_note, p_actor_serial)
    returning id into v_id;

  insert into prop_history
    (prop_item_id, transfer_id, action, actor_serial, from_value, to_value, note)
    values (p_item_id, v_id, 'transfer_created', p_actor_serial,
            p_actor_serial, p_to_serial, p_note);
  return v_id;
end $$;

-- =========================================================
-- RPC: 受け渡し先の変更
-- 鎖の途中を変えると後続の出し手が食い違うため、末尾のみ変更できる
-- =========================================================

create or replace function prop_change_transfer_target(
  p_transfer_id    uuid,
  p_actor_serial   text,
  p_new_to_serial  text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t prop_transfers;
begin
  select * into v_t from prop_transfers where id = p_transfer_id for update;
  if not found or v_t.status <> 'pending' then
    raise exception '受け渡し情報が変更されています。最新情報を取得してください。';
  end if;
  perform 1 from prop_items where id = v_t.prop_item_id for update;
  -- 変更できるのは、その受け渡しの出し手本人だけ
  if v_t.from_serial is distinct from p_actor_serial then
    raise exception '小道具の状態が変更されています。最新情報を取得してください。';
  end if;
  -- 後続の予定があると、その出し手が食い違うため変更させない
  if exists (
    select 1 from prop_transfers t
     where t.prop_item_id = v_t.prop_item_id and t.status = 'pending'
       and t.created_at > v_t.created_at
  ) then
    raise exception 'この後に別の受け渡し予定があるため変更できません。小道具担当にご連絡ください。';
  end if;
  if p_new_to_serial = p_actor_serial then
    raise exception '自分自身への受け渡しはできません。';
  end if;
  if p_new_to_serial = v_t.to_serial then
    raise exception 'すでに同じ受け渡し先が設定されています。';
  end if;
  if not exists (select 1 from participants where serial = p_new_to_serial) then
    raise exception '受け渡し先のシリアルが見つかりません。';
  end if;

  insert into prop_history
    (prop_item_id, transfer_id, action, actor_serial, from_value, to_value)
    values (v_t.prop_item_id, v_t.id, 'transfer_target_changed', p_actor_serial,
            v_t.to_serial, p_new_to_serial);

  update prop_transfers set to_serial = p_new_to_serial where id = p_transfer_id;
end $$;

-- =========================================================
-- RPC: 受取完了(鎖の先頭のみ)
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
end $$;

-- =========================================================
-- RPC: 受け渡し予定日の変更(管理者のみ)
-- 既に登録した予定に、あとから日付を入れたり直したりする
-- =========================================================

create or replace function prop_update_transfer_schedule(
  p_transfer_id  uuid,
  p_scheduled_at timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t prop_transfers;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;
  select * into v_t from prop_transfers where id = p_transfer_id for update;
  if not found or v_t.status <> 'pending' then
    raise exception '受け渡し情報が変更されています。最新情報を取得してください。';
  end if;
  if v_t.scheduled_at is not distinct from p_scheduled_at then
    return;
  end if;

  update prop_transfers set scheduled_at = p_scheduled_at where id = p_transfer_id;
  insert into prop_history
    (prop_item_id, transfer_id, action, actor_is_admin, from_value, to_value)
    values (v_t.prop_item_id, v_t.id, 'transfer_schedule_changed', true,
            to_char(v_t.scheduled_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD'),
            to_char(p_scheduled_at  at time zone 'Asia/Tokyo', 'YYYY-MM-DD'));
end $$;

revoke all on function prop_update_transfer_schedule(uuid, timestamptz) from public;
grant execute on function prop_update_transfer_schedule(uuid, timestamptz) to authenticated;
