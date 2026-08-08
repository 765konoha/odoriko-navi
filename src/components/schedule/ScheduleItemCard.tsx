import type { Location, ScheduleItem } from "../../types/domain";
import { formatTime } from "../../lib/time";
import { CATEGORY_META } from "../../lib/schedule";

interface Props {
  item: ScheduleItem;
  meetingLocation: Location | null;
  isNext: boolean;
}

export default function ScheduleItemCard({
  item,
  meetingLocation,
  isNext,
}: Props) {
  const meta = CATEGORY_META[item.category];
  const isPerformance = item.category === "performance";

  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-sm ${
        item.isCancelled ? "opacity-60" : ""
      } ${isNext ? "ring-2 ring-amber-400" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
        {item.isCancelled && (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
            中止
          </span>
        )}
        {!item.isConfirmed && !item.isCancelled && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            未確定
          </span>
        )}
        {isNext && (
          <span className="ml-auto rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
            NEXT
          </span>
        )}
      </div>

      <h3
        className={`mt-2 text-lg font-bold ${
          item.isCancelled ? "text-slate-500 line-through" : "text-slate-900"
        }`}
      >
        {item.title}
      </h3>

      <dl className="mt-2 space-y-1 text-base text-slate-700">
        {item.gatherTime && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-slate-500">集合</dt>
            <dd className="font-bold tabular-nums">
              {formatTime(item.gatherTime)}
              {meetingLocation && (
                <span className="ml-2 font-normal">{meetingLocation.name}</span>
              )}
            </dd>
          </div>
        )}
        {item.startTime && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-slate-500">
              {isPerformance ? "演舞" : "開始"}
            </dt>
            <dd className="font-bold tabular-nums">
              {formatTime(item.startTime)}
              {item.endTime && (
                <span className="font-normal">
                  〜{formatTime(item.endTime)}
                </span>
              )}
            </dd>
          </div>
        )}
        {!item.gatherTime && meetingLocation && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-slate-500">場所</dt>
            <dd>{meetingLocation.name}</dd>
          </div>
        )}
        {item.venueName && item.venueName !== item.title && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-slate-500">会場</dt>
            <dd>{item.venueName}</dd>
          </div>
        )}
      </dl>

      {!item.isConfirmed && item.tbdNote && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {item.tbdNote}
        </p>
      )}
      {item.notes && (
        <p className="mt-2 text-sm text-slate-600">⚠ {item.notes}</p>
      )}
    </div>
  );
}
