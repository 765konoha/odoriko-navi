// リハ・祭りの日と小道具の受け渡し日が重なったときの案内。
//
// 小道具リレーの画面まで見に行かなくても、その日の予定を見たときに
// 「今日は受け渡しがある」と気づけるようにするための判定。
//
// 出すタイミングは渡す側と受け取る側で違う。
// 渡す側は持って来て最初に手渡すので、朝いちばんに要る情報。
// 受け取る側は解散前に預かるので、全部終わったあとに要る情報。

import type { ScheduleItem } from "../types/domain";
import type { PropItem, PropTransfer } from "../types/props";
import { toDateString } from "./time";

export interface HandoverEntry {
  transfer: PropTransfer;
  item: PropItem;
}

/** 受け渡し予定のうち、その日(YYYY-MM-DD, JST)に予定されているものだけ */
export function handoversOn<T extends { transfer: PropTransfer }>(
  entries: T[],
  date: string,
): T[] {
  return entries.filter(
    (e) =>
      e.transfer.scheduledAt != null &&
      toDateString(e.transfer.scheduledAt) === date,
  );
}

/** 祭り当日に、渡す側・受け取る側それぞれの案内を出すか */
export interface HandoverPhase {
  /** 渡す側: 最初の予定が完了するまで */
  showOutgoing: boolean;
  /** 受け取る側: 最後の予定が完了したあと */
  showIncoming: boolean;
}

/**
 * 祭り当日の案内タイミング。
 *
 * 中止の予定は完了にならないため、最初・最後を決めるときに除く
 * (最後が中止だと、受け取る側の案内が永久に出なくなるため)。
 * 予定が1件も無い日は区切りが無いので、どちらも出す。
 *
 * @param items その日の予定(並び済み)
 * @param isDone 完了扱いかの判定(運営の完了操作と自動完了の両方を含む)
 */
export function festivalHandoverPhase(
  items: ScheduleItem[],
  isDone: (item: ScheduleItem) => boolean,
): HandoverPhase {
  const active = items.filter((i) => !i.isCancelled);
  if (active.length === 0) return { showOutgoing: true, showIncoming: true };
  return {
    showOutgoing: !isDone(active[0]),
    showIncoming: isDone(active[active.length - 1]),
  };
}
