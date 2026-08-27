import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export interface AdminTab {
  to: string;
  end: boolean;
  label: string;
}

/**
 * 管理画面の共通の枠。
 * タブは数が増えても崩れないよう横スクロールにする。
 */
export default function AdminShellFrame({
  header,
  tabs,
  children,
}: {
  header: ReactNode;
  tabs: AdminTab[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100">
      <header className="sticky top-0 z-40 bg-slate-800 text-white">
        <div className="flex items-center gap-2 px-4 py-3">{header}</div>
        <nav className="flex overflow-x-auto border-t border-slate-700">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `shrink-0 px-2.5 py-2.5 text-center text-sm font-bold ${
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
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
