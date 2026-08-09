import type { FestivalDay, ScheduleItem } from "../../types/domain";
import { formatDateLabel } from "../../lib/time";
import { danceTotals } from "../../lib/schedule";
import {
  DanceIconRow,
  NarukoSvg,
  SakuraSvg,
  fmtCount,
} from "./danceIcons";

/** 踊った回数のダッシュボード(Rejoice=鳴子 / 咲かせや=桜) */
export default function DanceCountCard({
  days,
  items,
}: {
  days: FestivalDay[];
  items: ScheduleItem[];
}) {
  const total = danceTotals(items);
  const hasAny = total.rejoice > 0 || total.sakaseya > 0;

  // 演舞のある日だけを日付順に表示する
  const perDay = [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const dayItems = items.filter((i) => i.festivalDayId === day.id);
      return {
        day,
        totals: danceTotals(dayItems),
        hasPerformance: dayItems.some(
          (i) => i.category === "performance" && !i.isCancelled,
        ),
      };
    })
    .filter((d) => d.hasPerformance);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-700">踊った回数</h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <NarukoSvg size={18} />
            <span className="text-xl font-bold tabular-nums text-slate-900">
              {fmtCount(total.rejoice)}
            </span>
            <span className="text-xs text-slate-400">回</span>
          </span>
          <span className="flex items-center gap-1">
            <SakuraSvg size={19} />
            <span className="text-xl font-bold tabular-nums text-slate-900">
              {fmtCount(total.sakaseya)}
            </span>
            <span className="text-xs text-slate-400">回</span>
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        <NarukoSvg size={11} className="inline align-[-1px]" /> = Rejoice /{" "}
        <SakuraSvg size={11} className="inline align-[-1px]" /> = 咲かせや
      </p>

      {!hasAny ? (
        <p className="mt-2 text-sm text-slate-500">
          演舞が終わると、ここに鳴子と桜がたまっていきます🥁🌸
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {perDay.map(({ day, totals }) => (
            <div key={day.id} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm text-slate-600">
                {formatDateLabel(day.date)}
              </span>
              <div className="min-w-0 flex-1">
                {totals.rejoice > 0 || totals.sakaseya > 0 ? (
                  <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <DanceIconRow kind="naruko" count={totals.rejoice} size={21} />
                    <DanceIconRow kind="sakura" count={totals.sakaseya} size={22} />
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>
              <span className="shrink-0 text-right text-xs leading-tight tabular-nums text-slate-600">
                <span className="block font-bold text-slate-900">
                  {fmtCount(totals.rejoice)}
                  <span className="font-normal text-slate-400">回</span>
                </span>
                <span className="block font-bold text-pink-700">
                  {fmtCount(totals.sakaseya)}
                  <span className="font-normal text-slate-400">回</span>
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
