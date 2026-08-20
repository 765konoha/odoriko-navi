-- 祭りごとの天気予報取得地点
-- 天気は Open-Meteo API(緯度・経度を渡す仕様)で取得するため座標で保持する。
-- SQL Editor に貼り付けて Run してください。

alter table festivals
  add column weather_lat double precision,
  add column weather_lng double precision;

comment on column festivals.weather_lat is '天気予報の取得地点(緯度)';
comment on column festivals.weather_lng is '天気予報の取得地点(経度)';

-- 既存の高知の祭りには高知市中心部を設定(未設定時のフォールバックと同じ地点)
update festivals
  set weather_lat = 33.5597, weather_lng = 133.5388
  where slug = 'kochi-2026' and weather_lat is null;
