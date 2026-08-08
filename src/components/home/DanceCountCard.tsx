import type { FestivalDay, ScheduleItem } from "../../types/domain";
import { formatDateLabel } from "../../lib/time";
import { totalDanceCount } from "../../lib/schedule";

function fmt(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

/** 鳴子アイコン(朱塗りの板+横木+バチ+持ち手) */
function NarukoSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 34"
      width={size}
      height={(size * 34) / 24}
      aria-hidden="true"
      className={className}
    >
      {/* 持ち手 */}
      <rect x="10" y="22" width="4" height="11" rx="1.8" fill="#92400e" />
      {/* 朱塗りの板 */}
      <rect
        x="3"
        y="1.5"
        width="18"
        height="21.5"
        rx="3.5"
        fill="#dc2626"
        stroke="#991b1b"
        strokeWidth="1"
      />
      {/* 上部の横木 */}
      <rect x="5" y="4.5" width="14" height="3" rx="1" fill="#78350f" />
      {/* バチ(黄・黒・黄) */}
      <rect
        x="5.8"
        y="7"
        width="3.4"
        height="11.5"
        rx="1.2"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="0.5"
      />
      <rect x="10.3" y="7" width="3.4" height="11.5" rx="1.2" fill="#1e293b" />
      <rect
        x="14.8"
        y="7"
        width="3.4"
        height="11.5"
        rx="1.2"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="0.5"
      />
    </svg>
  );
}

/** 0.5回分: 左半分だけ色付き(右半分は薄いグレー) */
function NarukoHalf({ size }: { size: number }) {
  const h = (size * 34) / 24;
  return (
    <span
      className="relative inline-block"
      style={{ width: size, height: h }}
      aria-hidden="true"
    >
      <NarukoSvg size={size} className="opacity-25 grayscale" />
      <NarukoSvg
        size={size}
        className="absolute inset-0 [clip-path:inset(0_50%_0_0)]"
      />
    </span>
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
        <NarukoSvg key={i} size={size} />
      ))}
      {half && <NarukoHalf size={size} />}
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
                  <NarukoRow count={count} size={22} />
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
