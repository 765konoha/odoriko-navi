// 小道具のスプレッドシート(小道具担当の「2026」シート)の読み取り。
//
// スプレッドシートの Apps Script はシートを丸ごと送ってくるだけで、
// どのセルが誰を指すか・何を反映するかはすべてここで決める。
// 読み方の決まりは docs/PROPS_SHEET_SYNC.md にまとめてある。
// 変えるときは、シートの注意書き(Apps Script の NOTES)も合わせること。
//
// 受付口(props-sheet-sync)とテストで同じものを使うため、ここに置く。

import { normalizeSerial } from "./serial.ts";

// ---------- 名前 ----------

/**
 * 名前の比較用のキー。
 * 全角/半角、ひらがな/カタカナ、大文字/小文字、伸ばし棒の種類の違いを
 * 同じとみなし、空白を除く。
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60),
    )
    .toLowerCase()
    .replace(/[ー―‐‑–—−-]/g, "ー")
    .replace(/\s+/g, "");
}

/** セルの読み方。誰を取り出すかが列によって違う */
export type ParseMode =
  /** 保有者の更新: 「A→B」は B */
  | "holder"
  /** 当日の持ち帰り: 「A→B」は A(当日 A が持ち帰り、後日 B に渡す) */
  | "takeHome"
  /** お祭りの列(使う人): 書かれている人全員 */
  | "users";

export interface ParsedCell {
  names: string[];
  /** 反映しない理由(「貸出」など)。名前なしとは区別する */
  skip?: string;
}

const ERROR_VALUE = /^#(N\/A|VALUE!|REF!|NAME\?|ERROR!|DIV\/0!)/;
const NONE_TOKEN = /^[✖✕×xXＸ️]+$/;
const MARKS = /[●◯○〇◎★☆]/g;

/** 1人分の文字から、記号や注記を除く */
function cleanToken(token: string): string {
  return token.replace(MARKS, "").replace(/[\s　]+/g, " ").trim();
}

/**
 * セルに書かれた人を取り出す。
 * - 「※」から後ろ、（ ）の中は注記として除く(「ＮＥＷ（ちえこ）」は ちえこ)
 * - ●◯★ などの記号は除く
 * - 「行:A 帰:B」は帰り(B)。お祭りの列では両方
 * - 「・」「/」「、」で区切られていれば複数人
 */
export function parseNames(cell: string, mode: ParseMode): ParsedCell {
  let text = (cell ?? "").trim();
  if (text === "" || ERROR_VALUE.test(text)) return { names: [] };
  if (/貸出|貸し出し/.test(text)) return { names: [], skip: "貸出" };

  text = text
    .replace(/※[^\n]*/g, "")
    .replace(
      /(ＮＥＷ|ｎｅｗ|NEW|new)?\s*[（(]([^）)]*)[）)]/g,
      (_m, newWord: string | undefined, inner: string) => (newWord ? inner : ""),
    )
    .replace(/->|⇒|➡|➔/g, "→");

  let segments: string[];
  const goBack = text.match(/行[:：]\s*(.*?)\s*帰[:：]\s*(.*)$/s);
  if (goBack) {
    segments = mode === "users" ? [goBack[1], goBack[2]] : [goBack[2]];
  } else {
    const parts = text
      .split("→")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    if (parts.length === 0) return { names: [] };
    segments =
      mode === "holder"
        ? [parts[parts.length - 1]]
        : mode === "takeHome"
          ? [parts[0]]
          : parts;
  }

  const seen = new Set<string>();
  const names: string[] = [];
  for (const segment of segments) {
    for (const raw of segment.split(/[\/／・、,，\n]/)) {
      const name = cleanToken(raw);
      if (name === "" || NONE_TOKEN.test(name)) continue;
      const key = normalizeName(name);
      if (key === "" || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return { names };
}

// ---------- 状態 ----------

export type PropConditionValue =
  | "normal"
  | "damaged"
  | "broken"
  | "lost"
  | "repairing"
  | "retired";

const CONDITION_BY_LABEL: Record<string, PropConditionValue> = {
  正常: "normal",
  破損: "damaged",
  故障: "broken",
  紛失: "lost",
  修理中: "repairing",
  使用停止: "retired",
};

/** 状態列の文字 → 状態。空欄は正常。読めなければ null */
export function parseCondition(cell: string): PropConditionValue | null {
  const text = (cell ?? "").replace(/\s+/g, "");
  if (text === "") return "normal";
  return CONDITION_BY_LABEL[text] ?? null;
}

// ---------- 日付 ----------

function ymd(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 日付の欄を日付の一覧にする(YYYY-MM-DD、昇順)。読めなければ空。
 * 「2026-03-22」「2026/3/22」「8/29・30」「10/10-11」「5/15,17」「2.22」
 */
export function parseEventDates(text: string, year: number): string[] {
  const value = (text ?? "").normalize("NFKC").trim();
  const full = value.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (full) {
    const d = ymd(Number(full[1]), Number(full[2]), Number(full[3]));
    return d ? [d] : [];
  }
  const md = value.match(/^(\d{1,2})[\/.](\d{1,2})(.*)$/s);
  if (!md) return [];
  const month = Number(md[1]);
  let day = Number(md[2]);
  const days = [day];
  let rest = md[3];
  for (;;) {
    const next = rest.match(/^\s*([-〜~・,、])\s*(\d{1,2})/);
    if (!next) break;
    const n = Number(next[2]);
    if ("-〜~".includes(next[1])) {
      for (let x = day + 1; x <= n; x++) days.push(x);
    } else {
      days.push(n);
    }
    day = n;
    rest = rest.slice(next[0].length);
  }
  return [...new Set(days)]
    .map((d) => ymd(year, month, d))
    .filter((d): d is string => d != null)
    .sort();
}

// ---------- 列 ----------

/** 0 始まりの列番号 → 列の記号(0 → A、26 → AA) */
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** 列の記号 → 0 始まりの列番号。読めなければ -1 */
export function columnIndex(letter: string): number {
  const s = (letter ?? "").normalize("NFKC").trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(s)) return -1;
  let n = 0;
  for (const c of s) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// ---------- シートの解析 ----------

export interface SheetItem {
  /** シートの行番号(1 始まり) */
  row: number;
  category: string;
  identifier: string;
  cells: string[];
}

export interface RelayColumn {
  col: number;
  /** 行き(現地へ持っていく)/ 帰り(持ち帰り)/ 区別なし */
  kind: "go" | "back" | "plain";
}

export interface EventGroup {
  col: number;
  name: string;
  dateText: string;
  dates: string[];
  relays: RelayColumn[];
}

export interface SheetLayout {
  items: SheetItem[];
  groups: EventGroup[];
  /** 時系列の列の範囲 [timelineStart, timelineEnd) */
  timelineStart: number;
  timelineEnd: number;
  statusCol: number | null;
  /** 見出しの行(0 始まり) */
  headerRow: number;
}

const strip = (s: string | undefined) => (s ?? "").replace(/\s+/g, "");

/** 見出しの文字(C列)。位置は決め打ちせず、この文字で行を探す */
const LABEL_HEADER = "お祭り・イベント";
const LABEL_DATE = "日付";
const LABELS_EXTRA = ["演舞作品", "ステージ/流し"];
const TIMELINE_START = 3; // D列

export function analyzeSheet(
  grid: string[][],
  year: number,
): { layout: SheetLayout } | { error: string } {
  const labelRow = (label: string) =>
    grid.findIndex((row) => strip(row?.[2]) === label);
  const headerRow = labelRow(LABEL_HEADER);
  if (headerRow < 0) {
    return {
      error:
        "見出しの行(C列が「お祭り・イベント」の行)が見つかりません。シートの見出しを確認してください。",
    };
  }
  const dateRow = labelRow(LABEL_DATE);
  const lastLabelRow = Math.max(
    headerRow,
    dateRow,
    ...LABELS_EXTRA.map(labelRow),
  );
  const header = grid[headerRow] ?? [];
  const findHeader = (name: string) => {
    const i = header.findIndex((h) => strip(h) === name);
    return i >= 0 ? i : null;
  };
  const holderCol = findHeader("現在の保管者");
  const noteCol = findHeader("備考");
  const statusCol = findHeader("状態");
  const timelineEnd =
    holderCol ?? noteCol ?? statusCol ?? Math.max(...grid.map((r) => r.length));

  const groups: EventGroup[] = [];
  for (let c = TIMELINE_START; c < timelineEnd; c++) {
    const h = strip(header[c]);
    const current = groups[groups.length - 1];
    if (h.startsWith("リレー") || (h === "" && current)) {
      if (!current) continue;
      current.relays.push({
        col: c,
        kind: h.includes("行") ? "go" : h.includes("帰") ? "back" : "plain",
      });
    } else if (h !== "") {
      const dateText = dateRow >= 0 ? (grid[dateRow]?.[c] ?? "").trim() : "";
      groups.push({
        col: c,
        name: (header[c] ?? "").replace(/\s+/g, " ").trim(),
        dateText,
        dates: parseEventDates(dateText, year),
        relays: [],
      });
    }
  }

  const items: SheetItem[] = [];
  let category = "";
  for (let r = lastLabelRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const a = strip(row[0]);
    if (a !== "") category = a;
    const identifier = normalizeSerial((row[1] ?? "").replace(/\s+/g, " "));
    if (identifier === "") continue;
    items.push({ row: r + 1, category, identifier, cells: row });
  }

  return {
    layout: {
      items,
      groups,
      timelineStart: TIMELINE_START,
      timelineEnd,
      statusCol,
      headerRow,
    },
  };
}

/** 小道具を同じものとして扱うためのキー */
export function itemKey(category: string, identifier: string): string {
  return `${normalizeName(category)}\u0000${normalizeName(normalizeSerial(identifier))}`;
}

/** メッセージで小道具を指すときの呼び方 */
export function itemLabel(item: { category: string; identifier: string; row: number }): string {
  const name = item.category ? `${item.category} ${item.identifier}` : item.identifier;
  return `${name}（${item.row}行目）`;
}

/** 同じ種類・番号の行が複数あれば、そのエラー文 */
export function duplicateItemErrors(items: SheetItem[]): string[] {
  const byKey = new Map<string, SheetItem[]>();
  for (const item of items) {
    const key = itemKey(item.category, item.identifier);
    byKey.set(key, [...(byKey.get(key) ?? []), item]);
  }
  const errors: string[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    errors.push(
      `${first.category}「${first.identifier}」が${group.length}行あります（${group
        .map((i) => i.row)
        .join("・")}行目）。番号を区別してください。`,
    );
  }
  return errors;
}

// ---------- 計画: 保有者の更新 ----------

export interface HolderPlan {
  item: SheetItem;
  /** 読んだセルの列(無ければ null) */
  sourceCol: number | null;
  parsed: ParsedCell;
  /** 状態列の値(状態列が無ければ undefined、読めなければ null) */
  condition?: PropConditionValue | null;
  conditionText?: string;
}

/** D列〜基準の列で、一番右に書かれたセルを読む */
export function planHolders(layout: SheetLayout, baseCol: number): HolderPlan[] {
  return layout.items.map((item) => {
    let sourceCol: number | null = null;
    for (let c = baseCol; c >= layout.timelineStart; c--) {
      if ((item.cells[c] ?? "").trim() !== "") {
        sourceCol = c;
        break;
      }
    }
    const parsed =
      sourceCol == null ? { names: [] } : parseNames(item.cells[sourceCol], "holder");
    const plan: HolderPlan = { item, sourceCol, parsed };
    if (layout.statusCol != null) {
      const text = (item.cells[layout.statusCol] ?? "").trim();
      plan.conditionText = text;
      plan.condition = parseCondition(text);
    }
    return plan;
  });
}

/** 基準の列として選べるか(時系列の列の範囲内か) */
export function isTimelineColumn(layout: SheetLayout, col: number): boolean {
  return col >= layout.timelineStart && col < layout.timelineEnd;
}

// ---------- 計画: 当日の受け渡し ----------

export interface HandoverPlan {
  item: SheetItem;
  /** 持ち帰る人(受け取る人) */
  receivers: string[];
  /** 渡す人の表示。null ならアプリ上の今の保有者 */
  givers: string[] | null;
  /** 持ち帰りの欄に書かれていたが反映しない理由 */
  skip?: string;
}

/** 対象日を含むお祭り */
export function findEventGroups(layout: SheetLayout, date: string): EventGroup[] {
  return layout.groups.filter((g) => g.dates.includes(date));
}

/**
 * お祭り当日の持ち帰り。
 * - すぐ右のリレー列(帰りがあれば帰り)に名前があればその人が持ち帰る
 * - 空欄ならお祭りの列の人(使った人)が持ち帰る
 * - 渡す人は、使った人のうち持ち帰らない人。いなければ行きの列の人
 *   (それもいなければ null = アプリ上の今の保有者)
 */
export function planHandovers(layout: SheetLayout, group: EventGroup): HandoverPlan[] {
  const back = group.relays.find((r) => r.kind === "back");
  const first = group.relays[0];
  const takeHomeCol = back?.col ?? (first && first.kind !== "go" ? first.col : null);
  const goCol = group.relays.find((r) => r.kind === "go")?.col ?? null;

  const plans: HandoverPlan[] = [];
  for (const item of layout.items) {
    const users = parseNames(item.cells[group.col] ?? "", "users").names;
    const takeHome =
      takeHomeCol == null
        ? { names: [] as string[] }
        : parseNames(item.cells[takeHomeCol] ?? "", "takeHome");
    if (takeHome.skip) {
      plans.push({ item, receivers: [], givers: null, skip: takeHome.skip });
      continue;
    }
    const receivers = takeHome.names.length > 0 ? takeHome.names : users;
    if (receivers.length === 0) continue;

    const receiverKeys = new Set(receivers.map(normalizeName));
    const notReceiving = (names: string[]) =>
      names.filter((n) => !receiverKeys.has(normalizeName(n)));
    const goers =
      goCol == null ? [] : parseNames(item.cells[goCol] ?? "", "users").names;
    const givers = notReceiving(users).length > 0
      ? notReceiving(users)
      : notReceiving(goers).length > 0
        ? notReceiving(goers)
        : null;
    plans.push({ item, receivers, givers });
  }
  return plans;
}

// ---------- 名前の照合 ----------

export type Resolution =
  | { serial: string }
  | { error: "notFound" }
  | { error: "ambiguous"; candidates: string[] }
  | { error: "badAlias"; serial: string };

export interface ResolverInput {
  /** 名前対応表(スプシでの名前, シリアル) */
  aliases: [string, string][];
  /** 名簿(全祭りの festival_participants) */
  roster: { serial: string; nickname: string }[];
  /** マスタにあるシリアル */
  serials: Set<string>;
}

export function createResolver(input: ResolverInput): (name: string) => Resolution {
  const aliasMap = new Map<string, string>();
  for (const [name, serial] of input.aliases) {
    const key = normalizeName(name ?? "");
    const value = normalizeSerial(serial ?? "");
    if (key !== "" && value !== "") aliasMap.set(key, value);
  }
  const rosterMap = new Map<string, Set<string>>();
  for (const p of input.roster) {
    const key = normalizeName(p.nickname ?? "");
    if (key === "") continue;
    const set = rosterMap.get(key) ?? new Set<string>();
    set.add(p.serial);
    rosterMap.set(key, set);
  }
  return (name: string): Resolution => {
    const key = normalizeName(name);
    const alias = aliasMap.get(key);
    if (alias != null) {
      return input.serials.has(alias) ? { serial: alias } : { error: "badAlias", serial: alias };
    }
    const found = rosterMap.get(key);
    if (found && found.size === 1) return { serial: [...found][0] };
    if (found && found.size > 1) {
      return { error: "ambiguous", candidates: [...found].sort() };
    }
    const asSerial = normalizeSerial(name);
    if (input.serials.has(asSerial)) return { serial: asSerial };
    return { error: "notFound" };
  };
}

/** 照合できなかったときのエラー文 */
export function resolutionError(
  item: { category: string; identifier: string; row: number },
  name: string,
  result: Extract<Resolution, { error: unknown }>,
): string {
  const where = `${itemLabel(item)}の行の「${name}」`;
  switch (result.error) {
    case "ambiguous":
      return `${where}に当てはまる人が複数います（${result.candidates.join("・")}）。名前対応表でシリアルを指定してください。`;
    case "badAlias":
      return `${where}は、名前対応表のシリアル「${result.serial}」がアプリの名簿にありません。名前対応表を確認してください。`;
    default:
      return `${where}について、特定ができませんでした。表記をアプリ上の名簿と一致させるようにしてください。`;
  }
}

// ---------- アプリの現状と突き合わせる ----------

export interface DbItem {
  id: string;
  category: string;
  identifier: string;
  condition: string;
  holders: string[];
  isArchived: boolean;
}

export interface DbTransfer {
  id: string;
  itemId: string;
  status: string;
  sheetDate: string | null;
  receivers: string[];
}

export interface DbSnapshot {
  items: DbItem[];
  /** 未完了の予定と、対象日のスプシ由来の予定 */
  transfers: DbTransfer[];
  /** シリアル → 表示名 */
  names: Map<string, string>;
}

export interface SyncReport {
  errors: string[];
  notices: string[];
  changes: string[];
}

const CONDITION_LABEL: Record<string, string> = {
  normal: "正常",
  damaged: "破損",
  broken: "故障",
  lost: "紛失",
  repairing: "修理中",
  retired: "使用停止",
};

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((s) => b.includes(s));

function people(serials: string[], names: Map<string, string>): string {
  return serials.length === 0
    ? "なし"
    : serials.map((s) => names.get(s) ?? s).join("・");
}

/** 名前を全員シリアルにする。1人でも特定できなければ null(エラーは errors へ) */
function resolveAll(
  item: SheetItem,
  names: string[],
  resolve: (name: string) => Resolution,
  errors: string[],
): string[] | null {
  const serials: string[] = [];
  let ok = true;
  for (const name of names) {
    const r = resolve(name);
    if (!("error" in r)) {
      if (!serials.includes(r.serial)) serials.push(r.serial);
    } else {
      errors.push(resolutionError(item, name, r));
      ok = false;
    }
  }
  return ok ? serials.sort() : null;
}

export interface HolderPayloadItem {
  item_id?: string;
  category: string;
  identifier: string;
  holders?: string[];
  condition?: string;
}

/** 保有者・状態の更新で、アプリに送るものと表示する文言を作る */
export function buildHolderSync(
  layout: SheetLayout,
  baseCol: number,
  resolve: (name: string) => Resolution,
  db: DbSnapshot,
): SyncReport & { payload: HolderPayloadItem[] } {
  const report: SyncReport = { errors: [], notices: [], changes: [] };
  const payload: HolderPayloadItem[] = [];
  const duplicates = duplicateItemErrors(layout.items);
  report.errors.push(...duplicates);
  const duplicateKeys = new Set(
    layout.items
      .map((i) => itemKey(i.category, i.identifier))
      .filter((k, idx, all) => all.indexOf(k) !== idx),
  );
  const dbByKey = new Map(db.items.map((i) => [itemKey(i.category, i.identifier), i]));
  let emptyRows = 0;

  for (const plan of planHolders(layout, baseCol)) {
    const { item, parsed } = plan;
    const key = itemKey(item.category, item.identifier);
    if (duplicateKeys.has(key)) continue;
    if (item.category === "") {
      report.errors.push(
        `${itemLabel(item)}は種類（A列）が分かりません。A列の結合を確認してください。`,
      );
      continue;
    }
    const existing = dbByKey.get(key);
    const entry: HolderPayloadItem = {
      ...(existing ? { item_id: existing.id } : {}),
      category: item.category,
      identifier: item.identifier,
    };
    const label = `${item.category} ${item.identifier}`;
    const lines: string[] = [];

    // 保有者
    if (parsed.skip) {
      report.notices.push(
        `${itemLabel(item)}: 「${(item.cells[plan.sourceCol ?? 0] ?? "").trim()}」のため保有者は変えません。`,
      );
    } else if (plan.sourceCol != null && parsed.names.length === 0) {
      report.notices.push(
        `${itemLabel(item)}: 「${(item.cells[plan.sourceCol] ?? "").trim()}」から名前が読み取れないため、保有者は変えません。`,
      );
    } else if (parsed.names.length > 0) {
      const serials = resolveAll(item, parsed.names, resolve, report.errors);
      if (serials && !(existing && sameSet(serials, existing.holders))) {
        entry.holders = serials;
        lines.push(
          existing
            ? `${label}: ${people(existing.holders, db.names)} → ${people(serials, db.names)}`
            : `${label}: ${people(serials, db.names)}`,
        );
      }
    }

    // 状態
    if (plan.condition === null) {
      report.errors.push(
        `${itemLabel(item)}の状態「${plan.conditionText}」が読み取れません。正常・破損・故障・紛失・修理中・使用停止のどれかにしてください。`,
      );
    } else if (plan.condition !== undefined) {
      const hasInfo = plan.conditionText !== "";
      if (existing ? existing.condition !== plan.condition : hasInfo) {
        entry.condition = plan.condition;
        lines.push(`${label}: 状態を「${CONDITION_LABEL[plan.condition]}」に`);
      }
    }

    if (!existing) {
      if (entry.holders || entry.condition) {
        payload.push(entry);
        report.changes.push(`新しく登録: ${lines.join(" / ") || label}`);
      } else {
        emptyRows++;
      }
      continue;
    }
    if (entry.holders || entry.condition) {
      payload.push(entry);
      report.changes.push(...lines);
    }
  }
  if (emptyRows > 0) {
    report.notices.push(
      `保有者も状態も書かれていない ${emptyRows} 行は、アプリに登録しませんでした。`,
    );
  }
  return { ...report, payload };
}

export interface HandoverPayloadItem {
  item_id: string;
  receivers: string[];
  givers?: string[];
}

/** 当日の受け渡し予定で、アプリに送るものと表示する文言を作る */
export function buildHandoverSync(
  layout: SheetLayout,
  group: EventGroup,
  resolve: (name: string) => Resolution,
  db: DbSnapshot,
): SyncReport & { payload: HandoverPayloadItem[]; keep: string[]; date: string; label: string } {
  const report: SyncReport = { errors: [], notices: [], changes: [] };
  const payload: HandoverPayloadItem[] = [];
  const keep: string[] = [];
  const date = group.dates[group.dates.length - 1];
  const label = `${group.name} ${group.dateText}`.trim();
  const dbByKey = new Map(db.items.map((i) => [itemKey(i.category, i.identifier), i]));
  const dbById = new Map(db.items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  let unchanged = 0;

  for (const plan of planHandovers(layout, group)) {
    const { item } = plan;
    const existing = dbByKey.get(itemKey(item.category, item.identifier));
    if (plan.skip) {
      report.notices.push(`${itemLabel(item)}: 「${plan.skip}」のため受け渡しは作りません。`);
      if (existing) keep.push(existing.id);
      continue;
    }
    if (!existing) {
      report.errors.push(
        `${itemLabel(item)}はアプリに登録されていません。先に「保有者・状態を更新」を押してください。`,
      );
      continue;
    }
    const receivers = resolveAll(item, plan.receivers, resolve, report.errors);
    const givers = plan.givers
      ? resolveAll(item, plan.givers, resolve, report.errors)
      : [];
    if (!receivers || !givers) {
      keep.push(existing.id);
      continue;
    }
    const sameDay = db.transfers.filter(
      (t) => t.itemId === existing.id && t.sheetDate === date,
    );
    if (sameDay.some((t) => t.status === "completed")) {
      report.notices.push(`${itemLabel(item)}: すでに受け取り済みのため、変えません。`);
      keep.push(existing.id);
      continue;
    }
    const manual = db.transfers.find(
      (t) => t.itemId === existing.id && t.status === "pending" && t.sheetDate == null,
    );
    if (manual) {
      report.errors.push(
        `${itemLabel(item)}には手作業で作った受け渡し予定が残っています。小道具管理で取り消してから反映してください。`,
      );
      keep.push(existing.id);
      continue;
    }
    const pendingSameDay = sameDay.find((t) => t.status === "pending");
    if (!pendingSameDay && sameSet(receivers, existing.holders)) {
      unchanged++;
      continue;
    }
    seen.add(existing.id);
    payload.push({
      item_id: existing.id,
      receivers,
      ...(givers.length > 0 ? { givers } : {}),
    });
    const from = givers.length > 0 ? givers : existing.holders;
    if (!(pendingSameDay && sameSet(pendingSameDay.receivers, receivers))) {
      report.changes.push(
        `${item.category} ${item.identifier}: ${people(from, db.names)} → ${people(receivers, db.names)}`,
      );
    }
  }

  // この日の予定のうち、スプシから外れたもの
  for (const t of db.transfers) {
    if (t.sheetDate !== date || t.status !== "pending") continue;
    if (seen.has(t.itemId) || keep.includes(t.itemId)) continue;
    const it = dbById.get(t.itemId);
    report.changes.push(
      `取り消し: ${it ? `${it.category} ${it.identifier}` : "小道具"}（スプレッドシートの予定から外れたため）`,
    );
  }
  if (unchanged > 0) {
    report.notices.push(`持ち帰る人が今の保有者と同じ ${unchanged} 件は、受け渡しを作りません。`);
  }
  return { ...report, payload, keep, date, label };
}

// ---------- 表示 ----------

const MAX_LINES = 15;

function section(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  const shown = lines.slice(0, MAX_LINES).map((l) => `・${l}`);
  if (lines.length > MAX_LINES) shown.push(`…ほか ${lines.length - MAX_LINES} 件`);
  return `${title}\n${shown.join("\n")}`;
}

/** ポップアップ・結果欄に出す文 */
export function formatReport(title: string, report: SyncReport): string {
  return [
    title,
    section(
      `エラー ${report.errors.length} 件（この小道具は反映しません）`,
      report.errors,
    ),
    section(`反映する内容 ${report.changes.length} 件`, report.changes),
    section("お知らせ", report.notices),
    report.changes.length === 0 && report.errors.length === 0
      ? "反映が必要なものはありません。"
      : "",
  ]
    .filter((s) => s !== "")
    .join("\n\n");
}
