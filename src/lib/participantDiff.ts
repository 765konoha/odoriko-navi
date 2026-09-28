import type { FestivalParticipant } from "../types/domain";
import type { ParticipantImportRow } from "./adminApi";

// Spreadsheet の貼り付けと、今の名簿との差分。
//
// 初回の一括登録のあとも、シートを貼り直せば追加と名前の変更を
// 取り込めるようにする。名簿から人を消すことはしない
// (消すと個人宛てのお知らせや荷物リーダーの設定まで消えるため、
//  シートから外れた人は一覧に出すだけにして、削除は個別に行う)。

export interface ParticipantChange {
  id: string;
  serial: string;
  before: { name: string; nickname: string };
  after: { name: string; nickname: string };
}

export interface ParticipantDiff {
  /** 名簿にいない人(踊り子一般をつけて追加する) */
  added: ParticipantImportRow[];
  /** 名前かニックネームが変わった人 */
  changed: ParticipantChange[];
  /** 変わらない人の数 */
  unchanged: number;
  /** 名簿にいるがシートにいない人(削除はしない) */
  missing: FestivalParticipant[];
  /**
   * 先頭の0が落ちていたシリアルを、名簿の人に読み替えたもの。
   * スプレッドシートが "012" を数値の 12 として扱うことがあるため
   */
  normalized: { sheet: string; roster: string }[];
  /** 反映できない行(1件でもあれば反映しない) */
  errors: string[];
}

/** 先頭の0と大文字小文字を無視した照合用のキー */
function looseKey(serial: string): string {
  return serial.trim().toLowerCase().replace(/^0+(?=\d)/, "");
}

export function diffParticipants(
  current: FestivalParticipant[],
  rows: ParticipantImportRow[],
): ParticipantDiff {
  const bySerial = new Map(current.map((p) => [p.serial, p]));
  // 先頭の0を落とすと同じになる人が名簿に2人以上いれば、読み替えない
  const byLoose = new Map<string, FestivalParticipant | null>();
  for (const p of current) {
    const key = looseKey(p.serial);
    byLoose.set(key, byLoose.has(key) ? null : p);
  }

  const diff: ParticipantDiff = {
    added: [],
    changed: [],
    unchanged: 0,
    missing: [],
    normalized: [],
    errors: [],
  };
  const matched = new Set<string>();

  // シリアルが完全に一致する行を先に割り当てる。読み替えの行が
  // 先に来ても、本来その人の行を奪わないようにするため
  const exact = rows.map((r) => bySerial.get(r.serial));

  rows.forEach((row, i) => {
    let person = exact[i];
    if (!person) {
      const loose = byLoose.get(looseKey(row.serial));
      // 読み替え先が、別の行で完全一致している人なら読み替えない
      const takenExactly = loose
        ? exact.some((e, j) => j !== i && e?.id === loose.id)
        : false;
      if (loose && !takenExactly) {
        person = loose;
        diff.normalized.push({ sheet: row.serial, roster: loose.serial });
      }
    }

    if (!person) {
      diff.added.push(row);
      return;
    }
    if (matched.has(person.id)) {
      diff.errors.push(
        `シリアル「${row.serial}」は、名簿の「${person.serial}」と同じ人を指しています。シートの重複を確認してください`,
      );
      return;
    }
    matched.add(person.id);

    if (person.name === row.name && person.nickname === row.nickname) {
      diff.unchanged++;
      return;
    }
    diff.changed.push({
      id: person.id,
      serial: person.serial,
      before: { name: person.name, nickname: person.nickname },
      after: { name: row.name, nickname: row.nickname },
    });
  });

  diff.missing = current.filter((p) => !matched.has(p.id));
  return diff;
}

/** 反映するものがあるか */
export function hasParticipantChanges(diff: ParticipantDiff): boolean {
  return diff.added.length > 0 || diff.changed.length > 0;
}
