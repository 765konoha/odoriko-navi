-- 演舞回数の集計: 完了フラグと踊った回数(0.5回単位)を追加
-- SQL Editor に貼り付けて Run してください。
-- ※ローカル(localhost)での動作確認前に実行が必要です。

alter table schedule_items
  add column is_completed boolean not null default false,
  add column dance_count numeric(4,1) not null default 0;
