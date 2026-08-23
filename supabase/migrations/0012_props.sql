-- 小道具管理・小道具リレー
-- SQL Editor に貼り付けて Run してください。
-- (アプリの新バージョンをデプロイする前に実行してください。既存画面の表示は変わりません)
--
-- 設計方針:
--   * 小道具は祭りを跨いで継続管理するため festival に依存しない独立テーブル群とする
--   * 参加者の識別は participants(マスター)のシリアル。名前・ニックネームは複製しない
--   * 「現在の保有者」と「イベントごとの使用予定者」は別情報として扱う
--   * 踊り子側からの更新は RPC 経由のみ(テーブル直接 UPDATE は管理者のみ)

-- =========================================================
-- 小道具マスター(個体単位)
-- =========================================================

create table prop_items (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,                 -- 例: 太鼓 / 旧提灯 / たすき
  identifier    text not null,                 -- 例: 8 / 紫 / 赤3
  display_name  text not null,                 -- 例: 太鼓8
  condition     text not null default 'normal'
                  check (condition in ('normal','damaged','broken','lost','repairing','retired')),
  condition_note text,
  note          text,
  -- 現在の保有者(最大1人・未設定可)
  current_holder_serial text references participants(serial) on delete set null,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (category, identifier)
);

create index idx_prop_items_holder on prop_items (current_holder_serial);
create index idx_prop_items_active on prop_items (is_archived, category);

-- =========================================================
-- 小道具の利用イベント(祭り以外も扱う)
-- =========================================================

create table prop_events (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('festival','project','practice','other')),
  -- kind='festival' のときのみ任意で既存の祭りと紐付ける
  festival_id uuid references festivals(id) on delete set null,
  name        text not null,
  event_date  date,
  note        text,
  created_at  timestamptz not null default now()
);

create index idx_prop_events_date on prop_events (event_date desc);

-- イベントごとの使用予定者(保有者とは独立)
create table prop_event_assignments (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references prop_events(id) on delete cascade,
  prop_item_id uuid not null references prop_items(id) on delete cascade,
  -- null = 使用者未定
  user_serial  text references participants(serial) on delete set null,
  created_at   timestamptz not null default now(),
  unique (event_id, prop_item_id)
);

-- =========================================================
-- 受け渡し(小道具リレー)
-- =========================================================

create table prop_transfers (
  id            uuid primary key default gen_random_uuid(),
  prop_item_id  uuid not null references prop_items(id) on delete cascade,
  from_serial   text references participants(serial) on delete set null,
  to_serial     text not null references participants(serial),
  status        text not null default 'pending'
                  check (status in ('pending','completed','cancelled')),
  scheduled_at  timestamptz,
  note          text,
  created_by_serial text,
  created_by_admin  boolean not null default false,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  cancelled_at  timestamptz,
  cancelled_reason text,
  -- 自分自身への受け渡しは作成できない
  constraint prop_transfers_not_self check (from_serial is distinct from to_serial)
);

-- 同一小道具の有効な pending は同時に1件だけ
create unique index uq_prop_transfers_pending
  on prop_transfers (prop_item_id) where status = 'pending';

create index idx_prop_transfers_to on prop_transfers (to_serial) where status = 'pending';
create index idx_prop_transfers_from on prop_transfers (from_serial) where status = 'pending';

-- =========================================================
-- 履歴(受け渡し・状態変更・管理者操作をすべて追記。改変・削除しない)
-- =========================================================

create table prop_history (
  id           uuid primary key default gen_random_uuid(),
  prop_item_id uuid not null references prop_items(id) on delete cascade,
  transfer_id  uuid references prop_transfers(id) on delete set null,
  action       text not null check (action in (
                 'item_created','transfer_created','transfer_target_changed',
                 'transfer_completed','transfer_cancelled','holder_changed_by_admin',
                 'condition_changed','assignment_changed')),
  actor_serial text,                                   -- 操作者(利用者操作時)
  actor_is_admin boolean not null default false,
  from_value   text,                                   -- 変更前(シリアル・状態など)
  to_value     text,                                   -- 変更後
  note         text,
  created_at   timestamptz not null default now()
);

create index idx_prop_history_item on prop_history (prop_item_id, created_at desc);

-- =========================================================
-- シリアル → 最新のニックネーム(表示用。識別キーはあくまでシリアル)
-- =========================================================

create view participant_display as
  select distinct on (serial) serial, name, nickname
  from festival_participants
  order by serial, created_at desc;

grant select on participant_display to anon, authenticated;

-- =========================================================
-- 小道具の作成・状態変更を自動で履歴に残す
-- (受け渡し・保有者変更の履歴は各RPCが明示的に記録する)
-- =========================================================

create or replace function prop_items_history_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into prop_history (prop_item_id, action, actor_is_admin, to_value, note)
      values (new.id, 'item_created', true, new.current_holder_serial, new.display_name);
    return new;
  end if;
  if new.condition is distinct from old.condition then
    insert into prop_history
      (prop_item_id, action, actor_is_admin, from_value, to_value, note)
      values (new.id, 'condition_changed', true, old.condition, new.condition,
              new.condition_note);
  end if;
  return new;
end $$;

create trigger trg_prop_items_history
  after insert or update on prop_items
  for each row execute function prop_items_history_trigger();

-- =========================================================
-- RPC: 受け渡し予定の作成(現在の保有者本人が実行)
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
  v_item prop_items;
  v_id   uuid;
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
  if v_item.current_holder_serial is distinct from p_actor_serial then
    raise exception '小道具の状態が変更されています。最新情報を取得してください。';
  end if;
  if p_to_serial = p_actor_serial then
    raise exception '自分自身への受け渡しはできません。';
  end if;
  if not exists (select 1 from participants where serial = p_to_serial) then
    raise exception '受け渡し先のシリアルが見つかりません。';
  end if;
  if exists (select 1 from prop_transfers
             where prop_item_id = p_item_id and status = 'pending') then
    raise exception 'この小道具には受け渡し予定がすでにあります。';
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
-- RPC: 受け渡し先の変更(現在の保有者本人のみ)
-- 変更前の宛先は履歴に残り、旧受取者は受取できなくなる
-- =========================================================

create or replace function prop_change_transfer_target(
  p_transfer_id    uuid,
  p_actor_serial   text,
  p_new_to_serial  text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t    prop_transfers;
  v_item prop_items;
begin
  select * into v_t from prop_transfers where id = p_transfer_id for update;
  if not found or v_t.status <> 'pending' then
    raise exception '受け渡し情報が変更されています。最新情報を取得してください。';
  end if;
  select * into v_item from prop_items where id = v_t.prop_item_id for update;
  -- 変更できるのは現在の保有者本人だけ
  if v_t.from_serial is distinct from p_actor_serial
     or v_item.current_holder_serial is distinct from p_actor_serial then
    raise exception '小道具の状態が変更されています。最新情報を取得してください。';
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
-- RPC: 受取完了(受取予定者本人のみ)
-- transfer完了と保有者更新と履歴を1トランザクションで行う
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
-- RPC: 管理者による現在保有者の手動変更
-- pending があれば自動的にキャンセルし、履歴を残す
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
end $$;

-- =========================================================
-- RLS
--   anon(踊り子): SELECT のみ。更新は上記RPC経由だけ
--   authenticated(管理者): 参照・更新可(履歴は追記のみで削除・改変不可)
-- =========================================================

alter table prop_items enable row level security;
alter table prop_events enable row level security;
alter table prop_event_assignments enable row level security;
alter table prop_transfers enable row level security;
alter table prop_history enable row level security;

create policy "anon read prop_items" on prop_items for select to anon using (true);
create policy "anon read prop_events" on prop_events for select to anon using (true);
create policy "anon read prop_event_assignments"
  on prop_event_assignments for select to anon using (true);
create policy "anon read prop_transfers" on prop_transfers for select to anon using (true);
create policy "anon read prop_history" on prop_history for select to anon using (true);

create policy "admin all prop_items"
  on prop_items for all to authenticated using (true) with check (true);
create policy "admin all prop_events"
  on prop_events for all to authenticated using (true) with check (true);
create policy "admin all prop_event_assignments"
  on prop_event_assignments for all to authenticated using (true) with check (true);
create policy "admin all prop_transfers"
  on prop_transfers for all to authenticated using (true) with check (true);

-- 履歴は追記と参照のみ(更新・削除ポリシーを作らない)
create policy "admin read prop_history"
  on prop_history for select to authenticated using (true);
create policy "admin insert prop_history"
  on prop_history for insert to authenticated with check (true);

-- 受け渡し予定の作成は小道具担当(管理画面)のみ。
-- 踊り子側に許可するのは「受け渡し先の変更」と「自分宛ての受取完了」だけ。
grant execute on function prop_create_transfer(uuid, text, text, timestamptz, text)
  to authenticated;
grant execute on function prop_change_transfer_target(uuid, text, text)
  to anon, authenticated;
grant execute on function prop_complete_transfer(uuid, text) to anon, authenticated;
grant execute on function prop_admin_set_holder(uuid, text, text) to authenticated;
