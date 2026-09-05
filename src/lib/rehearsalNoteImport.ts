// LINE のノートに書かれたリハーサルの案内を、そのまま貼り付けて読み取る。
//
// ノートは人が書いた文章なので、解釈できない部分を推測で埋めない。
// 拾えたものだけを候補として返し、画面側で1件ずつ直してから登録させる。
//
// ============================================================
// 読み取りのルール
// ============================================================
//
// A. 文字をそろえる(cleanText / normalizeLine)
//   A1 全角の英数・記号は半角にする(１０／３ → 10/3)
//   A2 全角スペースは半角に、連続する空白はひとつにまとめる
//   A3 絵文字・異体字セレクタ・ZWJ は落とす
//   A4 波ダッシュと長音(〜 ～ ﹣ － ー – —)を ~ に寄せるのは、
//      時刻を読むときだけ。そのまま画面に出す文字列には使わない
//      (「ハーフタイムショー」が壊れるため)
//   A5 行頭の丸数字・「1)」「2.」のような番号は落とす(日付を読むときだけ)
//
// B. ノートのどこを読むか(pickRehearsalSection)
//   B1 「リハ」を含む見出し行から下を読む。見出しが無ければ全文を読む
//      (節だけを切り取って貼ることもできる)
//   B2 【…】《…》■◾◇◆ ではじまる行が来たら、そこで終わり
//   B3 絵文字ではじまる行が来たら、次の空でない行を見る
//      月日ではじまる → リハを分ける小見出し(⛰️千葉)として読み進める
//      そうでない     → 別の話題(🔸新規さん向け企画)なので終わり
//   B4 月日ではじまる行は、絵文字が付いていてもリハとして読む
//
// C. 1件ずつに切る(parseNote)
//   C1 月日ではじまる行が1件の始まり
//   C2 空行までがその1件の本文。空行より後ろは次の月日まで読み捨てる
//      (節の末尾に書かれた連絡事項を巻き込まないため)
//   C3 最初の月日より前の行は前置きとして捨てる
//
// D. 見出し行から読む値
//   D1 月/日 → 日付。1〜12月・1〜31日から外れる数字は日付とみなさない
//   D2 年はノートに無いため、前年・当年・翌年のうち貼り付けた日に
//      いちばん近い年を選ぶ(12月に翌年1月のリハを案内する場合も合う)
//   D3 時刻は「18:00〜21:30」「20:30〜23」「12〜15」「18〜21:30」に対応し、
//      分の指定が無い側は00分とする
//   D4 範囲になっていない「18:00」は開始だけ。24以上の数字は時刻としない
//   D5 読み取れなければ null。推測で埋めない
//
// E. 本文の行の割り当て(上から順に)
//   E1 http(s):// だけの行 → 会場のURL(最初の1つだけ)
//   E2 ※ * ではじまる行  → 特記事項
//   E3 残りの1行目        → 会場名
//   E4 残りの2行目        → 目的・内容
//   E5 残り              → 特記事項に足す
//
// F. 読み取らないもの
//   F1 会場の住所(ノートに書かれないので空のまま。地図は会場名で検索する)
//   F2 元の見出し行はそのまま残す(画面で照合できるように)
//
// ============================================================
// 想定している書き方(実際のノートより)
// ============================================================
//
//   🔸リハーサル
//   ①9/5土　18:00〜21:30
//   志村コミュニティホール第一レク
//   https://www.city.itabashi.tokyo.jp/...
//   配置、構成確認
//
//   ③9/13日　12〜15
//   日産スタジアム
//   https://www.nissan-stadium.jp/...
//   ※17時過ぎから土佐清水ワールドで本番なので早めに終わる🙏
//
// 祭りごとに小見出しで分かれていることもある:
//
//   🔸リハーサル日
//   ⛰️千葉　ng1回まで
//   ①9/26土　18〜21:30
//   仲宿地域センターレクホール
//
//   🌇東京&ハーフタイムショー　ng1回まで
//   ①9/27日　10〜13
//   日産スタジアム

export interface NoteRehearsal {
  /** YYYY-MM-DD(年はノートに無いので開催時期から補う) */
  date: string;
  /** HH:MM。読み取れなければ null */
  startTime: string | null;
  endTime: string | null;
  venueName: string;
  venueUrl: string | null;
  /** 目的・内容。ノートに書かれていないことがある */
  title: string;
  note: string;
  /** 元の見出し行(画面で照合できるように残す) */
  sourceLine: string;
  /**
   * ノート内のまとまり(「千葉」「東京&ハーフタイムショー」など)。
   * 1つのノートに複数の祭りのリハが載ることがあるため、
   * どちらのものかを画面で見分けられるようにする。小見出しが無ければ空。
   */
  group: string;
}

/** 絵文字の範囲。A3(落とす)と B3(見出しの判定)で同じものを使う */
const EMOJI_RANGE = "\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}";
const EMOJI_RE = new RegExp(`[${EMOJI_RANGE}\\u{FE0F}\\u{200D}]`, "gu");

/** A1〜A3。全角を半角にし、絵文字と余分な空白を落とす */
export function cleanText(line: string): string {
  return line
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(EMOJI_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A4。見出し行の時刻を読むための整形。
 * 「ハーフタイムショー」が「ハ~フタイムショ~」になるので、
 * そのまま画面に出す文字列には使わない(cleanText を使うこと)。
 */
export function normalizeLine(line: string): string {
  return cleanText(line).replace(/[〜～~﹣－ー–—]/g, "~");
}

/** A5。丸数字・箇条書きの記号を先頭から落とす */
function stripBullet(line: string): string {
  return line.replace(/^[\s①-⑳❶-❿]*(?:\(?\d{1,2}[).．、]\s*)?/, "").trim();
}

const URL_RE = /https?:\/\/\S+/;
/** 見出し行は「9/5」のような月日で始まる(URL 行は除く) */
const DATE_RE = /^(\d{1,2})\/(\d{1,2})/;

function isUrlLine(line: string): boolean {
  return /^\s*https?:\/\//.test(line);
}

/** D1。丸数字や番号を外したうえで月日ではじまるか */
function headerDate(line: string): { month: number; day: number } | null {
  if (isUrlLine(line)) return null;
  const m = DATE_RE.exec(stripBullet(normalizeLine(line)));
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** D3〜D5。見出し行の時刻を読み取る */
export function parseTimeRange(rest: string): {
  start: string | null;
  end: string | null;
} {
  const range =
    /(\d{1,2})(?::(\d{2}))?\s*~\s*(\d{1,2})(?::(\d{2}))?/.exec(rest);
  if (range) {
    const sh = Number(range[1]);
    const eh = Number(range[3]);
    if (sh <= 23 && eh <= 23) {
      return {
        start: `${pad(sh)}:${range[2] ?? "00"}`,
        end: `${pad(eh)}:${range[4] ?? "00"}`,
      };
    }
  }
  // 範囲になっていない単独の時刻(「18:00から」など)
  const single = /(\d{1,2}):(\d{2})/.exec(rest);
  if (single && Number(single[1]) <= 23) {
    return { start: `${pad(Number(single[1]))}:${single[2]}`, end: null };
  }
  return { start: null, end: null };
}

/**
 * D2。年を補う。ノートに年が無いため、
 * 前年・当年・翌年のうち基準日にいちばん近い年を選ぶ。
 * 12月に翌年1月のリハを案内する場合も正しく翌年になる。
 */
export function resolveYear(
  month: number,
  day: number,
  base: Date,
  timeZone = "Asia/Tokyo",
): number {
  const baseYmd = new Intl.DateTimeFormat("sv-SE", { timeZone }).format(base);
  const baseTime = new Date(`${baseYmd}T00:00:00+09:00`).getTime();
  const baseYear = Number(baseYmd.slice(0, 4));
  let best = baseYear;
  let bestDiff = Infinity;
  for (const year of [baseYear - 1, baseYear, baseYear + 1]) {
    const t = new Date(
      `${year}-${pad(month)}-${pad(day)}T00:00:00+09:00`,
    ).getTime();
    if (Number.isNaN(t)) continue;
    const diff = Math.abs(t - baseTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = year;
    }
  }
  return best;
}

/** B2。【…】《…》のような、明らかに別の話題を始める見出し */
const BLOCK_HEAD_RE = /^\s*[【《■◾◇◆]/u;
/** B3。絵文字ではじまる見出し(🔸リハーサル日 / ⛰️千葉 など) */
const EMOJI_HEAD_RE = new RegExp(`^\\s*[${EMOJI_RANGE}]\\u{FE0F}?`, "u");

function isSectionHead(line: string): boolean {
  return BLOCK_HEAD_RE.test(line) || EMOJI_HEAD_RE.test(line);
}

/** 節の中の1行と、その行が属するまとまり */
export interface SectionLine {
  text: string;
  group: string;
}

/** B1〜B4。ノート全体から「リハーサル」の節だけを取り出す */
export function pickRehearsalSection(text: string): SectionLine[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => isSectionHead(l) && l.includes("リハ"));
  if (start < 0) return lines.map((t) => ({ text: t, group: "" }));

  const out: SectionLine[] = [];
  let group = "";
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    // B4。絵文字つきの行が月日ではじまることもあるので、先に月日を見る
    if (headerDate(line) != null || !isSectionHead(line)) {
      out.push({ text: line, group });
      continue;
    }
    if (BLOCK_HEAD_RE.test(line)) break; // B2
    const next = lines.slice(i + 1).find((l) => l.trim() !== "");
    if (next == null || headerDate(next) == null) break; // B3(別の話題)
    group = cleanText(line); // B3(小見出し)。見出し自体は本文に入れない
  }
  return out;
}

interface NoteBlock {
  date: { month: number; day: number };
  head: string;
  group: string;
  body: string[];
  /** 空行が来たらそのリハの記述は終わり(あとに続く文章を巻き込まない) */
  closed: boolean;
}

/** C・D・E。ノートを読み取ってリハの候補を返す */
export function parseNote(text: string, now = new Date()): NoteRehearsal[] {
  const lines = pickRehearsalSection(text);
  const blocks: NoteBlock[] = [];

  for (const { text: raw, group } of lines) {
    const date = headerDate(raw);
    if (date) {
      blocks.push({ date, head: raw, group, body: [], closed: false });
      continue;
    }
    if (blocks.length === 0) continue; // C3。節の前置き
    const current = blocks[blocks.length - 1];
    if (raw.trim() === "") {
      current.closed = true; // C2
      continue;
    }
    if (current.closed) continue;
    current.body.push(raw);
  }

  return blocks.map(({ date, head, group, body }) => {
    const normalizedHead = stripBullet(normalizeLine(head));
    const afterDate = normalizedHead.replace(DATE_RE, "");
    const { start, end } = parseTimeRange(afterDate);

    let venueUrl: string | null = null;
    const notes: string[] = [];
    const plain: string[] = [];

    for (const line of body) {
      // E1。URL だけの行は会場のページ。文中に URL がある行はそのまま残す
      if (isUrlLine(line)) {
        venueUrl ??= URL_RE.exec(line)?.[0] ?? null;
        continue;
      }
      const trimmed = line.trim();
      if (/^[※*]/.test(trimmed)) {
        notes.push(trimmed.replace(/^[※*]\s*/, "")); // E2
        continue;
      }
      plain.push(trimmed);
    }

    const venueName = plain.shift() ?? ""; // E3
    const title = plain.shift() ?? ""; // E4
    notes.push(...plain); // E5

    return {
      date: `${resolveYear(date.month, date.day, now)}-${pad(date.month)}-${pad(date.day)}`,
      startTime: start,
      endTime: end,
      venueName,
      venueUrl,
      title,
      note: notes.join("\n"),
      sourceLine: head.trim(),
      group,
    };
  });
}
