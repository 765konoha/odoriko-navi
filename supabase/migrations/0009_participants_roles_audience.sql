-- 参加者識別・役職別予定・個別お知らせ機能
-- SQL Editor に全文を貼り付けて Run してください。
-- ※アプリの新バージョンをデプロイする前に実行が必要です。
--   既存データはすべて「全員向け」扱いになるため、実行しても公開中のアプリの表示は変わりません。

-- =========================================================
-- 参加者マスター(シリアルのみ。名前・ニックネームは持たない)
-- =========================================================

create table participants (
  serial     text primary key,               -- 例: '001' 'K-010'(先頭0を維持するため文字列)
  created_at timestamptz not null default now()
);

-- =========================================================
-- 祭りごとの参加者
-- =========================================================

create table festival_participants (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  serial      text not null references participants(serial),
  name        text not null,
  nickname    text not null,
  created_at  timestamptz not null default now(),
  unique (festival_id, serial)
);

create index idx_festival_participants_festival
  on festival_participants (festival_id);

-- =========================================================
-- 役職(祭りごと・管理画面から追加可能)
-- =========================================================

create table festival_roles (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  name        text not null,
  -- 「番号指定なし」利用者の判定に使う既定役職(=踊り子一般)
  is_default  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (festival_id, name)
);

create index idx_festival_roles_festival on festival_roles (festival_id);

-- 参加者⇔役職(複数役職可)
create table festival_participant_roles (
  festival_participant_id uuid not null
    references festival_participants(id) on delete cascade,
  role_id uuid not null references festival_roles(id) on delete cascade,
  primary key (festival_participant_id, role_id)
);

-- =========================================================
-- 予定の表示対象
-- =========================================================

-- 既存の予定は true(全員向け)のまま挙動が変わらない
alter table schedule_items
  add column audience_all boolean not null default true;

create table schedule_item_roles (
  schedule_item_id uuid not null references schedule_items(id) on delete cascade,
  role_id          uuid not null references festival_roles(id) on delete cascade,
  primary key (schedule_item_id, role_id)
);

-- =========================================================
-- お知らせの配信対象
-- =========================================================

alter table announcements
  add column audience_type text not null default 'all'
    check (audience_type in ('all', 'roles', 'participants'));

create table announcement_roles (
  announcement_id uuid not null references announcements(id) on delete cascade,
  role_id         uuid not null references festival_roles(id) on delete cascade,
  primary key (announcement_id, role_id)
);

-- 参加者一括削除時は festival_participants の削除に連動して行が消える
create table announcement_participants (
  announcement_id uuid not null references announcements(id) on delete cascade,
  festival_participant_id uuid not null
    references festival_participants(id) on delete cascade,
  primary key (announcement_id, festival_participant_id)
);

-- =========================================================
-- プッシュ通知の購読とシリアルの紐付け
-- (今後の購読はシリアル必須。既存の購読行は null のまま=全員向けのみ受信)
-- =========================================================

alter table push_subscriptions
  add column serial text references participants(serial) on delete set null;

-- 利用者変更時に購読行のシリアルを更新できるようにする
create policy "public update push_subscriptions"
  on push_subscriptions for update to anon, authenticated
  using (true) with check (true);

-- =========================================================
-- 演舞回数集計のオン/オフ(祭りごと)
-- =========================================================

alter table festivals
  add column dance_count_enabled boolean not null default false;

-- 高知は従来どおり集計を使う
update festivals set dance_count_enabled = true where slug = 'kochi-2026';

-- =========================================================
-- 既存の祭りへ初期役職を投入
-- (新規の祭りはアプリの祭り作成時に自動で追加される)
-- =========================================================

insert into festival_roles (festival_id, name, is_default, sort_order)
select f.id, r.name, r.is_default, r.sort_order
from festivals f
cross join (values
  ('リーダー',     false, 1),
  ('踊り子一般',   true,  2),
  ('マネージャー', false, 3),
  ('歌い手・煽り', false, 4)
) as r(name, is_default, sort_order)
on conflict (festival_id, name) do nothing;

-- =========================================================
-- RLS(既存方針: anon=SELECTのみ / authenticated=全操作)
-- =========================================================

alter table participants enable row level security;
alter table festival_participants enable row level security;
alter table festival_roles enable row level security;
alter table festival_participant_roles enable row level security;
alter table schedule_item_roles enable row level security;
alter table announcement_roles enable row level security;
alter table announcement_participants enable row level security;

create policy "anon read participants"
  on participants for select to anon using (true);
create policy "anon read festival_participants"
  on festival_participants for select to anon using (true);
create policy "anon read festival_roles"
  on festival_roles for select to anon using (true);
create policy "anon read festival_participant_roles"
  on festival_participant_roles for select to anon using (true);
create policy "anon read schedule_item_roles"
  on schedule_item_roles for select to anon using (true);
create policy "anon read announcement_roles"
  on announcement_roles for select to anon using (true);
create policy "anon read announcement_participants"
  on announcement_participants for select to anon using (true);

-- プッシュ購読時に踊り子(anon)が自分のシリアルをマスターへ追加することはない
-- (マスター登録は管理画面の一括登録時のみ)ため、participants への
-- INSERT は authenticated のみとする。

create policy "admin all participants"
  on participants for all to authenticated using (true) with check (true);
create policy "admin all festival_participants"
  on festival_participants for all to authenticated using (true) with check (true);
create policy "admin all festival_roles"
  on festival_roles for all to authenticated using (true) with check (true);
create policy "admin all festival_participant_roles"
  on festival_participant_roles for all to authenticated using (true) with check (true);
create policy "admin all schedule_item_roles"
  on schedule_item_roles for all to authenticated using (true) with check (true);
create policy "admin all announcement_roles"
  on announcement_roles for all to authenticated using (true) with check (true);
create policy "admin all announcement_participants"
  on announcement_participants for all to authenticated using (true) with check (true);
