import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  AdminFestivalProvider,
  useAdminFestival,
} from "../../context/AdminFestivalContext";
import { supabase } from "../../lib/supabase";

function FestivalSelector() {
  const { festivals, festival, selectFestival } = useAdminFestival();
  if (festivals.length <= 1) {
    return (
      <span className="max-w-24 truncate text-sm text-slate-300">
        {festival?.name ?? ""}
      </span>
    );
  }
  return (
    <select
      value={festival?.id ?? ""}
      onChange={(e) => selectFestival(e.target.value)}
      className="max-w-40 truncate rounded-lg bg-slate-700 px-2 py-1 text-sm text-white"
    >
      {festivals.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}

const tabs = [
  { to: "/admin", end: true, label: "ホーム" },
  { to: "/admin/schedule", end: false, label: "予定" },
  { to: "/admin/locations", end: false, label: "場所" },
  { to: "/admin/announcements", end: false, label: "お知らせ" },
];

function AdminShell() {
  const { signOut } = useAuth();
  const { festival } = useAdminFestival();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100">
      <header className="sticky top-0 z-40 bg-slate-800 text-white">
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="shrink-0 text-base font-bold">運営管理</span>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <FestivalSelector />
            <NavLink
              to={festival ? `/${festival.slug}` : "/"}
              className="shrink-0 rounded-lg border border-slate-600 px-2.5 py-1 text-sm text-slate-200"
            >
              踊り子画面
            </NavLink>
            <button
              type="button"
              onClick={() => void signOut()}
              className="shrink-0 rounded-lg bg-slate-700 px-3 py-1 text-sm"
            >
              ログアウト
            </button>
          </div>
        </div>
        <nav className="grid grid-cols-4 border-t border-slate-700">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `py-2 text-center text-sm font-bold ${
                  isActive
                    ? "border-b-2 border-amber-400 text-white"
                    : "text-slate-400"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}

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
      <AdminShell />
    </AdminFestivalProvider>
  );
}
