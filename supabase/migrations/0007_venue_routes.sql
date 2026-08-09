-- 演舞会場コース(地図上の帯状ライン)
-- SQL Editor に貼り付けて Run してください。
-- ※ローカルでの動作確認前に実行が必要です(追加のみ・公開中アプリに影響なし)。

create table venue_routes (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  name        text not null,               -- 例: 追手筋本部競演場
  path        jsonb not null,              -- [[lat,lng], ...] 折れ線の座標列
  description text,
  created_at  timestamptz not null default now()
);

alter table venue_routes enable row level security;

create policy "anon read venue_routes"
  on venue_routes for select to anon using (true);

create policy "admin all venue_routes"
  on venue_routes for all to authenticated using (true) with check (true);

-- 演舞予定と会場コースの紐付け(集合場所と同じ方式)
alter table schedule_items
  add column venue_route_id uuid references venue_routes(id) on delete set null;
