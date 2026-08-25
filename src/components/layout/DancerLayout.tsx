import { useEffect } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import BottomNav from "./BottomNav";
import OfflineBanner from "./OfflineBanner";
import FestivalSwitcher from "./FestivalSwitcher";
import UserSelectScreen from "../user/UserSelectScreen";
import { FestivalDataProvider } from "../../context/FestivalDataContext";
import { ReadStatusProvider } from "../../context/ReadStatusContext";
import { useUser } from "../../context/UserContext";
import { useCanGoBack, useUserSelect } from "../../hooks/useUserSelect";
import { useViewer } from "../../hooks/useViewer";
import { saveLastFestivalSlug } from "../../lib/storage";

/** 選択中シリアルが今回の祭りに不参加の場合の注意表示 */
function NotParticipatingBanner() {
  const viewer = useViewer();
  const { requestChange } = useUserSelect();
  if (!viewer.notParticipating) return null;
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
      <p className="min-w-0 flex-1 text-xs font-medium text-amber-900">
        シリアル {viewer.serial} は今回のお祭りには不参加のため、番号指定なしとして表示しています。
      </p>
      <button
        type="button"
        onClick={requestChange}
        className="shrink-0 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-bold text-amber-900"
      >
        変更
      </button>
    </div>
  );
}

export default function DancerLayout() {
  const { festivalSlug } = useParams();
  const navigate = useNavigate();
  const { selection, userKey } = useUser();
  const { changeRequested } = useUserSelect();
  const canGoBack = useCanGoBack();

  // 次回ルート直下(/)アクセス時にこの祭りへリダイレクトする
  useEffect(() => {
    if (festivalSlug) saveLastFestivalSlug(festivalSlug);
  }, [festivalSlug]);

  const showUserSelect = selection == null || changeRequested;

  return (
    <FestivalDataProvider slug={festivalSlug!}>
      <ReadStatusProvider slug={festivalSlug!} userKey={userKey}>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100">
          <OfflineBanner />
          {/* iPhoneのPWAはブラウザの戻るUIが無いため、最上部に戻る導線を常設する。
              右側に祭り切替のプルダウンを置く */}
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
            <FestivalSwitcher slug={festivalSlug!} />
          </div>
          {showUserSelect ? (
            <UserSelectScreen />
          ) : (
            <>
              <NotParticipatingBanner />
              {/* 下部ナビ(4rem+セーフエリア)に隠れないよう余白を確保 */}
              <main className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
                <Outlet />
              </main>
              <BottomNav />
            </>
          )}
        </div>
      </ReadStatusProvider>
    </FestivalDataProvider>
  );
}
