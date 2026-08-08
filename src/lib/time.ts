const TZ = "Asia/Tokyo";

const timeFmt = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
});

const dateLabelFmt = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
  timeZone: TZ,
});

const ymdFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ });

/** ISO文字列 → "16:00" */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "2026-08-10" → "8/10(月)" */
export function formatDateLabel(dateStr: string): string {
  return dateLabelFmt.format(new Date(`${dateStr}T00:00:00+09:00`));
}

/** ISO文字列 → "2026-08-10"(JST基準) */
export function toDateString(iso: string): string {
  return ymdFmt.format(new Date(iso));
}

/** 今日の日付 "YYYY-MM-DD"(JST基準) */
export function todayString(): string {
  return ymdFmt.format(new Date());
}

/** now から iso までの分数(過去なら負) */
export function minutesUntil(iso: string, now: Date): number {
  return Math.floor((new Date(iso).getTime() - now.getTime()) / 60_000);
}

/** 分数 → "38分" / "1時間12分" */
export function formatDuration(min: number): string {
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}
