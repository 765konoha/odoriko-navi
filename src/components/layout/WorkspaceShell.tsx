import { useEffect } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import { saveAdminFestivalSlug } from "../../lib/adminCache";
import AdminShellFrame, { type AdminTab } from "./AdminShellFrame";

// 祭りの中で使う画面。タブの to は基準パスからの相対にする
function tabs(base: string): AdminTab[] {
  return [
    { to: base, end: true, label: "概要" },
    { to: `${base}/schedule`, end: false, label: "予定" },
    { to: `${base}/rehearsals`, end: false, label: "リハ" },
    { to: `${base}/locations`, end: false, label: "場所" },
    { to: `${base}/announcements`, end: false, label: "お知らせ" },
    { to: `${base}/participants`, end: false, label: "参加者" },
    { to: `${base}/baggage`, end: false, label: "荷物" },
    { to: `${base}/settings`, end: false, label: "設定" },
  ];
}

export default function WorkspaceShell() {
  const { festivalSlug } = useParams();
  const { festival, festivals, loading } = useAdminFestival();

  // 旧URLからのリダイレクト先として使うため、最後に開いた祭りを覚えておく
  useEffect(() => {
    if (festival) saveAdminFestivalSlug(festival.slug);
  }, [festival]);

  if (!festival) {
    // 一覧の取得待ちか、URLの祭りが存在しないか
    const stillLoading = loading || festivals.length === 0;
    return (
      <div className="mx-auto min-h-dvh max-w-md bg-slate-100 px-4 py-8">
        {stillLoading ? (
          <p className="text-center text-slate-500">読み込み中…</p>
        ) : (
          <div className="space-y-3">
            <p className="rounded-xl bg-white p-4 text-slate-600">
              「{festivalSlug}」という祭りは見つかりませんでした。
            </p>
            <Link
              to="/admin"
              className="block rounded-xl bg-slate-900 p-4 text-center font-bold text-white"
            >
              祭り一覧へ
            </Link>
          </div>
        )}
      </div>
    );
  }

  const base = `/admin/f/${festival.slug}`;

  return (
    <AdminShellFrame
      tabs={tabs(base)}
      header={
        <>
          <Link
            to="/admin"
            className="shrink-0 text-sm font-bold text-slate-300"
          >
            ← 一覧
          </Link>
          <span className="min-w-0 flex-1 truncate text-base font-bold">
            {festival.name}
          </span>
          {!festival.isActive && (
            <span className="shrink-0 rounded bg-slate-600 px-2 py-0.5 text-xs font-bold">
              終了
            </span>
          )}
          <Link
            to={`/${festival.slug}`}
            className="shrink-0 rounded-lg border border-slate-600 px-2.5 py-1 text-sm text-slate-200"
          >
            踊り子画面
          </Link>
        </>
      }
    >
      <Outlet />
    </AdminShellFrame>
  );
}
