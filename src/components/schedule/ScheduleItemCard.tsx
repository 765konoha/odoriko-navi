import { Link, useParams } from "react-router-dom";
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
  const { festivalSlug } = useParams();
  const meta = CATEGORY_META[item.category];
  const isPerformance = item.category === "performance";
  const isDone = !!item.isCompleted && !item.isCancelled;
  const rejoice = item.rejoiceCount ?? 0;
  const sakaseya = item.sakaseyaCount ?? 0;
  // スタンプ内の回数表記(例: "R1・咲0.5")
  const stampCounts = [
    rejoice > 0 &&
      `R${Number.isInteger(rejoice) ? rejoice : rejoice.toFixed(1)}`,
    sakaseya > 0 &&
      `咲${Number.isInteger(sakaseya) ? sakaseya : sakaseya.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join("・");

  const body = (
    <div
      className={`relative rounded-2xl bg-white p-4 shadow-sm ${
        item.isCancelled ? "opacity-60" : ""
      } ${isNext ? "ring-2 ring-amber-400" : ""} ${
        isDone ? "border-l-4 border-emerald-500" : ""
      }`}
    >
      {/* 完了スタンプ(朱色の判子風。淡色化の影響を受けないよう本文の外に置く) */}
      {isDone && (
        <div className="pointer-events-none absolute top-2 right-2 z-10 flex h-20 w-20 -rotate-12 items-center justify-center rounded-full border-[3px] border-red-600/90 bg-red-50/30">
          <div className="flex h-[4.1rem] w-[4.1rem] flex-col items-center justify-center rounded-full border-2 border-red-600/50 text-red-600">
            <span className="text-3xl leading-none font-bold">完</span>
            {isPerformance && stampCounts && (
              <span className="mt-0.5 text-[9px] leading-none font-bold">
                {stampCounts}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 完了カードは本文をトーンダウン(スタンプは鮮やかなまま) */}
      <div className={isDone ? "opacity-55" : ""}>
      <div className={`flex items-center gap-2 ${isDone ? "pr-20" : ""}`}>
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
        } ${isDone ? "pr-20" : ""}`}
      >
        {item.title}
      </h3>

      <dl className="mt-2 space-y-1 text-base text-slate-700">
        {item.gatherTime && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-slate-500">集合</dt>
            <dd className="font-bold tabular-nums">
              {formatTime(item.gatherTime)}
            </dd>
          </div>
        )}
        {meetingLocation && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-slate-500">集合場所</dt>
            <dd className="font-medium">📍 {meetingLocation.name}</dd>
          </div>
        )}
        {item.startTime && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-slate-500">
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
        {item.venueName && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-slate-500">会場</dt>
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

      {(meetingLocation || item.venueRouteId) && (
        <div className="mt-3 flex gap-2">
          {meetingLocation && (
            <Link
              to={`/${festivalSlug}/map?loc=${meetingLocation.id}`}
              className="flex-1 rounded-lg bg-blue-50 py-2 text-center text-sm font-bold text-blue-700"
            >
              📍 集合場所
            </Link>
          )}
          {item.venueRouteId && (
            <Link
              to={`/${festivalSlug}/map?route=${item.venueRouteId}`}
              className="flex-1 rounded-lg bg-[#eef3d4] py-2 text-center text-sm font-bold text-[#005D4D]"
            >
              🚩 演舞会場
            </Link>
          )}
        </div>
      )}
      </div>
    </div>
  );

  return body;
}
