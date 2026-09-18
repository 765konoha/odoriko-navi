-- =========================================================
-- 名簿シートの同期設定
--
-- 参加者の登録は貼り付けか1人ずつの追加しかなく、祭りのたびに
-- 同じ名簿を入れ直していた。Edge Function (sync-participants) が
-- シートを読みに行き、festival_participants に反映する。
-- この表はその設定と最終結果を持つ。
--
-- 出欠(rehearsal_sheet_sync)と違い、踊り子側からは一切読ませない。
--   - 名簿シートには本名が入る
--   - 画面を開いたときの自動更新をしないので anon が読む理由が無い
-- そのため enabled 列も持たない(実行は運営の「今すぐ同期」だけ)。
--
-- シートは「リンクを知っている全員が閲覧可」の共有設定を前提とする。
-- 読み取りは Edge Function(サーバー側)だけが行い、
-- シートのURLはブラウザに配らない。
-- =========================================================

create table participant_sheet_sync (
  festival_id    uuid primary key references festivals(id) on delete cascade,
  -- スプレッドシートのID(URLの /d/ と /edit の間)
  sheet_id       text not null,
  -- シート(タブ)のgid。URLの #gid= の値。空なら先頭タブを読む
  gid            text not null default '',
  last_synced_at timestamptz,
  -- 直近の結果。件数や、失敗した理由をそのまま残す
  last_result    text,
  last_ok        boolean,
  updated_at     timestamptz not null default now()
);

comment on table participant_sheet_sync is
  '名簿シートの同期設定。シートのURLを持つため anon には見せない。';

alter table participant_sheet_sync enable row level security;

create policy "authenticated manage participant_sheet_sync"
  on participant_sheet_sync for all to authenticated using (true) with check (true);

-- 踊り子(anon)には行も列も見せない
revoke all on participant_sheet_sync from anon;
