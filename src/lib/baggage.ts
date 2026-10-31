// 荷物グループの所属者を取り出す。
//
// 表示順は「リーダーが先頭、あとはシリアル順」。
// 当日はリーダーに荷物を預ける動きになるため、リーダーを探しやすくする。

import type { FestivalParticipant } from "../types/domain";
import { compareSerial } from "./audience";

export function baggageGroupMembers(
  participants: FestivalParticipant[],
  groupId: string,
  leaderParticipantId?: string,
): FestivalParticipant[] {
  return participants
    .filter((p) => p.baggageGroupId === groupId)
    .sort((a, b) => {
      if (a.id === leaderParticipantId) return -1;
      if (b.id === leaderParticipantId) return 1;
      return compareSerial(a.serial, b.serial);
    });
}

/** 一度に作れる荷物グループの上限(打ち間違いで大量に作らないため) */
export const MAX_BAGGAGE_GROUPS = 50;

/**
 * 「全部で count グループ」にするために足りない番号(1〜count のうち、まだ無いもの)。
 * 「A」「地方車1」など番号以外のグループはそのまま残し、数にも入れない。
 */
export function missingBaggageGroupCodes(
  existingCodes: string[],
  count: number,
): string[] {
  if (!Number.isInteger(count) || count < 1) return [];
  const existing = new Set(existingCodes.map((c) => c.trim()));
  const result: string[] = [];
  for (let n = 1; n <= Math.min(count, MAX_BAGGAGE_GROUPS); n++) {
    if (!existing.has(String(n))) result.push(String(n));
  }
  return result;
}
