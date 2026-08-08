-- プッシュ通知の購読情報
-- SQL Editor に貼り付けて Run してください。

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

-- 踊り子(未ログイン)が自分の端末の購読を登録・解除できるようにする。
-- endpoint は推測不可能なURLのため、SELECT は誰にも許可しない
-- (送信処理は Edge Function が service_role で行う)。
create policy "public insert push_subscriptions"
  on push_subscriptions for insert to anon, authenticated with check (true);

create policy "public delete push_subscriptions"
  on push_subscriptions for delete to anon, authenticated using (true);
