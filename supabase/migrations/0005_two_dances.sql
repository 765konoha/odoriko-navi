-- 2演目(Rejoice / 咲かせや)の個別カウント対応
-- SQL Editor に貼り付けて Run してください。
-- ※ローカルでの動作確認前に実行が必要です(追加のみなので公開中のアプリには影響しません)。

alter table schedule_items
  add column dances_rejoice boolean not null default false,
  add column dances_sakaseya boolean not null default false,
  add column rejoice_count numeric(4,1) not null default 0,
  add column sakaseya_count numeric(4,1) not null default 0;

-- 既存データ移行: これまでの「踊った回数」は Rejoice の回数として引き継ぐ
update schedule_items set rejoice_count = dance_count where dance_count > 0;

-- 既存の演舞は Rejoice を踊る前提にしておく(咲かせやは管理画面で個別にチェック)
update schedule_items set dances_rejoice = true where category = 'performance';

-- ※旧 dance_count 列は現在公開中のアプリが参照しているため残しています。
--   新バージョンのデプロイ後も、合計値として書き込みを継続します。
