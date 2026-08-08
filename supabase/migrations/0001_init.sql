-- 踊り子ナビ 初期スキーマ + RLS
-- Supabase ダッシュボードの SQL Editor に全文を貼り付けて Run してください。

-- =========================================================
-- テーブル
-- =========================================================

-- 祭り(マルチ祭り対応の起点。URL の /#/{slug}/... と対応)
create table festivals (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,          -- 例: kochi-2026
  name       text not null,                 -- 例: 2026年 高知よさこい
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- 開催日(本祭1日目など)
create table festival_days (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  date        date not null,
  label       text,
  sort_order  int not null default 0,
  unique (festival_id, date)
);

-- 場所(集合場所・トイレのみ。仮設トイレ等の手動登録もこのテーブル)
create table locations (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  kind        text not null check (kind in ('meeting_point', 'toilet')),
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  address     text,
  description text,
  created_at  timestamptz not null default now()
);

-- 行動予定(集合と演舞は1レコード=踊り子側では1カード)
create table schedule_items (
  id                  uuid primary key default gen_random_uuid(),
  festival_day_id     uuid not null references festival_days(id) on delete cascade,
  title               text not null,
  category            text not null check (category in
                        ('performance','gather','practice','move','break','dismiss','other')),
  gather_time         timestamptz,          -- 集合時間
  start_time          timestamptz,          -- 開始/演舞時間
  end_time            timestamptz,
  venue_name          text,
  meeting_location_id uuid references locations(id) on delete set null,
  notes               text,                 -- 注意事項
  is_confirmed        boolean not null default true,
  tbd_note            text,                 -- 未確定時の表示文(例: 17:30頃予定・当日連絡)
  is_cancelled        boolean not null default false,
  sort_order          int not null default 0
);

-- お知らせ
create table announcements (
  id           uuid primary key default gen_random_uuid(),
  festival_id  uuid not null references festivals(id) on delete cascade,
  title        text not null,
  body         text not null,
  priority     text not null default 'normal'
                 check (priority in ('normal','important','emergency')),
  published_at timestamptz not null default now(),
  expires_at   timestamptz,                 -- null = 無期限
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =========================================================
-- インデックス
-- =========================================================

create index idx_festival_days_festival on festival_days (festival_id, sort_order);
create index idx_locations_festival on locations (festival_id);
create index idx_schedule_items_day on schedule_items (festival_day_id, sort_order);
create index idx_announcements_festival on announcements (festival_id, published_at desc);

-- =========================================================
-- Row Level Security
--   anon(踊り子・未ログイン): SELECT のみ。お知らせは公開中のものだけ。
--   authenticated(運営・ログイン済): 全操作可。
--   ※ セルフサインアップを無効化する前提(authenticated = 管理者)。
-- =========================================================

alter table festivals enable row level security;
alter table festival_days enable row level security;
alter table locations enable row level security;
alter table schedule_items enable row level security;
alter table announcements enable row level security;

-- 公開読み取り(anon)
create policy "anon read festivals"
  on festivals for select to anon using (true);

create policy "anon read festival_days"
  on festival_days for select to anon using (true);

create policy "anon read locations"
  on locations for select to anon using (true);

create policy "anon read schedule_items"
  on schedule_items for select to anon using (true);

-- お知らせは「公開日時を過ぎていて、公開終了していない」ものだけ
create policy "anon read published announcements"
  on announcements for select to anon
  using (
    published_at <= now()
    and (expires_at is null or expires_at > now())
  );

-- 運営(authenticated)は全操作可
create policy "admin all festivals"
  on festivals for all to authenticated using (true) with check (true);

create policy "admin all festival_days"
  on festival_days for all to authenticated using (true) with check (true);

create policy "admin all locations"
  on locations for all to authenticated using (true) with check (true);

create policy "admin all schedule_items"
  on schedule_items for all to authenticated using (true) with check (true);

create policy "admin all announcements"
  on announcements for all to authenticated using (true) with check (true);
