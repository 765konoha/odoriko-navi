import { kochi2026 } from "./kochi2026";
import { harajuku2026 } from "./harajuku2026";

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
