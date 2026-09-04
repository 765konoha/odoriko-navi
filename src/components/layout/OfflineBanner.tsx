import { useFestivalData } from "../../context/FestivalDataContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { formatClockTime } from "../../lib/time";

function Banner({ lastUpdated }: { lastUpdated?: Date | null }) {
  return (
    <div className="sticky top-0 z-40 bg-amber-500 px-4 py-2 text-center text-sm font-bold text-white">
      オフライン表示中
      {lastUpdated && `(最終更新 ${formatClockTime(lastUpdated)})`}
    </div>
  );
}

/**
 * オフラインの明示バナー(通常モード)。
 * 祭りのスナップショットを持たないため、回線が切れているときだけ出す。
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return <Banner />;
}

/** 祭りモード。取得に失敗してキャッシュを表示している間も出す */
export function FestivalOfflineBanner() {
  const online = useOnlineStatus();
  const { isStale, lastUpdated, refreshing } = useFestivalData();

  // オフライン時、または取得に失敗して前回データを表示している時のみ出す
  // (起動直後のキャッシュ表示→再取得中はチラつくため出さない)
  if (online && (!isStale || refreshing)) return null;

  return <Banner lastUpdated={lastUpdated} />;
}
