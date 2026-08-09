import type {
  FestivalData,
  FestivalDay,
  ScheduleCategory,
  ScheduleItem,
} from "../types/domain";
import { todayString } from "./time";

export const CATEGORY_META: Record<
  ScheduleCategory,
  { label: string; badgeClass: string }
> = {
  performance: { label: "演舞", badgeClass: "bg-blue-100 text-blue-800" },
  gather: { label: "集合", badgeClass: "bg-emerald-100 text-emerald-800" },
  practice: { label: "練習", badgeClass: "bg-purple-100 text-purple-800" },
  move: { label: "移動", badgeClass: "bg-slate-200 text-slate-700" },
  break: { label: "休憩", badgeClass: "bg-amber-100 text-amber-800" },
  dismiss: { label: "解散", badgeClass: "bg-slate-200 text-slate-700" },
  other: { label: "その他", badgeClass: "bg-slate-200 text-slate-700" },
};

/** 予定の代表時刻(集合があれば集合、なければ開始) */
export function effectiveTime(item: ScheduleItem): string | undefined {
  return item.gatherTime ?? item.startTime;
}

/** 表示用の代表時刻(タイムラインでは演舞時間を優先) */
export function displayTime(item: ScheduleItem): string | undefined {
  return item.startTime ?? item.gatherTime;
}

export function sortItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function itemsOfDay(
  data: FestivalData,
  dayId: string,
): ScheduleItem[] {
  return sortItems(data.scheduleItems.filter((s) => s.festivalDayId === dayId));
}

/** 今日に該当する開催日(なければ null) */
export function findToday(days: FestivalDay[]): FestivalDay | null {
  const today = todayString();
  return days.find((d) => d.date === today) ?? null;
}

/**
 * 次の予定: 中止でなく、まだ完了していない最初の1件。
 * (時刻ではなく、運営が管理画面で押す「完了」で進行する)
 */
export function findNextItem(items: ScheduleItem[]): ScheduleItem | null {
  for (const item of sortItems(items)) {
    if (item.isCancelled || item.isCompleted) continue;
    return item;
  }
  return null;
}

export interface DanceTotals {
  rejoice: number;
  sakaseya: number;
}

/** 完了済み予定の演目ごとの踊った回数の合計 */
export function danceTotals(items: ScheduleItem[]): DanceTotals {
  return items
    .filter((i) => i.isCompleted)
    .reduce(
      (acc, i) => ({
        rejoice: acc.rejoice + (i.rejoiceCount ?? 0),
        sakaseya: acc.sakaseya + (i.sakaseyaCount ?? 0),
      }),
      { rejoice: 0, sakaseya: 0 },
    );
}
