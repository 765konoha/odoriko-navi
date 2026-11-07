import type {
  Festival,
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

/**
 * 予定は集合時間の昇順で並べる。
 * 集合時間が無いものは開始時間で代用し、どちらも無いものは末尾に置く。
 * 同じ時刻の「集合」と「演舞」は、集合を先にする(集まってから踊るため)。
 * それ以外で同じ集合時間なら開始時間で比べる(集合が同じで演舞が別時間のケース)。
 */
export function sortItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort(
    (a, b) =>
      compareTime(effectiveTime(a), effectiveTime(b)) ||
      compareGatherFirst(a, b) ||
      compareTime(a.startTime, b.startTime),
  );
}

/** 同じ時刻なら、予定種「集合」を「演舞」より先にする */
function compareGatherFirst(a: ScheduleItem, b: ScheduleItem): number {
  if (a.category === "gather" && b.category === "performance") return -1;
  if (a.category === "performance" && b.category === "gather") return 1;
  return 0;
}

/** 時刻の昇順。未設定は末尾 */
function compareTime(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : 1;
}

/**
 * 自動完了の基準時刻(終了時刻。無ければ開始時刻)。
 * どちらも無い予定は自動完了せず、運営の完了操作を待つ。
 */
export function autoCompleteTime(item: ScheduleItem): string | undefined {
  return item.endTime ?? item.startTime;
}

/**
 * 祭りの設定として自動完了が有効か。
 * 演舞回数の集計中は完了時に回数を記録する必要があるため、常に手動のみとする。
 */
export function autoCompleteEnabled(
  festival: Pick<Festival, "scheduleAutoComplete" | "danceCountEnabled">,
): boolean {
  return festival.scheduleAutoComplete && !festival.danceCountEnabled;
}

/**
 * その予定を完了扱いにするか。
 * 中止は完了にしない。運営が完了にしたものは常に完了。
 * 自動完了が有効な祭りでは、基準時刻を過ぎたものも完了扱いにする。
 */
export function isItemDone(
  item: ScheduleItem,
  now: Date,
  autoComplete: boolean,
): boolean {
  if (item.isCancelled) return false;
  if (item.isCompleted) return true;
  if (!autoComplete) return false;
  const at = autoCompleteTime(item);
  // 絶対時刻どうしの比較なので時差の影響を受けない
  return at != null && new Date(at).getTime() <= now.getTime();
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

/** 次の予定: 中止でなく、まだ完了していない最初の1件 */
export function findNextItem(
  items: ScheduleItem[],
  now: Date,
  autoComplete: boolean,
): ScheduleItem | null {
  for (const item of sortItems(items)) {
    if (item.isCancelled) continue;
    if (isItemDone(item, now, autoComplete)) continue;
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
