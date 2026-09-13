import type { PropItem, PropTransfer } from "../../types/props";

// Supabase 未設定(mock モード)で小道具の画面と受け渡しの案内を動かすための
// メモリ上のダミーデータ。本番では supabase 側が使われる。
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

const items: PropItem[] = [
  {
    id: "mock-prop-flag",
    category: "旗",
    identifier: "A",
    displayName: "大旗A",
    condition: "normal",
    currentHolderSerial: "615",
    isArchived: false,
  },
  {
    id: "mock-prop-naruko",
    category: "鳴子",
    identifier: "予備1",
    displayName: "鳴子(予備)1式",
    condition: "normal",
    currentHolderSerial: "706",
    isArchived: false,
  },
  {
    id: "mock-prop-speaker",
    category: "音響",
    identifier: "S1",
    displayName: "スピーカーS1",
    condition: "normal",
    currentHolderSerial: "216",
    isArchived: false,
  },
];

// 615 から見て:
// - 大旗A は「今日(祭り当日)」に 706 へ渡す → 渡す側の案内
// - スピーカーS1 は「今日」に 216 から受け取る → 受け取る側の案内
// - 鳴子は「明日(次のリハの日)」に 706 から受け取る → リハの箱の中の案内
const transfers: PropTransfer[] = [
  {
    id: "mock-tr-flag",
    propItemId: "mock-prop-flag",
    fromSerial: "615",
    toSerial: "706",
    status: "pending",
    scheduledAt: iso(0, 8, 30),
    createdAt: iso(-3, 12, 0),
  },
  {
    id: "mock-tr-speaker",
    propItemId: "mock-prop-speaker",
    fromSerial: "216",
    toSerial: "615",
    status: "pending",
    scheduledAt: iso(0, 20, 0),
    createdAt: iso(-3, 12, 0),
  },
  {
    id: "mock-tr-naruko",
    propItemId: "mock-prop-naruko",
    fromSerial: "706",
    toSerial: "615",
    status: "pending",
    scheduledAt: iso(1, 19, 0),
    createdAt: iso(-2, 12, 0),
  },
];

export function mockPropItems(): PropItem[] {
  return items.map((i) => ({ ...i }));
}

export function mockPendingTransfers(): PropTransfer[] {
  return transfers.map((t) => ({ ...t }));
}
