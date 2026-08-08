import type { FestivalDay, ScheduleItem } from "../../types/domain";
import { formatDateLabel } from "../../lib/time";
import { totalDanceCount } from "../../lib/schedule";

function fmt(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

/** 鳴子アイコン(half=trueで半分塗り。0.5回を表す) */
function NarukoIcon({ half = false, size = 22 }: { half?: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 20 27"
      width={size}
      height={(size * 27) / 20}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="1.5"
        width="16"
        height="14"
        rx="4"
        fill={half ? "url(#naruko-half)" : "#f59e0b"}
        stroke="#d97706"
        strokeWidth="1"
      />
      <circle cx="6.5" cy="6" r="1.4" fill="#fff" />
      <circle cx="10" cy="5" r="1.4" fill="#fff" />
      <circle cx="13.5" cy="6" r="1.4" fill="#fff" />
      <rect x="7.5" y="15.5" width="5" height="10" rx="2" fill="#b45309" />
    </svg>
  );
}

/** 回数分の鳴子アイコン列(1回=1個、端数0.5=半分塗り1個) */
function NarukoRow({ count, size }: { count: number; size: number }) {
  const full = Math.floor(count);
  const half = count - full >= 0.5;
  if (count <= 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {Array.from({ length: full }, (_, i) => (
        <NarukoIcon key={i} size={size} />
      ))}
      {half && <NarukoIcon half size={size} />}
    </span>
  );
}

/** 踊った回数のダッシュボード(鳴子スタンプ式) */
export default function DanceCountCard({
  days,
  items,
}: {
  days: FestivalDay[];
  items: ScheduleItem[];
}) {
  const total = totalDanceCount(items);

  // 演舞のある日だけを日付順に表示する
  const perDay = [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const dayItems = items.filter((i) => i.festivalDayId === day.id);
      return {
        day,
        count: totalDanceCount(dayItems),
        hasPerformance: dayItems.some(
          (i) => i.category === "performance" && !i.isCancelled,
        ),
      };
    })
    .filter((d) => d.hasPerformance);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      {/* 半分塗り用グラデーションの定義(このカード内のアイコンから参照) */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="naruko-half" x1="0" y1="0" x2="1" y2="0">
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#f1f5f9" />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-slate-700">踊った回数</h2>
        <p className="text-slate-500">
          <span className="text-3xl font-bold tabular-nums text-slate-900">
            {fmt(total)}
          </span>{" "}
          回
        </p>
      </div>

      {total <= 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          演舞が終わるとここに鳴子がたまっていきます🥁
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {perDay.map(({ day, count }) => (
            <div key={day.id} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm text-slate-600">
                {formatDateLabel(day.date)}
              </span>
              <div className="min-w-0 flex-1">
                {count > 0 ? (
                  <NarukoRow count={count} size={20} />
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                {fmt(count)}
                <span className="font-normal text-slate-400">回</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
