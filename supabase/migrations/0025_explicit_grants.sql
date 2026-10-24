-- =========================================================
-- テーブルの権限を明示する
--
-- Supabase は 2026-10-30 から、public スキーマに新しく作ったテーブルへ
-- Data API(supabase-js / PostgREST)の権限を自動では付けなくなる。
-- 既存のテーブルは今の権限のまま使えるが、次の場合は権限が付かない。
--   * 新しいテーブルを追加したとき
--   * プロジェクトを作り直して migration を最初から流し直したとき
--
-- これまでの migration は自動の権限に頼っていたので、アプリが必要と
-- する権限をここで明示する。流し直したときも、最後にこれが流れれば
-- 元どおりに使える。
--
-- 本番で流しても何も変わらない(すでに付いている権限と同じものを付ける
-- だけで、外すものは無い)。何度流してもよい。
--
-- 行ごとの見え方・書き込みの可否は、これまでどおり RLS のポリシーで決まる。
-- ここで付けるのは「その表に触れてよいか」だけ。
--
-- 今後テーブルを足すときは、その migration に同じ形で grant を書くこと
-- (docs/SUPABASE_SETUP.md の「テーブルを追加するとき」)。
-- =========================================================

-- 運営(authenticated)と Edge Function(service_role)は全ての表に触れる。
-- service_role は RLS を通らないが、表の権限は別に要る
grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

-- 踊り子(anon)が読む表。どれも RLS で「anon read」のポリシーがある
grant select on
  announcement_participants,
  announcement_roles,
  announcements,
  baggage_groups,
  festival_days,
  festival_participant_roles,
  festival_participants,
  festival_roles,
  festivals,
  locations,
  participants,
  prop_event_assignments,
  prop_events,
  prop_history,
  prop_item_co_holders,
  prop_items,
  prop_transfer_receivers,
  prop_transfers,
  push_subscriptions,
  rehearsal_attendances,
  rehearsals,
  schedule_item_roles,
  schedule_items,
  venue_routes,
  weather_daily,
  weather_hourly
  to anon;

-- 踊り子(anon)が書く表
--   push_subscriptions … 通知のオン・オフ、利用者の切り替え
--   weather_*          … 天気予報の取得結果を端末どうしで使い回すキャッシュ
grant insert, update, delete on push_subscriptions, weather_daily, weather_hourly
  to anon;

-- 出欠シートの設定は、最終同期の日時だけを踊り子に見せる(0019 と同じ)。
-- シートのURLは見せない
grant select (festival_id, last_synced_at) on rehearsal_sheet_sync to anon;

-- ビュー
grant select on participant_display to anon, authenticated;

-- 踊り子に見せない表・ビュー(0013・0019 で anon から外したもの)には
-- ここでも anon の権限を付けない
--   serial_access(利用状況)/ participant_access_status / rehearsal_sheet_sync(表全体)
