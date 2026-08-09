import { Outlet, useNavigate, useParams } from "react-router-dom";
import BottomNav from "./BottomNav";
import OfflineBanner from "./OfflineBanner";
import { FestivalDataProvider } from "../../context/FestivalDataContext";
import { ReadStatusProvider } from "../../context/ReadStatusContext";

export default function DancerLayout() {
  const { festivalSlug } = useParams();
  const navigate = useNavigate();

  return (
    <FestivalDataProvider slug={festivalSlug!}>
      <ReadStatusProvider slug={festivalSlug!}>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100">
          <OfflineBanner />
          {/* iPhoneのPWAはブラウザの戻るUIが無いため、最上部に戻る導線を常設する */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex w-full items-center gap-1.5 border-b border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
            1つ前の画面に戻る
          </button>
          {/* 下部ナビ(4rem+セーフエリア)に隠れないよう余白を確保 */}
          <main className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </ReadStatusProvider>
    </FestivalDataProvider>
  );
}
