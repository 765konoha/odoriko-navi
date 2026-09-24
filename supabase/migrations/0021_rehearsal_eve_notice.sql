-- =========================================================
-- リハ前日の案内を送った記録
--
-- 前日21時に「明日はリハです」を送る(notify-rehearsal-eve)。
-- 同じリハへ二度送らないよう、送れた時刻をリハ自身に持たせる。
--
-- 定期実行が何かの都合で二度走ったり、手で再実行したりしても
-- 送り直さないことを、この列だけで保証する。
-- =========================================================

alter table rehearsals
  add column eve_notified_at timestamptz;

comment on column rehearsals.eve_notified_at is
  '前日の案内(プッシュ通知)を送れた時刻。未送信は null。';

-- 前日の案内を探すのは「明日が開催で、まだ送っていないもの」なので、
-- 日付の範囲と未送信で絞れるようにしておく
create index idx_rehearsals_eve_notice
  on rehearsals (starts_at)
  where eve_notified_at is null and not is_cancelled;
