import { useFestivalData } from "../../context/FestivalDataContext";
import { formatClockTime } from "../../lib/time";

/** 最終更新時刻と手動更新ボタン */
export default function RefreshIndicator() {
  const { refreshing, lastUpdated, refresh } = useFestivalData();

  return (
    <button
      type="button"
      onClick={() => void refresh()}
      disabled={refreshing}
      className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm active:bg-slate-50"
    >
      <svg
        className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      {refreshing
        ? "更新中…"
        : lastUpdated
          ? `最終更新 ${formatClockTime(lastUpdated)}`
          : "更新"}
    </button>
  );
}
