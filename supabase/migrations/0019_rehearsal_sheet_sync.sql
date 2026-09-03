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
  -- 定期実行の対象にするか(手動の「今すぐ同期」は enabled でなくても実行できる)
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
-- RLS。設定は運営だけが読み書きする。
-- 踊り子(anon)は同期結果である rehearsal_attendances だけを見る。
-- =========================================================

alter table rehearsal_sheet_sync enable row level security;

create policy "authenticated manage rehearsal_sheet_sync"
  on rehearsal_sheet_sync for all to authenticated using (true) with check (true);

revoke all on rehearsal_sheet_sync from anon;
