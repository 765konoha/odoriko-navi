-- =========================================================
-- リハ前日の案内を Supabase の中から定時に起動する
--
-- 0021 では GitHub Actions の定期実行から notify-rehearsal-eve を
-- 呼んでいたが、Actions の定期実行は混雑で数時間遅れることがあり、
-- 実際に 21時の予定が 1時半に走った。日付をまたぐと関数は送らずに
-- 見送るので、その夜の案内が出ない。
--
-- pg_cron なら時刻どおりに動くので、起動をこちらへ移す。
-- 呼び出しは pg_net(非同期の HTTP)で行う。
--
-- 接続先とキーは Vault から読む。値はリポジトリに置かない。
-- このファイルを流す前に、SQL Editor で次の3つを Vault に入れておくこと。
--   odoriko_project_url     … https://<project-ref>.supabase.co
--   odoriko_publishable_key … sb_publishable_... (アプリと同じ公開キー)
--   odoriko_cron_secret     … Edge Function の Secrets の CRON_SECRET と同じ値
-- =========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 21:00 JST = 12:00 UTC(pg_cron は UTC で動く)。
-- 同じ名前で再実行すると上書きされる。
select cron.schedule(
  'notify-rehearsal-eve',
  '0 12 * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
             where name = 'odoriko_project_url')
           || '/functions/v1/notify-rehearsal-eve',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- 新しい形式のキーは apikey ヘッダで渡す(Bearer だけでは入口で弾かれる)
      'apikey', (select decrypted_secret from vault.decrypted_secrets
                  where name = 'odoriko_publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                      where name = 'odoriko_publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'odoriko_cron_secret')
    ),
    body := '{}'::jsonb,
    -- 既定の5秒では端末が多いと待ちきれないことがあるため長めに取る
    timeout_milliseconds := 60000
  );
  $job$
);
