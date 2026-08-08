import type { FestivalDay, ScheduleItem } from "../../types/domain";
import { formatDateLabel } from "../../lib/time";
import { plannedDanceCount, totalDanceCount } from "../../lib/schedule";

function fmt(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

/** 踊った回数のダッシュボード(円形プログレス+日別内訳) */
export default function DanceCountCard({
  days,
  items,
}: {
  days: FestivalDay[];
  items: ScheduleItem[];
}) {
  const total = totalDanceCount(items);
  const planned = plannedDanceCount(items);
  const pct = planned > 0 ? Math.min(total / planned, 1) : 0;
  const isComplete = planned > 0 && total >= planned;

  const R = 54;
  const C = 2 * Math.PI * R;

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const perDay = sortedDays.map((day) => {
    const dayItems = items.filter((i) => i.festivalDayId === day.id);
    return {
      day,
      count: totalDanceCount(dayItems),
      planned: plannedDanceCount(dayItems),
    };
  });

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-700">踊った回数</h2>

      <div className="mt-2 flex items-center gap-5">
        <div className="relative shrink-0">
          <svg viewBox="0 0 140 140" className="h-32 w-32">
            <defs>
              <linearGradient id="danceGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="13"
            />
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="url(#danceGrad)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              transform="rotate(-90 70 70)"
              className="transition-all duration-700"
            />
            <text
              x="70"
              y="74"
              textAnchor="middle"
              fontSize="34"
              fontWeight="bold"
              fill="#0f172a"
            >
              {fmt(total)}
            </text>
            <text x="70" y="96" textAnchor="middle" fontSize="14" fill="#64748b">
              回
            </text>
          </svg>
          {isComplete && (
            <span className="absolute -top-1 -right-1 text-xl">🎉</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {perDay.map(({ day, count, planned: dayPlanned }) => (
            <div key={day.id}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-600">
                  {formatDateLabel(day.date)}
                </span>
                <span className="font-bold tabular-nums text-slate-900">
                  {fmt(count)}
                  <span className="font-normal text-slate-400">回</span>
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-700"
                  style={{
                    width: `${dayPlanned > 0 ? Math.min(count / dayPlanned, 1) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        {isComplete
          ? `全${fmt(planned)}回を踊りきりました!おつかれさまでした🎉`
          : `見込み ${fmt(planned)}回中 ${fmt(total)}回完了`}
      </p>
    </section>
  );
}
