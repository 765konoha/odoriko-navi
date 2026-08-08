import { Outlet, useParams } from "react-router-dom";
import BottomNav from "./BottomNav";
import OfflineBanner from "./OfflineBanner";
import { FestivalDataProvider } from "../../context/FestivalDataContext";
import { ReadStatusProvider } from "../../context/ReadStatusContext";

export default function DancerLayout() {
  const { festivalSlug } = useParams();

  return (
    <FestivalDataProvider slug={festivalSlug!}>
      <ReadStatusProvider slug={festivalSlug!}>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100">
          <OfflineBanner />
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
