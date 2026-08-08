-- push_subscriptions の DELETE ポリシーを作成し直し、溜まった無効な購読を全削除する。
-- SQL Editor に貼り付けて Run してください。
--
-- 背景: DELETE ポリシーが存在しなかったため、通知オフ時の購読削除が
-- 全て空振りし、無効な購読が蓄積して送信時に HTTP 410 が多発していた。

drop policy if exists "public delete push_subscriptions" on push_subscriptions;

create policy "public delete push_subscriptions"
  on push_subscriptions for delete to anon, authenticated using (true);

-- 蓄積した購読を全削除(各端末はアプリを開けば自動で再登録される)
truncate push_subscriptions;
