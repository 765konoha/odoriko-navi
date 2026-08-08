# よさこい踊り子向け 当日行動支援Webアプリ 設計書

作成日: 2026-08-08 / 対象: 実装開始前の全体設計(Phase 0)

## 0. 現状リポジトリの確認結果と前提

- `LLMCode` 直下の `.git` は空で、git リポジトリとして機能していない。また複数案件が同居するワークスペースである。
- → 本アプリは `projects/odoriko-navi/`(名称は仮。変更可)として新規作成し、**専用の GitHub リポジトリ**を作成して GitHub Pages にデプロイする。
- 注意: GitHub Free プランでは **public リポジトリでないと GitHub Pages が使えない**。コード・データ構造に秘匿情報を含めない前提とする(Supabase の URL / anon key は公開前提で設計し、保護は RLS で行う)。

## 1. 推奨ディレクトリ構成

```text
projects/odoriko-navi/
├─ .github/workflows/deploy.yml     # GitHub Pages 自動デプロイ(Phase 8)
├─ public/
│   └─ icons/                       # PWA アイコン(Phase 7)
├─ src/
│   ├─ main.tsx / App.tsx
│   ├─ router.tsx                   # ルート定義(HashRouter)
│   ├─ pages/
│   │   ├─ dancer/                  # 踊り子側(ログイン不要)
│   │   │   ├─ HomePage.tsx
│   │   │   ├─ SchedulePage.tsx
│   │   │   ├─ MapPage.tsx
│   │   │   ├─ AnnouncementsPage.tsx
│   │   │   └─ AnnouncementDetailPage.tsx
│   │   └─ admin/                   # 運営側(Phase 5)
│   │       ├─ LoginPage.tsx
│   │       ├─ DashboardPage.tsx
│   │       ├─ ScheduleAdminPage.tsx
│   │       ├─ LocationAdminPage.tsx
│   │       └─ AnnouncementAdminPage.tsx
│   ├─ components/
│   │   ├─ layout/                  # BottomNav / DancerLayout / AdminLayout
│   │   ├─ home/                    # NextEventCard / EmergencyBanner / TodayTimeline
│   │   ├─ schedule/                # ScheduleItemCard
│   │   ├─ map/                     # LocationMap / MarkerDetail / LayerFilter
│   │   └─ announcements/           # AnnouncementListItem / PriorityBadge
│   ├─ hooks/
│   │   ├─ useNow.ts                # 現在時刻(1分毎更新)→残り時間表示
│   │   ├─ useFestivalData.ts       # データ取得+キャッシュ+再取得
│   │   ├─ useReadStatus.ts         # 既読/確認済み(localStorage)
│   │   └─ useOnlineStatus.ts       # オンライン/オフライン判定
│   ├─ repositories/                # ★データ取得層(差し替えの要)
│   │   ├─ types.ts                 # FestivalRepository インターフェース
│   │   ├─ mockRepository.ts        # Phase 2〜3 で使用
│   │   └─ supabaseRepository.ts    # Phase 4 で差し替え
│   ├─ data/mock/                   # Phase 2〜3 の固定データ(2026高知よさこい想定)
│   ├─ lib/
│   │   ├─ supabase.ts              # クライアント初期化(Phase 4)
│   │   ├─ storage.ts               # localStorage キー管理を1箇所に集約
│   │   └─ time.ts                  # 時刻整形・残り時間計算
│   └─ types/domain.ts              # ScheduleItem / Location / Announcement 等
├─ supabase/migrations/             # スキーマ・RLS の SQL(Phase 4)
├─ index.html
├─ vite.config.ts
└─ package.json
```

設計の要点:

- **repositories 層でデータ取得を抽象化**する。Phase 2〜3 は `mockRepository`、Phase 4 で `supabaseRepository` に差し替える。UI 側は一切変更しない。これが「UI 完成後に Supabase 導入」を安全に行う仕組み。
- localStorage のキーは `lib/storage.ts` に集約し、`odoriko:{festivalSlug}:read` のように**祭りスラッグでスコープ**する(複数祭り対応)。
- 過剰な抽象化はしない。状態管理ライブラリは入れず、React 標準の hooks + context のみ。

## 2. 使用ライブラリ

| 用途 | ライブラリ | 備考 |
|---|---|---|
| UI | react / react-dom (v19) | |
| ルーティング | react-router-dom (v7) | **HashRouter** を使用(理由は §5) |
| ビルド | vite (v6) + @vitejs/plugin-react | |
| CSS | tailwindcss (v4) + @tailwindcss/vite | 設定ファイル不要の CSS-first 構成 |
| 型 | typescript (v5) | |
| 地図 | leaflet + react-leaflet (v5) | OSM タイル。有料 API なし |
| DB/Auth | @supabase/supabase-js (v2) | Phase 4 から |
| PWA | vite-plugin-pwa | Workbox ベース。Phase 7 から |

入れないもの: 状態管理ライブラリ、日付ライブラリ(`Intl` + 自前ユーティリティで足りる)、UI コンポーネントライブラリ、TanStack Query(再取得は小さな自前 hook で十分。オフライン用に localStorage への永続キャッシュが必要で、自前実装の方が単純)。

## 3. 各 Phase で作成する内容

| Phase | 作るもの | 完了条件 |
|---|---|---|
| 1 基盤 | Vite + React + TS + Tailwind + HashRouter。4画面の空ページと下部固定ナビ(ホーム/予定/マップ/お知らせ)。base path 設定。 | スマホ幅で4画面を行き来できる |
| 2 踊り子UI | mock データで4画面を完成。ホーム=次の予定カード(集合まで残り◯分・地図/Google Maps リンク)+本日の簡易スケジュール。予定=演舞カード形式の時系列一覧(未確定・中止表現含む)。マップ=Leaflet+集合場所/トイレのフィルター+マーカー詳細。お知らせ=一覧と詳細。 | ホームで「次にどこへ何時に行くか」がスクロールなしで分かる |
| 3 未読管理 | 既読の localStorage 管理、下部ナビの未読バッジ(件数)、emergency のホーム強制表示と「確認しました」管理。 | 既読・確認済みがリロード後も保持される |
| 4 Supabase | テーブル作成(§4 の SQL)、RLS、`supabaseRepository` 実装、mock からの差し替え。 | 踊り子側4画面が Supabase のデータで動く |
| 5 管理画面 | Supabase Auth ログイン、/admin 配下にダッシュボード・スケジュール管理・場所管理(地図タップで座標入力)・お知らせ管理。スマホ操作前提の簡素なフォーム。 | 運営がスマホから予定変更・緊急連絡を配信できる |
| 6 反映 | 画面表示時(visibilitychange)・アプリ復帰時・手動更新ボタンでの再取得。 | 運営の変更が踊り子端末の復帰時に反映される。Realtime はこれで不足する場合のみ追加 |
| 7 PWA | vite-plugin-pwa 導入、アプリシェルのキャッシュ、データの localStorage スナップショット(最終取得日時つき)、オフラインバナー「オフライン表示中 / 最終更新 HH:MM」。地図タイルはキャッシュしない。 | 機内モードでスケジュール・お知らせ・集合場所情報が閲覧できる |
| 8 デプロイ | GitHub Actions(main push → build → Pages)。Secrets から環境変数注入。 | 公開 URL でスマホから動作 |

## 4. 想定する Supabase テーブル構造

```sql
-- 祭り(マルチ祭り対応の起点。URL の /#/{slug}/... と対応)
create table festivals (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,          -- 例: kochi-2026
  name       text not null,                 -- 例: 2026年 高知よさこい
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- 開催日(前夜祭・本祭1日目など)
create table festival_days (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  date        date not null,
  label       text,                         -- 例: 本祭1日目
  sort_order  int not null default 0,
  unique (festival_id, date)
);

-- 場所(集合場所・トイレのみ。手動登録可)
create table locations (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  kind        text not null check (kind in ('meeting_point', 'toilet')),
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  address     text,
  description text,                         -- 補足説明・注意事項
  created_at  timestamptz not null default now()
);

-- 行動予定(集合と演舞は1レコード=1カード)
create table schedule_items (
  id                  uuid primary key default gen_random_uuid(),
  festival_day_id     uuid not null references festival_days(id) on delete cascade,
  title               text not null,        -- 例: 追手筋本部競演場
  category            text not null check (category in
                        ('performance','gather','practice','move','break','dismiss','other')),
  gather_time         timestamptz,          -- 集合時間
  start_time          timestamptz,          -- 開始/演舞時間
  end_time            timestamptz,
  venue_name          text,                 -- 会場名
  meeting_location_id uuid references locations(id) on delete set null,  -- 集合場所との紐付け
  notes               text,                 -- 注意事項
  is_confirmed        boolean not null default true,
  tbd_note            text,                 -- 未確定時の表示文(例: 17:30頃予定・当日連絡)
  is_cancelled        boolean not null default false,
  sort_order          int not null default 0
);

-- お知らせ
create table announcements (
  id           uuid primary key default gen_random_uuid(),
  festival_id  uuid not null references festivals(id) on delete cascade,
  title        text not null,
  body         text not null,
  priority     text not null default 'normal'
                 check (priority in ('normal','important','emergency')),
  published_at timestamptz not null default now(),
  expires_at   timestamptz,                 -- null = 無期限
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

設計判断:

- **「次の予定」の算出**はクライアント側で行う: 当日の `schedule_items` から `is_cancelled = false` かつ `coalesce(gather_time, start_time) >= 現在時刻` の最初の1件。
- 集合(16:00)と演舞(16:24)は `gather_time` / `start_time` として**1レコードに持つ**ため、指示どおり1つの演舞カードにまとめられる。単独の「練習」「移動」等は `category` を変えて同じテーブルで表現する。
- マップの集合場所詳細に出す「関連する演舞・集合時間」は `schedule_items.meeting_location_id` の逆引きで導出する。
- 時刻は `timestamptz`(UTC 保存・表示は Asia/Tokyo 固定)。時系列ソートと残り時間計算が単純になる。
- 「チーム」テーブルは作らない。本アプリは1チームの行動予定共有であり、festival = そのチームのその祭りへの参加、と読み替えて運用する(将来複数チーム化する場合に teams を追加できる構造ではある)。

### RLS 方針

- 全テーブルで RLS 有効化。
- **anon(踊り子)**: SELECT のみ。`announcements` は `published_at <= now() and (expires_at is null or expires_at > now())` の行のみ。他テーブルは全行 SELECT 可(公開情報のみ格納する前提)。
- **authenticated(運営)**: 全テーブル INSERT / UPDATE / DELETE 可。
- 権限管理を単純化するため、**Supabase Auth のセルフサインアップを無効化**し、管理者アカウントはダッシュボードから招待発行する。「authenticated = 管理者」が成り立つので admin テーブルや role カラムが不要になる(要件の「複雑な権限管理は不要」に対応)。
- service_role key はフロントに置かない。フロントで使うのは URL + anon key のみ(公開されても RLS で保護される)。

## 5. GitHub Pages で問題になりそうな点と対策

1. **base path**: Pages の URL は `https://<user>.github.io/<repo>/`。`vite.config.ts` に `base: '/<repo>/'` を設定し、アセット参照は `import.meta.env.BASE_URL` 経由にする。
2. **SPA リロード時の 404**: Pages はサーバー側リライトができない。**HashRouter を採用**して回避する(URL は `/#/schedule` 形式)。404.html コピーによる BrowserRouter 延命策もあるが、直リンク時に一瞬 404 を経由する・SW との相性が悪いなど不安定要素が多く、共有 URL をスマホで開く本アプリの用途では確実性を優先する。
3. **環境変数**: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を GitHub Actions の Secrets に置き、ビルド時に注入。anon key はバンドルに含まれ公開されるが、それは Supabase の設計上の前提(保護は RLS)。
4. **Leaflet のマーカー画像**: バンドラー環境でデフォルトアイコンのパスが壊れる既知問題。アイコン URL を明示的に import して設定する。
5. **PWA のスコープ**: manifest の `start_url` / `scope`、Service Worker の登録パスをすべて base 配下に揃える(vite-plugin-pwa が base 設定を反映するが、要検証項目)。
6. **リポジトリ公開範囲**: GitHub Free では public リポジトリのみ Pages 可。集合場所の座標・予定はアプリ上でも公開情報なので問題ない想定だが、リポジトリに顧客名等を書かない運用とする。
7. **デプロイ方式**: 公式の `actions/upload-pages-artifact` + `actions/deploy-pages` を使用(gh-pages ブランチ不要)。

## 6. 技術的な懸念点

1. **Supabase 無料プランの自動休止**: 1週間程度アクセスがないとプロジェクトが一時停止し、復帰に数十秒〜失敗のリスクがある。**祭り前日に必ずアクセス確認する運用**を前提にする(緊急時はダッシュボードから手動再開)。
2. **既読状態の端末内管理の限界**: localStorage は「ブラウザで開いた場合」と「ホーム画面に追加した PWA」でストレージが分かれる(特に iOS)。同じ人でも既読状態が引き継がれないケースがあるが、実害は「バッジが再表示される」程度なので許容する。
3. **プッシュ通知はない**: emergency は取得型(画面表示時・復帰時の再取得)でしか届かない。「アプリを開けば必ず気付く」ことを保証する設計(ホーム強制表示)とし、即時性が課題になった時点で Phase 6 の Supabase Realtime を追加する。
4. **オフライン時の地図**: タイルは大量キャッシュしない方針のため、オフライン時は地図が描画できない。マーカー情報(場所名・住所・注意事項)を**テキスト一覧でも見られるフォールバック**をマップ画面に用意する。
5. **端末時計への依存**: 「集合まで◯分」は端末時計で計算する。通常のスマホは NTP 同期されているため許容する。
6. **iOS Safari の SW 制約**: PWA のキャッシュ挙動が Android と異なるため、Phase 7 では実機(iOS/Android 両方)での機内モード検証を完了条件に含める。
7. **ライブラリのバージョン整合**: react-leaflet v5 は React 19 必須。React 19 + Router v7 + Tailwind v4 の組み合わせで最初に固定し、途中でメジャーバージョンを混ぜない。

## 7. 実装順序

指示どおり Phase 1 → 8 の順で、**各 Phase 完了時にユーザー確認を挟んでから次へ進む**。

1. **Phase 1**: プロジェクト雛形 + 4画面の枠 + 下部ナビ(DB なし)
2. **Phase 2**: mock データで踊り子側4画面を完成(UI/UX の確定が最優先)
3. **Phase 3**: 未読バッジ・既読管理・emergency 強制表示(まだ mock)
4. **Phase 4**: Supabase 導入(スキーマ・RLS・repository 差し替え)
5. **Phase 5**: 運営管理画面(Auth + CRUD)
6. **Phase 6**: 復帰時再取得・手動更新(必要になった場合のみ Realtime)
7. **Phase 7**: PWA・オフラインキャッシュ・最終更新表示
8. **Phase 8**: GitHub Actions → GitHub Pages 自動デプロイ

※ Phase 8 の CI 自体は最後だが、base path や HashRouter など Pages 前提の設定は Phase 1 の時点で組み込んでおく(後から直すとリンク切れの温床になるため)。

## 確認したい点(実装開始前)

1. プロジェクト名・リポジトリ名: 仮に `odoriko-navi` としたが、希望があれば変更する。
2. URL 形式: `/#/{festivalSlug}/...`(例: `/#/kochi-2026/schedule`)として複数祭りを URL で切り替える設計でよいか。
3. GitHub リポジトリは public で作成してよいか(Free プランで Pages を使う前提)。
