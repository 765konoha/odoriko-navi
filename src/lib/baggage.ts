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
