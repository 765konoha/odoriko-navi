import type { Attendance, Rehearsal } from "../../types/rehearsal";
import type { ImportRow } from "../../lib/attendanceImport";

// Supabase 未設定(mock モード)でリハ画面を動かすための、メモリ上のダミーデータ。
// 本番では supabase 側が使われるため、ここは開発時の確認専用。
// リロードすると初期状態に戻る。

/** 日本時間の「今日 + dayOffset 日」の h:m を ISO で返す(端末のタイムゾーンに依存しない) */
function iso(dayOffset: number, h: number, m: number): string {
  const jstToday = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  const d = new Date(`${jstToday}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  const ymd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(d);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${ymd}T${hh}:${mm}:00+09:00`).toISOString();
}

const festivalId = "f-harajuku-2026";
const kochiId = "f-kochi-2026";

let rehearsals: Rehearsal[] = [
  {
    id: "hj-reh-1",
    festivalId,
    title: "配置、構成確認",
    startsAt: iso(-9, 18, 30),
    endsAt: iso(-9, 21, 0),
    venueName: "志村コミュニティホール 第一レクリエーションホール",
    venueAddress: "東京都板橋区志村1-13-1",
    isCancelled: false,
  },
  {
    id: "hj-reh-2",
    festivalId,
    title: "踊りこみ、固め",
    startsAt: iso(-4, 18, 0),
    endsAt: iso(-4, 21, 0),
    venueName: "ミハタホール(八幡山)",
    venueAddress: "東京都杉並区上高井戸1-8-14",
    isCancelled: false,
  },
  {
    id: "hj-reh-3",
    festivalId,
    title: "踊りこみ",
    startsAt: iso(2, 13, 0),
    endsAt: iso(2, 16, 0),
    venueName: "日産スタジアム 大会議室",
    venueAddress: "神奈川県横浜市港北区小机町3300",
    note: "17時過ぎから土佐清水ワールドで本番なので早めに終わります",
    isCancelled: false,
  },
  {
    id: "hj-reh-4",
    festivalId,
    title: "最終確認",
    startsAt: iso(6, 18, 30),
    endsAt: iso(6, 21, 0),
    venueName: "代々木公園 ステージ付近",
    venueAddress: "東京都渋谷区代々木神園町2-1",
    venueUrl: "https://www.tokyo-park.or.jp/park/yoyogi/",
    isCancelled: false,
  },
  {
    id: "hj-reh-5",
    festivalId,
    title: "予備日",
    startsAt: iso(8, 18, 30),
    venueName: "志村コミュニティホール 第一レクリエーションホール",
    isCancelled: true,
  },
  {
    id: "kc-reh-1",
    festivalId: kochiId,
    title: "地方車前 通し稽古",
    startsAt: iso(1, 19, 0),
    endsAt: iso(1, 21, 0),
    venueName: "高知市中央公民館 大ホール",
    venueAddress: "高知県高知市本町5-6-42",
    isCancelled: false,
  },
];

let attendances: Attendance[] = [
  { rehearsalId: "kc-reh-1", serial: "001", status: "present" },
  { rehearsalId: "kc-reh-1", serial: "115", status: "late", timeNote: "19:40in" },
  { rehearsalId: "hj-reh-1", serial: "615", status: "present" },
  { rehearsalId: "hj-reh-1", serial: "216", status: "late", timeNote: "19:30in" },
  { rehearsalId: "hj-reh-1", serial: "706", status: "absent" },
  { rehearsalId: "hj-reh-2", serial: "615", status: "leave_early", timeNote: "20:00out" },
  { rehearsalId: "hj-reh-2", serial: "216", status: "present" },
  { rehearsalId: "hj-reh-3", serial: "615", status: "present" },
  { rehearsalId: "hj-reh-3", serial: "216", status: "late_leave_early", timeNote: "14:00in 15:30out" },
  { rehearsalId: "hj-reh-3", serial: "706", status: "present" },
  { rehearsalId: "hj-reh-4", serial: "615", status: "late", timeNote: "19:00in" },
];

export function mockListRehearsals(id: string): Rehearsal[] {
  return rehearsals
    .filter((r) => r.festivalId === id)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function mockListAttendances(rehearsalIds: string[]): Attendance[] {
  const ids = new Set(rehearsalIds);
  return attendances.filter((a) => ids.has(a.rehearsalId));
}

export function mockCreateRehearsal(r: Omit<Rehearsal, "id">): void {
  rehearsals = [...rehearsals, { ...r, id: `hj-reh-${crypto.randomUUID()}` }];
}

export function mockUpdateRehearsal(id: string, r: Omit<Rehearsal, "id">): void {
  rehearsals = rehearsals.map((x) => (x.id === id ? { ...r, id } : x));
}

export function mockDeleteRehearsal(id: string): void {
  rehearsals = rehearsals.filter((r) => r.id !== id);
  attendances = attendances.filter((a) => a.rehearsalId !== id);
}

export function mockImportAttendances(rehearsalId: string, rows: ImportRow[]): void {
  const incoming = new Set(rows.map((r) => r.serial));
  attendances = [
    ...attendances.filter(
      (a) => a.rehearsalId !== rehearsalId || !incoming.has(a.serial),
    ),
    ...rows.map((r) => ({
      rehearsalId,
      serial: r.serial,
      status: r.status,
      timeNote: r.timeNote,
    })),
  ];
}
