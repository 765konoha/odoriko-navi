-- =========================================================
-- ビューを SECURITY INVOKER に変更する
--
-- PostgreSQL 15 以降、ビューは既定で「作成者の権限」で動作し、
-- 元テーブルの RLS を通らない(SECURITY DEFINER 相当)。
-- Supabase のセキュリティリンターはこれを CRITICAL として検出する。
--
-- security_invoker = on にすると「参照した人の権限」で動くようになり、
-- 元テーブルの RLS がそのまま適用される。
--
-- 参照先の RLS は以下のとおりで、この変更で挙動は変わらない:
--   festival_participants : anon=SELECT可 / authenticated=全操作
--   festivals             : anon=SELECT可 / authenticated=全操作
--   serial_access         : authenticated のみ(anon はビュー自体も権限なし)
-- =========================================================

-- 小道具画面でシリアル→表示名を引くためのビュー(踊り子=anon も参照する)
alter view participant_display set (security_invoker = on);

-- 利用状況の確認用ビュー(運営=authenticated のみ参照する)
alter view participant_access_status set (security_invoker = on);
