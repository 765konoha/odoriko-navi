// 名簿シート(シリアル・本名・呼び名)の解析。
//
// 貼り付け取り込み(src/lib/participantImport.ts)は列の並び順で読むが、
// シート同期は見出しで列を探す。運営がシートの列を足したり入れ替えたりしても
// 読めるようにするため。
//
// 解析の実体をここに置くのは出欠(attendanceParse.ts)と同じ理由で、
// Edge Function が supabase/functions の外を同梱できないことがあるため。

import { parseSheet, type Sheet } from "./attendanceParse.ts";

export type { Sheet };
export { parseSheet };

/** 全角英数・記号を半角に寄せ、空白を落とす */
function normalize(value: string): string {
  return value
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .trim();
}

export interface ParticipantColumns {
  serial: number;
  name: number;
  nickname: number;
}

/**
 * 見出しから列を探す。
 *
 * シリアルは「ペアメンバー(相手のシリアルナンバー)」を避ける(出欠と同じ)。
 * 呼び名は「ニックネーム」「呼び名」「あだ名」を見る。
 * 本名は「名前」「氏名」「本名」。ただし「ニックネーム」は名前を含むので、
 * 先に呼び名を決めてからその列を候補から外す。
 */
export function findParticipantColumns(
  header: string[],
): ParticipantColumns | null {
  const cells = header.map((h, i) => ({ h: normalize(h), i }));

  const serialCandidates = cells.filter(({ h }) => h.includes("シリアル"));
  const serial =
    serialCandidates.find(
      ({ h }) => !h.includes("ペア") && !h.includes("相手"),
    ) ?? serialCandidates[0];

  const nickname = cells.find(
    ({ h }) =>
      h.includes("ニックネーム") || h.includes("呼び名") || h.includes("あだ名"),
  );

  const name = cells.find(
    ({ h, i }) =>
      i !== nickname?.i &&
      (h.includes("氏名") || h.includes("本名") || h.includes("名前")),
  );

  if (!serial || !name || !nickname) return null;
  return { serial: serial.i, name: name.i, nickname: nickname.i };
}

/** 見出しのうち、見つからなかったものを日本語で並べる(案内に使う) */
export function missingColumnLabels(header: string[]): string[] {
  const cells = header.map((h) => normalize(h));
  const missing: string[] = [];
  if (!cells.some((h) => h.includes("シリアル"))) missing.push("シリアル");
  if (!cells.some((h) => h.includes("氏名") || h.includes("本名") || h.includes("名前")))
    missing.push("名前");
  if (
    !cells.some(
      (h) =>
        h.includes("ニックネーム") || h.includes("呼び名") || h.includes("あだ名"),
    )
  )
    missing.push("ニックネーム");
  return missing;
}

export interface ParticipantSheetRow {
  serial: string;
  name: string;
  nickname: string;
}

export interface ParticipantSheetResult {
  rows: ParticipantSheetRow[];
  /** 行番号つきの読み飛ばし理由(登録は止めない) */
  errors: string[];
}

/**
 * 行を組み立てる。
 *
 * 途中に欠けた行があっても全体を止めない(シートには集計行や
 * 記入途中の行が混ざるため)。読み飛ばした行は理由を添えて返し、
 * 運営が結果を見て直せるようにする。
 * 同じシリアルが複数あるときは最初の行を採る。
 */
export function buildParticipantRows(
  sheet: Sheet,
  columns: ParticipantColumns,
): ParticipantSheetResult {
  const rows: ParticipantSheetRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  sheet.rows.forEach((cells, index) => {
    // 見出しが1行目なので、シート上の行番号は +2
    const lineNo = index + 2;
    const serial = (cells[columns.serial] ?? "").trim();
    const name = (cells[columns.name] ?? "").trim();
    const nickname = (cells[columns.nickname] ?? "").trim();

    // 全部空の行は集計行や区切りなので黙って飛ばす
    if (serial === "" && name === "" && nickname === "") return;

    if (serial === "") {
      errors.push(`${lineNo}行目: シリアルが空のため飛ばしました`);
      return;
    }
    if (name === "" || nickname === "") {
      errors.push(
        `${lineNo}行目(${serial}): 名前かニックネームが空のため飛ばしました`,
      );
      return;
    }
    if (seen.has(serial)) {
      errors.push(`${lineNo}行目: シリアル「${serial}」が重複しています`);
      return;
    }
    seen.add(serial);
    rows.push({ serial, name, nickname });
  });

  return { rows, errors };
}
