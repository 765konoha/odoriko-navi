import { Outlet } from "react-router-dom";
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
          <button
            type="button"
            onClick={() => void signOut()}
            className="ml-auto shrink-0 rounded-lg bg-slate-700 px-3 py-1 text-sm"
          >
            ログアウト
          </button>
        </>
      }
    >
      <Outlet />
    </AdminShellFrame>
  );
}
