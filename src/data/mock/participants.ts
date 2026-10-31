import { kochi2026 } from "./kochi2026";
import { harajuku2026 } from "./harajuku2026";
import type { ParticipantMasterEntry } from "../../types/domain";

// Supabase 未設定(mock モード)で、祭りに依存しない名簿を使う画面のためのダミー。
// 本番では participant_display / festival_participants を読む。

const FESTIVALS = [kochi2026, harajuku2026];

/** シリアル → 呼び名(祭りを問わない)。同じ人が複数の祭りにいれば後勝ち */
export function mockDisplayNames(): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of FESTIVALS) {
    for (const p of f.participants) map.set(p.serial, p.nickname || p.name);
  }
  return map;
}

/**
 * シリアル → 祭りごとの名簿の呼び名(新しい祭りから順、重複なし)。
 * 本番では festival_participants を登録の新しい順に読む。
 */
export function mockNicknamesBySerial(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const f of [...FESTIVALS].reverse()) {
    for (const p of f.participants) {
      const list = map.get(p.serial) ?? [];
      if (p.nickname && !list.includes(p.nickname)) list.push(p.nickname);
      map.set(p.serial, list);
    }
  }
  return map;
}

/**
 * これまでに登録されたことのある人(シリアル・本名・呼び名)。
 * 本番では participant_display ビューを読む。
 */
export function mockKnownParticipants(): {
  serial: string;
  name: string;
  nickname: string;
}[] {
  const map = new Map<string, { serial: string; name: string; nickname: string }>();
  for (const f of FESTIVALS) {
    for (const p of f.participants) {
      map.set(p.serial, {
        serial: p.serial,
        name: p.name,
        nickname: p.nickname,
      });
    }
  }
  return [...map.values()];
}

/** 祭りごとの名簿(シリアル → 表示名)。未回答を数えるのに使う */
export function mockRosters(
  festivalIds: string[],
): Map<string, Map<string, string>> {
  const wanted = new Set(festivalIds);
  const result = new Map<string, Map<string, string>>();
  for (const f of FESTIVALS) {
    if (!wanted.has(f.festival.id)) continue;
    result.set(
      f.festival.id,
      new Map(f.participants.map((p) => [p.serial, p.nickname || p.name])),
    );
  }
  return result;
}

/**
 * 踊り子マスタの一覧(使われ方つき)。本番では admin_participant_master() を呼ぶ。
 * 打ち間違いの例として、祭りに載っていない似たシリアル(K-10)も混ぜている。
 */
export function mockParticipantMaster(): ParticipantMasterEntry[] {
  const bySerial = new Map<string, ParticipantMasterEntry>();
  for (const f of FESTIVALS) {
    for (const p of f.participants) {
      const entry = bySerial.get(p.serial) ?? blankEntry(p.serial);
      entry.name = p.name;
      entry.nickname = p.nickname;
      entry.festivalNames.push(f.festival.name);
      bySerial.set(p.serial, entry);
    }
  }
  // マスターにだけあるシリアル("406" "s1321" は mockRepository と同じ)
  for (const serial of ["406", "s1321"]) bySerial.set(serial, blankEntry(serial));
  bySerial.set("K-10", { ...blankEntry("K-10"), attendanceCount: 2, pushCount: 1 });
  return [...bySerial.values()];
}

function blankEntry(serial: string): ParticipantMasterEntry {
  return {
    serial,
    name: null,
    nickname: null,
    festivalNames: [],
    attendanceCount: 0,
    propCount: 0,
    transferCount: 0,
    pushCount: 0,
    lastSeenAt: null,
  };
}

/** あるシリアルの、祭りごとの名簿の登録。本番では festival_participants を読む */
export function mockRegistrations(serial: string): {
  id: string;
  festivalName: string;
  name: string;
  nickname: string;
}[] {
  return FESTIVALS.flatMap((f) =>
    f.participants
      .filter((p) => p.serial === serial)
      .map((p) => ({
        id: p.id,
        festivalName: f.festival.name,
        name: p.name,
        nickname: p.nickname,
      })),
  );
}

/**
 * リハ集計に含める役職(本番では festival_roles.counts_in_rehearsal)。
 * mock では初期設定と同じく「踊り子一般」(既定)と「リーダー」。
 */
export function mockRehearsalCountRoleIds(festivalIds: string[]): Set<string> {
  const wanted = new Set(festivalIds);
  return new Set(
    FESTIVALS.filter((f) => wanted.has(f.festival.id)).flatMap((f) =>
      f.roles
        .filter((r) => r.isDefault || r.name === "リーダー")
        .map((r) => r.id),
    ),
  );
}

/** 祭りごとの名簿(シリアルと役職)。リハ集計の対象を決めるのに使う */
export function mockRosterRoles(
  festivalIds: string[],
): { festivalId: string; serial: string; roleIds: string[] }[] {
  const wanted = new Set(festivalIds);
  return FESTIVALS.filter((f) => wanted.has(f.festival.id)).flatMap((f) =>
    f.participants.map((p) => ({
      festivalId: f.festival.id,
      serial: p.serial,
      roleIds: p.roleIds,
    })),
  );
}
