import type { FestivalData } from "../../types/domain";

// 祭り切替(ヘッダーのプルダウン)を Supabase なしでも確認するための
// 2つ目の mock 祭り。内容は最小限。

function iso(dayOffset: number, h: number, m: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function dateStr(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return new Intl.DateTimeFormat("sv-SE").format(d);
}

const festivalId = "f-harajuku-2026";
const day1 = "hj-d-1";

export const harajuku2026: FestivalData = {
  festival: {
    id: festivalId,
    slug: "harajuku-2026",
    name: "2026年 原宿よさこい",
    // 渋谷区(原宿周辺)の天気予報地点
    weatherLat: 35.6702,
    weatherLng: 139.7026,
  },
  days: [
    { id: day1, festivalId, date: dateStr(0), label: "本祭", sortOrder: 1 },
  ],
  locations: [
    {
      id: "hj-loc-yoyogi",
      festivalId,
      kind: "meeting_point",
      name: "代々木公園 けやき並木入口",
      lat: 35.6717,
      lng: 139.6995,
      address: "渋谷区神南2丁目",
      description: "けやき並木の北端に集合。",
    },
  ],
  venueRoutes: [],
  scheduleItems: [
    {
      id: "hj-item-1",
      festivalDayId: day1,
      title: "表参道アベニュー",
      category: "performance",
      gatherTime: iso(0, 13, 0),
      startTime: iso(0, 13, 30),
      endTime: iso(0, 13, 45),
      venueName: "表参道アベニュー",
      meetingLocationId: "hj-loc-yoyogi",
      isConfirmed: true,
      isCancelled: false,
      sortOrder: 1,
    },
  ],
  announcements: [
    {
      id: "hj-ann-1",
      festivalId,
      title: "原宿よさこいへようこそ",
      body: "こちらは原宿よさこいのお知らせです。",
      priority: "normal",
      publishedAt: iso(0, 9, 0),
    },
  ],
};
