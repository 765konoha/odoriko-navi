-- 場所の種別に「更衣室」を追加
-- SQL Editor に貼り付けて Run してください。
-- (アプリの新バージョンをデプロイする前に実行してください)

alter table locations drop constraint locations_kind_check;
alter table locations add constraint locations_kind_check
  check (kind in ('meeting_point', 'toilet', 'changing_room'));
