-- 天気予報のキャッシュテーブル(Open-Meteoの取得結果を全端末で共有)
-- SQL Editor に貼り付けて Run してください。
-- ※ローカルでの動作確認前に実行が必要です。

-- 1時間ごとの予報
create table weather_hourly (
  id                        uuid primary key default gen_random_uuid(),
  festival_id               uuid not null references festivals(id) on delete cascade,
  time                      timestamptz not null,  -- 正時(1時間枠)
  temperature               numeric(4,1) not null, -- ℃
  weather_code              int not null,          -- WMOコード
  precipitation_probability int,                   -- 降水確率%
  fetched_at                timestamptz not null default now(),
  unique (festival_id, time)
);

-- 日別の予報(天気・最高/最低気温)
create table weather_daily (
  id           uuid primary key default gen_random_uuid(),
  festival_id  uuid not null references festivals(id) on delete cascade,
  date         date not null,
  weather_code int not null,
  temp_max     numeric(4,1) not null,
  temp_min     numeric(4,1) not null,
  fetched_at   timestamptz not null default now(),
  unique (festival_id, date)
);

alter table weather_hourly enable row level security;
alter table weather_daily enable row level security;

-- 誰でも読み書き可(公開気象データのキャッシュであり秘匿性はない。
-- 更新は「1時間経過後に最初にアプリを開いた端末」が代行する)
create policy "public all weather_hourly"
  on weather_hourly for all to anon, authenticated
  using (true) with check (true);

create policy "public all weather_daily"
  on weather_daily for all to anon, authenticated
  using (true) with check (true);
