import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminShellFrame, { type AdminTab } from "./AdminShellFrame";

// 祭りを選ばずに使う画面(祭り一覧・小道具)
const TABS: AdminTab[] = [
  { to: "/admin", end: true, label: "祭り一覧" },
  { to: "/admin/props", end: false, label: "小道具" },
];

export default function CrossFestivalShell() {
  const { signOut } = useAuth();
  return (
    <AdminShellFrame
      tabs={TABS}
      header={
        <>
          <span className="shrink-0 text-base font-bold">運営管理</span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* 最後に見ていた祭りの踊り子画面へ戻る */}
            <Link
              to="/"
              className="rounded-lg border border-slate-600 px-2.5 py-1 text-sm text-slate-200"
            >
              踊り子画面
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg bg-slate-700 px-3 py-1 text-sm"
            >
              ログアウト
            </button>
          </div>
        </>
      }
    >
      <Outlet />
    </AdminShellFrame>
  );
}
