-- =========================================================
-- 出欠シートの同期設定
--
-- 出欠はエントリーフォームの回答シートで日々更新されるため、
-- 貼り付けによる手動取り込みでは追いつかない。
-- Edge Function (sync-rehearsal-attendance) がシートを読みに行き、
-- rehearsal_attendances に反映する。この表はその設定と最終結果を持つ。
--
-- シートは「リンクを知っている全員が閲覧可」の共有設定を前提とする。
-- 読み取りは Edge Function(サーバー側)だけが行い、
-- シートのURLはブラウザに配らない。
-- =========================================================

create table rehearsal_sheet_sync (
  festival_id    uuid primary key references festivals(id) on delete cascade,
  -- スプレッドシートのID(URLの /d/ と /edit の間)
  sheet_id       text not null,
  -- シート(タブ)のgid。URLの #gid= の値。先頭シートは 0
  gid            text not null default '0',
  -- 画面を開いたときに自動で更新するか
  -- (運営の「今すぐ同期」は enabled でなくても実行できる)
  enabled        boolean not null default true,
  last_synced_at timestamptz,
  -- 直近の結果。成功件数や、失敗した理由をそのまま残す
  last_result    text,
  last_ok        boolean,
  updated_at     timestamptz not null default now()
);

comment on table rehearsal_sheet_sync is
  '出欠シートの同期設定。シートのURLを持つため anon には見せない。';

-- =========================================================
-- RLS。
-- 設定(シートのURL)は運営だけが読み書きする。
-- 踊り子には last_synced_at だけを見せる。画面を開いたときに
-- 「古ければ更新を頼む」を判断させ、無駄な関数呼び出しを避けるため。
-- 列単位の権限で絞るので、ビューを増やさずに済む。
-- =========================================================

alter table rehearsal_sheet_sync enable row level security;

create policy "authenticated manage rehearsal_sheet_sync"
  on rehearsal_sheet_sync for all to authenticated using (true) with check (true);

create policy "anon read rehearsal_sheet_sync"
  on rehearsal_sheet_sync for select to anon using (true);

-- 既定の権限を落としたうえで、最終同期時刻だけを許可する
-- (sheet_id / gid / last_result を select しようとすると権限エラーになる)
revoke all on rehearsal_sheet_sync from anon;
grant select (festival_id, last_synced_at) on rehearsal_sheet_sync to anon;
