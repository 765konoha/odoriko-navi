-- =========================================================
-- 小道具のスプレッドシート連携(docs/PROPS_SHEET_SYNC.md)
--
-- 小道具担当のスプレッドシートから、Apps Script → Edge Function
-- (props-sheet-sync)経由で次の2つを反映する。
--   * 保有者・状態の更新(アプリに無い小道具は登録する)
--   * お祭り当日の持ち帰り(受け渡し予定)
-- 反映の関数は service_role(Edge Function)だけが呼べる。
--
-- 受け渡しに2列を足す(どちらも空を許すので、古い版のアプリもそのまま動く)。
--   sheet_date    スプレッドシートの何日のお祭りから作った予定か(手作業の予定は空)
--   giver_serials 画面に出す「渡す人」(お祭りで使った人)。空なら今の保有者
-- 何度流してもよい。
-- =========================================================

alter table prop_transfers add column if not exists sheet_date date;
alter table prop_transfers add column if not exists giver_serials text[];
create index if not exists idx_prop_transfers_sheet_date
  on prop_transfers (sheet_date) where sheet_date is not null;

comment on column prop_transfers.sheet_date is
  'スプレッドシートの何日のお祭りから作った予定か(手作業の予定は null)';
comment on column prop_transfers.giver_serials is
  '画面に出す渡す人(お祭りで使った人)。null なら今の保有者';

-- 実行の記録(運営の画面に最後の反映を出す)
create table if not exists prop_sheet_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  action        text not null check (action in ('holders', 'handovers')),
  target        text,
  applied_count integer not null default 0,
  error_count   integer not null default 0,
  summary       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_prop_sheet_sync_runs_created
  on prop_sheet_sync_runs (created_at desc);

alter table prop_sheet_sync_runs enable row level security;
drop policy if exists "admin read prop_sheet_sync_runs" on prop_sheet_sync_runs;
create policy "admin read prop_sheet_sync_runs"
  on prop_sheet_sync_runs for select to authenticated using (true);

-- 2026-10-30 以降は新しい表に権限が自動で付かない(0025)
grant select on prop_sheet_sync_runs to authenticated;
grant select, insert, update, delete on prop_sheet_sync_runs to service_role;

-- =========================================================
-- 保有者の置き換え(0024 の prop_admin_set_holders の中身)。
-- 管理画面の RPC とスプレッドシート連携で同じ処理を使うため、権限の確認だけを外に出す
-- =========================================================

create or replace function prop_set_holders_core(
  p_item_id uuid,
  p_serials text[],
  p_note    text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item  prop_items;
  v_new   text[];
  v_old   text[];
  v_rep   text;
  v_bad   text;
  v_head  uuid;
  v_t     prop_transfers;
  v_keep  boolean;
begin
  select * into v_item from prop_items where id = p_item_id for update;
  if not found then
    raise exception '小道具が見つかりません。最新情報を取得してください。';
  end if;

  v_new := prop_clean_serials(p_serials);
  select s into v_bad from unnest(v_new) as s
   where not exists (select 1 from participants p where p.serial = s)
   limit 1;
  if v_bad is not null then
    raise exception '指定したシリアル「%」が見つかりません。', v_bad;
  end if;

  v_old := prop_holders(p_item_id);
  if v_old = v_new then
    return;
  end if;

  -- DB 上の代表は、今の人が残るならそのまま。外れたら一覧の先頭
  v_rep := case
    when v_item.current_holder_serial = any (v_new) then v_item.current_holder_serial
    else v_new[1]
  end;

  v_keep := cardinality(v_new) > 0 and v_old && v_new;
  v_head := prop_head_transfer(p_item_id);
  if v_keep and v_head is not null then
    if prop_transfer_receivers_of(v_head) = v_new then
      v_keep := false;
    elsif v_rep is distinct from v_item.current_holder_serial then
      update prop_transfers set from_serial = v_rep where id = v_head;
    end if;
  end if;

  if not v_keep then
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
                array_to_string(prop_transfer_givers(v_t.id), ','),
                array_to_string(prop_transfer_receivers_of(v_t.id), ','),
                '管理者による保有者変更のためキャンセル');
    end loop;
  end if;

  update prop_items
    set current_holder_serial = v_rep, updated_at = now()
    where id = p_item_id;
  delete from prop_item_co_holders where prop_item_id = p_item_id;
  insert into prop_item_co_holders (prop_item_id, serial)
    select p_item_id, s from unnest(v_new) as s where s is distinct from v_rep;

  -- 変更前後は「,」でつないだシリアルの一覧で残す
  insert into prop_history
    (prop_item_id, action, actor_is_admin, from_value, to_value, note)
    values (p_item_id, 'holder_changed_by_admin', true,
            nullif(array_to_string(v_old, ','), ''),
            nullif(array_to_string(v_new, ','), ''), p_note);
end $$;

revoke all on function prop_set_holders_core(uuid, text[], text)
  from public, anon, authenticated;

create or replace function prop_admin_set_holders(
  p_item_id uuid,
  p_serials text[],
  p_note    text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;
  perform prop_set_holders_core(p_item_id, p_serials, p_note);
end $$;

revoke all on function prop_admin_set_holders(uuid, text[], text) from public;
grant execute on function prop_admin_set_holders(uuid, text[], text) to authenticated;

-- =========================================================
-- 内部用: 受け渡し予定を取り消す(履歴を残す)
-- =========================================================

create or replace function prop_sheet_cancel_transfer(p_transfer_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into prop_history
    (prop_item_id, transfer_id, action, actor_is_admin, from_value, to_value, note)
    select t.prop_item_id, t.id, 'transfer_cancelled', true,
           array_to_string(prop_transfer_givers(t.id), ','),
           array_to_string(prop_transfer_receivers_of(t.id), ','), p_reason
      from prop_transfers t
     where t.id = p_transfer_id and t.status = 'pending';
  update prop_transfers
    set status = 'cancelled', cancelled_at = now(), cancelled_reason = p_reason
    where id = p_transfer_id and status = 'pending';
end $$;

revoke all on function prop_sheet_cancel_transfer(uuid, text)
  from public, anon, authenticated;

-- =========================================================
-- 反映: 保有者・状態
-- p_items: [{ item_id?, category, identifier, holders?: text[], condition?: text }]
--   item_id が無ければ小道具を登録する(種類・番号が同じものがあればそれを使う)
--   holders があれば保有者をその顔ぶれにする(空なら保有者なし)
--   condition があれば状態をそれにする
-- =========================================================

create or replace function prop_sheet_apply_holders(
  p_items jsonb,
  p_note  text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_entry     jsonb;
  v_id        uuid;
  v_new       text[];
  v_condition text;
  v_created   integer := 0;
  v_holders   integer := 0;
  v_states    integer := 0;
  v_note      text := coalesce(p_note, 'スプレッドシートから反映');
begin
  for v_entry in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_id := nullif(v_entry->>'item_id', '')::uuid;
    if v_id is null then
      insert into prop_items (category, identifier, display_name)
        values (v_entry->>'category', v_entry->>'identifier',
                btrim((v_entry->>'category') || ' ' || (v_entry->>'identifier')))
        on conflict (category, identifier) do nothing
        returning id into v_id;
      if v_id is null then
        select id into v_id from prop_items
         where category = v_entry->>'category' and identifier = v_entry->>'identifier';
      else
        v_created := v_created + 1;
      end if;
    end if;
    if v_id is null then
      continue;
    end if;

    if jsonb_typeof(v_entry->'holders') = 'array' then
      v_new := prop_clean_serials(array(
        select jsonb_array_elements_text(v_entry->'holders')));
      if v_new is distinct from prop_holders(v_id) then
        perform prop_set_holders_core(v_id, v_new, v_note);
        v_holders := v_holders + 1;
      end if;
    end if;

    v_condition := v_entry->>'condition';
    if v_condition is not null then
      update prop_items
         set condition = v_condition, updated_at = now()
       where id = v_id and condition is distinct from v_condition;
      if found then
        v_states := v_states + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_created, 'holders', v_holders, 'conditions', v_states);
end $$;

revoke all on function prop_sheet_apply_holders(jsonb, text)
  from public, anon, authenticated;
grant execute on function prop_sheet_apply_holders(jsonb, text) to service_role;

-- =========================================================
-- 反映: お祭り当日の持ち帰り
-- p_items: [{ item_id, receivers: text[], givers?: text[] }]
-- p_keep:  今回は送れなかった(エラーの)小道具。この日の既存の予定を残す
--
-- * この日の分が受け取り済みなら触らない
-- * この日の未完了の予定があれば、受け取る人が同じなら渡す人だけ直し、違えば作り直す
-- * 前のお祭りのスプレッドシート由来の予定が残っていれば取り消す
-- * 手作業の予定が残っている小道具は作らず conflicts に返す
-- * 受け取る人が今の保有者と同じなら作らない
-- * この日の予定のうち、今回の一覧に無い小道具の分は取り消す
-- =========================================================

create or replace function prop_sheet_apply_handovers(
  p_date  date,
  p_label text,
  p_items jsonb,
  p_keep  uuid[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_entry     jsonb;
  v_item      prop_items;
  v_t         prop_transfers;
  v_recv      text[];
  v_givers    text[];
  v_to        text;
  v_id        uuid;
  v_seen      uuid[] := '{}';
  v_conflicts uuid[] := '{}';
  v_created   integer := 0;
  v_updated   integer := 0;
  v_cancelled integer := 0;
  v_note      text := nullif(btrim(coalesce(p_label, '')), '');
begin
  for v_entry in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into v_item from prop_items
     where id = nullif(v_entry->>'item_id', '')::uuid for update;
    if not found then
      continue;
    end if;
    v_seen := v_seen || v_item.id;
    v_recv := prop_clean_serials(array(
      select jsonb_array_elements_text(v_entry->'receivers')));
    v_givers := case
      when jsonb_typeof(v_entry->'givers') = 'array' then prop_clean_serials(array(
        select jsonb_array_elements_text(v_entry->'givers')))
      else null end;
    if cardinality(v_givers) = 0 then
      v_givers := null;
    end if;

    if exists (
      select 1 from prop_transfers
       where prop_item_id = v_item.id and sheet_date = p_date and status = 'completed'
    ) then
      continue;
    end if;

    select * into v_t from prop_transfers
     where prop_item_id = v_item.id and sheet_date = p_date and status = 'pending'
     limit 1;
    if found then
      if prop_transfer_receivers_of(v_t.id) = v_recv then
        update prop_transfers
           set giver_serials = v_givers, note = v_note
         where id = v_t.id;
        v_updated := v_updated + 1;
        continue;
      end if;
      perform prop_sheet_cancel_transfer(v_t.id, 'スプレッドシートの予定が変わったため取り消し');
      v_cancelled := v_cancelled + 1;
    end if;

    for v_t in
      select * from prop_transfers
       where prop_item_id = v_item.id and status = 'pending'
         and sheet_date is not null and sheet_date < p_date
    loop
      perform prop_sheet_cancel_transfer(v_t.id, '次のお祭りの予定を反映したため取り消し');
      v_cancelled := v_cancelled + 1;
    end loop;

    if exists (
      select 1 from prop_transfers where prop_item_id = v_item.id and status = 'pending'
    ) then
      v_conflicts := v_conflicts || v_item.id;
      continue;
    end if;
    if cardinality(v_recv) = 0 or v_recv = prop_holders(v_item.id)
       or v_item.is_archived or v_item.condition in ('lost', 'retired') then
      continue;
    end if;

    v_to := case
      when v_item.current_holder_serial = any (v_recv) then v_item.current_holder_serial
      else v_recv[1] end;
    insert into prop_transfers
      (prop_item_id, from_serial, to_serial, scheduled_at, note,
       created_by_admin, sheet_date, giver_serials)
      values (v_item.id, v_item.current_holder_serial, v_to,
              (p_date::timestamp at time zone 'Asia/Tokyo'), v_note,
              true, p_date, v_givers)
      returning id into v_id;
    insert into prop_transfer_receivers (transfer_id, serial)
      select v_id, s from unnest(v_recv) as s where s <> v_to;
    insert into prop_history
      (prop_item_id, transfer_id, action, actor_is_admin, from_value, to_value, note)
      values (v_item.id, v_id, 'transfer_created', true,
              array_to_string(coalesce(v_givers, prop_holders(v_item.id)), ','),
              array_to_string(v_recv, ','),
              'スプレッドシートから反映' || coalesce(': ' || v_note, ''));
    v_created := v_created + 1;
  end loop;

  for v_t in
    select * from prop_transfers
     where sheet_date = p_date and status = 'pending'
       and not (prop_item_id = any (v_seen))
       and not (prop_item_id = any (coalesce(p_keep, '{}')))
  loop
    perform prop_sheet_cancel_transfer(v_t.id, 'スプレッドシートの予定から外れたため取り消し');
    v_cancelled := v_cancelled + 1;
  end loop;

  return jsonb_build_object(
    'created', v_created, 'updated', v_updated, 'cancelled', v_cancelled,
    'conflicts', to_jsonb(v_conflicts));
end $$;

revoke all on function prop_sheet_apply_handovers(date, text, jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function prop_sheet_apply_handovers(date, text, jsonb, uuid[])
  to service_role;
