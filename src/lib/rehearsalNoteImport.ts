// LINE のノートに書かれたリハーサルの案内を、そのまま貼り付けて読み取る。
//
// ノートは人が書いた文章なので、解釈できない部分を推測で埋めない。
// 拾えたものだけを候補として返し、画面側で1件ずつ直してから登録させる。
//
// 想定している書き方(実際のノートより):
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

/** 全角の英数・記号を半角にし、絵文字と異体字セレクタを落とす */
export function cleanText(line: string): string {
  return line
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 見出し行を読むための整形。
 * 時刻の範囲を読み取るため、波ダッシュや長音を ~ に寄せる。
 * 「ハーフタイムショー」が「ハ~フタイムショ~」になるので、
 * そのまま見せる文字列には使わない(cleanText を使うこと)。
 */
export function normalizeLine(line: string): string {
  return cleanText(line).replace(/[〜～~﹣－ー–—]/g, "~");
}

/** 丸数字・箇条書きの記号を先頭から落とす */
function stripBullet(line: string): string {
  return line.replace(/^[\s①-⑳❶-❿]*(?:\(?\d{1,2}[).．、]\s*)?/, "").trim();
}

const URL_RE = /https?:\/\/\S+/;
/** 見出し行は「9/5」のような月日で始まる(URL 行は除く) */
const DATE_RE = /^(\d{1,2})\/(\d{1,2})/;

function isUrlLine(line: string): boolean {
  return /^\s*https?:\/\//.test(line);
}

/** 見出し行かどうか(丸数字や番号を外したうえで月日で始まるか) */
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

/**
 * 見出し行の時刻を読み取る。
 * 「18:00〜21:30」「20:30〜23」「12〜15」「18:00」に対応し、
 * 分の指定が無い側は 00 分として扱う。
 */
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
 * 年を補う。ノートに年が無いため、基準日から前後6か月に収まる年を選ぶ。
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

/** 【…】《…》のような、明らかに別の話題を始める見出し */
const BLOCK_HEAD_RE = /^\s*[【《■◾◇◆]/u;
/** 絵文字ではじまる見出し(🔸リハーサル日 / ⛰️千葉 など) */
const EMOJI_HEAD_RE = /^\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?/u;

function isSectionHead(line: string): boolean {
  return BLOCK_HEAD_RE.test(line) || EMOJI_HEAD_RE.test(line);
}

/** 節の中の1行と、その行が属するまとまり */
export interface SectionLine {
  text: string;
  group: string;
}

/**
 * ノート全体から「リハーサル」の節だけを取り出す。
 * 見つからなければ全文を返す(節だけを貼った場合に対応するため)。
 *
 * 節の終わりの見きわめ:
 * - 【…】《…》は別の話題なので、そこで終わり
 * - 絵文字の見出しは、すぐ後ろに月日の行が続いていればリハを分ける小見出し
 *   (「⛰️千葉」「🌇東京&ハーフタイムショー」)として読み進める。
 *   続いていなければ別の話題(「🔸新規さん向け企画」)なので終わり
 */
export function pickRehearsalSection(text: string): SectionLine[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => isSectionHead(l) && l.includes("リハ"));
  if (start < 0) return lines.map((t) => ({ text: t, group: "" }));

  const out: SectionLine[] = [];
  let group = "";
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    // 絵文字つきの見出し行が月日ではじまることもあるので、先に月日を見る
    if (headerDate(line) != null || !isSectionHead(line)) {
      out.push({ text: line, group });
      continue;
    }
    if (BLOCK_HEAD_RE.test(line)) break;
    const next = lines.slice(i + 1).find((l) => l.trim() !== "");
    if (next == null || headerDate(next) == null) break;
    group = cleanText(line); // 小見出し自体は本文に入れない
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

/**
 * ノートを読み取ってリハの候補を返す。
 * 見出し行(月日)ごとに区切り、続く行を
 * URL / ※ではじまる注記 / 会場名 / 目的 の順に割り当てる。
 * 空行までを1件分とみなす(節の末尾に書かれた連絡事項を混ぜないため)。
 */
export function parseNote(text: string, now = new Date()): NoteRehearsal[] {
  const lines = pickRehearsalSection(text);
  const blocks: NoteBlock[] = [];

  for (const { text: raw, group } of lines) {
    const date = headerDate(raw);
    if (date) {
      blocks.push({ date, head: raw, group, body: [], closed: false });
      continue;
    }
    if (blocks.length === 0) continue; // 節の前置き
    const current = blocks[blocks.length - 1];
    if (raw.trim() === "") {
      current.closed = true;
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
      const url = URL_RE.exec(line);
      if (url) {
        // URL だけの行は会場のページとして扱い、文中の URL は注記に残す
        if (isUrlLine(line)) {
          venueUrl ??= url[0];
          continue;
        }
      }
      const trimmed = line.trim();
      if (/^[※*]/.test(trimmed)) {
        notes.push(trimmed.replace(/^[※*]\s*/, ""));
        continue;
      }
      plain.push(trimmed);
    }

    const venueName = plain.shift() ?? "";
    const title = plain.shift() ?? "";
    notes.push(...plain);

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
