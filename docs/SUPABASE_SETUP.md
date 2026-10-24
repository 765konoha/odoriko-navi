# Supabase セットアップ手順

初めて Supabase を使う場合のセットアップ手順。所要時間は 10〜15 分程度。
すべて無料プラン(Free)の範囲で完結する。クレジットカード登録は不要。

## 1. アカウント登録

1. https://supabase.com を開き、右上の **Start your project** をクリック。
2. サインイン方法を選ぶ。**Continue with GitHub** を推奨
   (GitHub Pages で使う GitHub アカウントに揃えると管理が楽)。
   メールアドレスでも登録可。
3. 初回は組織(Organization)の作成を求められる。
   - Name: 会社名や個人名など任意(例: `plus-zero`)
   - Plan: **Free** を選択

## 2. プロジェクト作成

1. **New project** をクリック。
2. 以下を入力:
   - **Project name**: `odoriko-navi`(任意)
   - **Database Password**: 「Generate a password」で生成し、
     **必ずパスワードマネージャー等に控える**
     (DB に直接接続する時だけ使う。アプリからは使わないが、紛失すると再設定が必要)
   - **Region**: **Northeast Asia (Tokyo)** を選択
3. **Create new project** をクリック。1〜2分でプロジェクトが起動する。

## 3. テーブル作成(SQL 実行)

1. 左メニューの **SQL Editor** を開く。
2. このリポジトリの `supabase/migrations/0001_init.sql` の内容を全文コピーして貼り付け、
   右下の **Run** をクリック。
   → 「Success. No rows returned」と出れば成功。
   続けて `0002` 以降も番号順に1本ずつ同じように流す(最後の方の
   `0025_explicit_grants.sql` でアプリが使う権限が付く。7 を参照)。
3. 続けて動作確認用データを入れる場合は、同様に `supabase/seed/test_seed.sql` を
   貼り付けて Run(実行した日を「本祭1日目」としたテストデータが入る)。

確認: 左メニュー **Table Editor** を開き、`festivals` `festival_days` `locations`
`schedule_items` `announcements` の5テーブルが存在し、seed を入れた場合は
データが入っていること。

## 4. 認証設定(運営ログイン用・Phase 5 で使用)

管理者以外がアカウントを作れないようにする(このアプリでは「ログイン済み = 管理者」)。

1. 左メニュー **Authentication** → **Sign In / Providers** を開き、
   **Email** が有効(Enabled)であることを確認。
2. 同じ画面の **Allow new users to sign up** を **オフ** にして保存。
   ※ 項目が見つからない場合は Authentication → Settings 配下にある。
3. 管理者アカウントを手動作成:
   **Authentication** → **Users** → **Add user** → **Create new user** で
   運営用のメールアドレスとパスワードを入力して作成
   (「Auto Confirm User」が選べる場合はオンにする)。

## 5. 接続情報の取得

1. 左メニュー最下部の歯車 **Project Settings** → **API**
   (新しい画面では **API Keys**)を開く。
2. 以下の2つを控える:
   - **Project URL**(例: `https://abcdefghijkl.supabase.co`)
   - **anon / public キー**(`eyJ...` で始まる長い文字列、
     または `sb_publishable_...` 形式)
3. この2つをアプリ側に設定する(`.env.example` を `.env.local` にコピーして記入)。

**注意**: `service_role` キー(secret)は絶対にコピーしない・共有しない・
フロントエンドに書かない。anon キーは公開されても RLS で保護されるが、
service_role キーは全保護を無視できる。

## 6. 運用上の注意(無料プラン)

- **1週間程度アクセスがないとプロジェクトが自動休止(Paused)する。**
  祭りの前日には必ずアプリを開いて動作確認すること。
  休止していた場合はダッシュボードの **Restore** で数分で復帰できる。
- 無料枠(DB 500MB・帯域 5GB/月 等)はこのアプリの規模なら十分。

## 7. テーブルを追加するとき(権限の書き方)

Supabase は **2026-10-30 から、`public` スキーマに新しく作ったテーブルへ
Data API の権限を自動で付けなくなった。** 付け忘れると、アプリからその表を
読み書きしたときに `permission denied` になる。

テーブルを作る migration には、必ず同じファイルの中で権限を書く。

```sql
create table new_table ( ... );
alter table new_table enable row level security;
-- (ポリシーもいつもどおり作る)

-- 運営(authenticated)と Edge Function(service_role)
grant select, insert, update, delete on new_table to authenticated, service_role;
-- 踊り子が読む表なら
grant select on new_table to anon;
-- 踊り子が書く表なら(push_subscriptions のように、本当に必要なときだけ)
-- grant insert, update, delete on new_table to anon;
```

- 踊り子に見せない表(利用状況など)には、`anon` の権限を付けない。
- 行ごとの見え方・書き込みの可否は、これまでどおり RLS のポリシーで決まる。
  権限は「その表に触れてよいか」だけを決める。
- ビューを作ったときも、同じように `grant select` を書く。

### プロジェクトを作り直すとき

`supabase/migrations/` を番号順に流し直すと、`0025_explicit_grants.sql` で
既存のテーブル全部に今と同じ権限が付く。それより後に足したテーブルは、
上のとおりそれぞれの migration に権限を書いておくこと。
