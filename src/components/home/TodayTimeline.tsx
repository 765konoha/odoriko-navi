import type { ScheduleItem } from "../../types/domain";
import { formatTime } from "../../lib/time";
import { displayTime } from "../../lib/schedule";

interface Props {
  items: ScheduleItem[];
  nextItemId: string | null;
  now: Date;
}

/** 本日の演舞予定の簡易タイムライン */
export default function TodayTimeline({ items, nextItemId, now }: Props) {
  const performances = items.filter((s) => s.category === "performance");

  if (performances.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-slate-600">
        本日の演舞予定はありません。
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
      {performances.map((item) => {
        const t = displayTime(item);
        const isNext = item.id === nextItemId;
        const isDone =
          !isNext && t != null && new Date(t).getTime() < now.getTime();

        return (
          <li
            key={item.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              isNext ? "bg-amber-50" : ""
            }`}
          >
            <span
              className={`w-14 shrink-0 text-lg font-bold tabular-nums ${
                item.isCancelled
                  ? "text-slate-400 line-through"
                  : isDone
                    ? "text-slate-400"
                    : "text-slate-900"
              }`}
            >
              {t ? formatTime(t) : "--:--"}
            </span>
            <span
              className={`flex-1 text-base ${
                item.isCancelled
                  ? "text-slate-400 line-through"
                  : isDone
                    ? "text-slate-400"
                    : "font-medium text-slate-900"
              }`}
            >
              {item.title}
              {!item.isConfirmed && !item.isCancelled && (
                <span className="ml-1 text-sm text-amber-600">(未確定)</span>
              )}
            </span>
            {item.isCancelled ? (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                中止
              </span>
            ) : isNext ? (
              <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                NEXT
              </span>
            ) : isDone ? (
              <span className="text-emerald-600">✓</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
