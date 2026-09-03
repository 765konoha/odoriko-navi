import type { AttendanceStatus } from "../types/rehearsal";

// エントリーフォームの回答(スプレッドシート)を、見出し行ごと貼り付けて取り込む。
// 列を切り出す手間をなくすため、シート全体をそのまま受け取れるようにしている。

export interface Sheet {
  header: string[];
  rows: string[][];
}

/**
 * 貼り付けられたシートをタブ区切りとして解析する(先頭行を見出しとして扱う)。
 *
 * セル内で改行しているとスプレッドシートはそのセルを " で囲んで貼り付けるため、
 * 改行で無条件に行を切ると、そのセル以降の列が丸ごと失われる。
 * " の中の改行とタブはセルの一部として扱う("" は文字としての ")。
 */
function splitCells(text: string): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"' && cell === "") {
      quoted = true;
    } else if (c === "\t") {
      cells.push(cell);
      cell = "";
    } else if (c === "\n") {
      cells.push(cell);
      rows.push(cells);
      cells = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  cells.push(cell);
  rows.push(cells);
  return rows;
}

export function parseSheet(text: string): Sheet | null {
  const rows = splitCells(text.replace(/\r\n?/g, "\n"));
  // 末尾の空行は落とすが、行の途中の空セルは保持する
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === ""))
    rows.pop();
  if (rows.length < 2) return null;

  // 見出し行が短くても、データ行にある列を選べるように幅を揃える
  const width = Math.max(...rows.map((r) => r.length));
  // セル内の改行は見出しの表示を崩すだけなので、空白ひとつに畳む
  const clean = (v: string) => v.replace(/\s*\n\s*/g, " ").trim();
  const pad = (r: string[]) =>
    Array.from({ length: width }, (_, i) => clean(r[i] ?? ""));

  return { header: pad(rows[0]), rows: rows.slice(1).map(pad) };
}

/** 全角英数・記号を半角に寄せ、空白を落とす */
function normalize(value: string): string {
  return value
    .replace(/[！-～]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/\s+/g, "")
    .trim();
}

const CIRCLED: Record<string, AttendanceStatus> = {
  "①": "present",
  "②": "late",
  "③": "leave_early",
  "④": "late_leave_early",
  "⑤": "absent",
};

/**
 * 出欠の文字列を判定する。
 * 「①参加」「②遅刻」のような丸数字つきの表記と、文言だけの表記の両方を受ける。
 * 判定できない値は null を返し、呼び出し側で行番号とともにエラーとして見せる
 * (勝手に解釈して取り込まない)。
 */
export function parseStatus(raw: string): AttendanceStatus | null {
  const v = normalize(raw);
  if (v === "") return null;
  const hasLate = v.includes("遅刻");
  const hasEarly = v.includes("早退");
  if (hasLate && hasEarly) return "late_leave_early";
  if (hasLate) return "late";
  if (hasEarly) return "leave_early";
  if (v.includes("欠席")) return "absent";
  if (v.includes("参加")) return "present";
  // 文言が無く丸数字だけの場合の保険
  for (const [mark, status] of Object.entries(CIRCLED)) {
    if (v.includes(mark)) return status;
  }
  return null;
}

/** 見出しから "9/6" のような月日を拾う(リハとの自動対応づけに使う) */
export function pickMonthDay(header: string): { month: number; day: number } | null {
  const v = normalize(header);
  const slash = /(\d{1,2})\/(\d{1,2})/.exec(v);
  if (slash) return { month: Number(slash[1]), day: Number(slash[2]) };
  const kanji = /(\d{1,2})月(\d{1,2})日/.exec(v);
  if (kanji) return { month: Number(kanji[1]), day: Number(kanji[2]) };
  return null;
}

/**
 * シリアルの列を推測する。
 * 「ペアメンバー(相手のシリアルナンバー)」のような別人のシリアル列があるため、
 * ペア・相手を含む見出しは除外する。
 */
export function guessSerialColumn(header: string[]): number {
  const candidates = header
    .map((h, i) => ({ h: normalize(h), i }))
    .filter(({ h }) => h.includes("シリアル"));
  const own = candidates.find(
    ({ h }) => !h.includes("ペア") && !h.includes("相手"),
  );
  return (own ?? candidates[0])?.i ?? -1;
}

export interface ColumnCandidate {
  /** 出欠の列 */
  index: number;
  header: string;
  monthDay: { month: number; day: number } | null;
}

/**
 * 見出しから、月日を含む列(=リハの出欠列)を拾う。
 * 「9/6 遅刻・早退の時刻」のように、出欠列の右隣にある時刻メモ列も月日を含むこと
 * があるため、直前が出欠列であれば時刻メモ列とみなして候補から外す。
 */
export function findAttendanceColumns(header: string[]): ColumnCandidate[] {
  const dated = header.map((h) => pickMonthDay(h) != null);
  return header
    .map((h, i) => ({ index: i, header: h, monthDay: pickMonthDay(h) }))
    .filter((c) => c.monthDay != null)
    .filter((c) => {
      const h = normalize(c.header);
      const isTimeNote = h.includes("時刻") || h.includes("時間");
      return !(isTimeNote && dated[c.index - 1] === true);
    });
}

export interface ImportRow {
  serial: string;
  status: AttendanceStatus;
  timeNote?: string;
}

export interface ImportResult {
  rows: ImportRow[];
  /** 参加者マスターとの照合は呼び出し側で行う */
  blankCount: number;
  errors: { line: number; serial: string; value: string }[];
}

/**
 * 1つのリハについて、出欠列と時刻メモ列から取り込む行を組み立てる。
 * 空欄は「未回答」として記録せず読み飛ばす(既存の回答を消さない)。
 */
export function buildImportRows(
  sheet: Sheet,
  serialColumn: number,
  statusColumn: number,
  timeNoteColumn: number | null,
): ImportResult {
  const rows: ImportRow[] = [];
  const errors: ImportResult["errors"] = [];
  let blankCount = 0;

  sheet.rows.forEach((cells, i) => {
    const serial = (cells[serialColumn] ?? "").trim();
    const raw = (cells[statusColumn] ?? "").trim();
    if (serial === "" && raw === "") return; // 完全な空行
    if (serial === "") {
      errors.push({ line: i + 2, serial: "(空欄)", value: raw });
      return;
    }
    if (raw === "") {
      blankCount += 1;
      return;
    }
    const status = parseStatus(raw);
    if (status == null) {
      errors.push({ line: i + 2, serial, value: raw });
      return;
    }
    const note =
      timeNoteColumn != null ? (cells[timeNoteColumn] ?? "").trim() : "";
    rows.push({ serial, status, timeNote: note === "" ? undefined : note });
  });

  return { rows, blankCount, errors };
}
