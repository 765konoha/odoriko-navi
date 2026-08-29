-- =========================================================
-- 運営による受取完了の代理報告
--
-- 現物は受け渡し済みなのに、受け取った本人が「受け取りました」を
-- 押さないまま進んでしまうことがある。
-- 保有者を直接変更する prop_admin_set_holder では受け渡し予定が
-- キャンセル扱いになり、複数日の予定も巻き添えで消えてしまうため、
-- 「受取完了として記録する」専用の操作を用意する。
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
end $$;

revoke all on function prop_admin_complete_transfer(uuid, text) from public;
grant execute on function prop_admin_complete_transfer(uuid, text) to authenticated;
