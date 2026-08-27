import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { AdminFestivalProvider } from "../../context/AdminFestivalContext";
import { supabase } from "../../lib/supabase";

/**
 * 管理画面の土台。ログイン確認と祭り一覧の読み込みだけを担う。
 * 画面の枠(ヘッダー・タブ)は配下の CrossFestivalShell / WorkspaceShell が持つ。
 */
export default function AdminLayout() {
  const { session, loading } = useAuth();

  if (!supabase) {
    return (
      <p className="px-4 py-8 text-center text-slate-600">
        Supabase が設定されていないため管理画面は使用できません。
      </p>
    );
  }
  if (loading) {
    return <p className="px-4 py-8 text-center text-slate-500">読み込み中…</p>;
  }
  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <AdminFestivalProvider>
      <Outlet />
    </AdminFestivalProvider>
  );
}
