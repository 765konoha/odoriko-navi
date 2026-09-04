import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { NormalBottomNav } from "./BottomNav";
import OfflineBanner from "./OfflineBanner";
import UserSelectScreen from "../user/UserSelectScreen";
import { useUser } from "../../context/UserContext";
import { useCanGoBack, useUserSelect } from "../../hooks/useUserSelect";
import { useDisplayNames } from "../../hooks/useDisplayNames";
import { recordSerialAccess } from "../../lib/access";

/**
 * 通常モード(日常運用)の外枠。
 * リハも小道具も祭りに紐づかないため、ここでは祭りを選ばせない。
 * 祭りの切替は祭りモードに入るときに行う。
 */
export default function NormalLayout() {
  const navigate = useNavigate();
  const { selection } = useUser();
  const { changeRequested } = useUserSelect();
  const canGoBack = useCanGoBack();
  const { names, loading } = useDisplayNames();

  // 利用状況を記録する(運営がインストール状況を確認するための緩い記録)
  useEffect(() => {
    recordSerialAccess(selection?.serial ?? null, null);
  }, [selection?.serial]);

  const showUserSelect = selection == null || changeRequested;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100">
      <OfflineBanner />
      {/* iPhoneのPWAはブラウザの戻るUIが無いため、最上部に戻る導線を常設する */}
      <div className="flex w-full items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        {canGoBack ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-sm font-medium text-slate-600"
          >
            <svg
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span className="truncate">1つ前の画面に戻る</span>
          </button>
        ) : (
          <span className="min-w-0 flex-1 py-0.5" />
        )}
      </div>
      {showUserSelect ? (
        <UserSelectScreen nicknameBySerial={names} loadingNames={loading} />
      ) : (
        <>
          {/* 下部ナビ(4rem+セーフエリア)に隠れないよう余白を確保 */}
          <main className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
            <Outlet />
          </main>
          <NormalBottomNav />
        </>
      )}
    </div>
  );
}
