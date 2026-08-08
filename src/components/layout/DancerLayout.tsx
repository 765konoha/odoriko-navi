import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function DancerLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100">
      {/* 下部ナビ(約4rem+セーフエリア)に隠れないよう余白を確保 */}
      <main className="flex-1 px-4 pt-4 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
