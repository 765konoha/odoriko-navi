import { useFestivalData } from "../../context/FestivalDataContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { formatClockTime } from "../../lib/time";

/** オフライン時(または取得失敗でキャッシュ表示中)の明示バナー */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  const { isStale, lastUpdated, refreshing } = useFestivalData();

  // オフライン時、または取得に失敗して前回データを表示している時のみ出す
  // (起動直後のキャッシュ表示→再取得中はチラつくため出さない)
  if (online && (!isStale || refreshing)) return null;

  return (
    <div className="sticky top-0 z-40 bg-amber-500 px-4 py-2 text-center text-sm font-bold text-white">
      オフライン表示中
      {lastUpdated && `(最終更新 ${formatClockTime(lastUpdated)})`}
    </div>
  );
}
