import type { ParticipantImportRow } from "./adminApi";

// Spreadsheet からコピーしたタブ区切りテキスト(シリアル/名前/ニックネーム)の解析。

export interface ParseResult {
  rows: ParticipantImportRow[];
  /** 行番号つきのエラー(1件でもあれば登録不可) */
  errors: string[];
}

/** ヘッダー行か(「シリアル」「名前」等の見出しを含む行はスキップする) */
function isHeaderRow(cells: string[]): boolean {
  const first = cells[0] ?? "";
  return /シリアル|serial|番号/i.test(first) && !/^\d/.test(first);
}

/**
 * タブ区切り3列(シリアル・名前・ニックネーム)を解析する。
 * - 空行は無視
 * - ヘッダー行が含まれていてもスキップ
 * - 各セルの前後の空白は除去(シリアルの文字列自体は "001" のまま維持)
 */
export function parseParticipantPaste(text: string): ParseResult {
  const rows: ParticipantImportRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  const lines = text.split(/\r\n|\r|\n/);
  lines.forEach((line, index) => {
    if (line.trim() === "") return; // 空行は無視
    const lineNo = index + 1;
    const cells = line.split("\t").map((c) => c.trim());
    if (rows.length === 0 && errors.length === 0 && isHeaderRow(cells)) {
      return; // ヘッダー行はスキップ
    }
    const [serial = "", name = "", nickname = ""] = cells;
    if (!serial || !name || !nickname) {
      errors.push(
        `${lineNo}行目: シリアル・名前・ニックネームの3列(タブ区切り)が必要です`,
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

  if (rows.length === 0 && errors.length === 0) {
    errors.push("登録する行がありません。Spreadsheetからコピーして貼り付けてください");
  }
  return { rows, errors };
}
