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
    danceCountEnabled: false,
    isActive: true,
  },
  roles: [
    { id: "hj-role-leader", festivalId, name: "リーダー", isDefault: false, sortOrder: 1 },
    { id: "hj-role-dancer", festivalId, name: "踊り子一般", isDefault: true, sortOrder: 2 },
    { id: "hj-role-manager", festivalId, name: "マネージャー", isDefault: false, sortOrder: 3 },
    { id: "hj-role-singer", festivalId, name: "歌い手・煽り", isDefault: false, sortOrder: 4 },
  ],
  participants: [
    // 615=荷物グループ3のリーダー / 706=同グループの一般メンバー / 216=未配属
    { id: "hj-p-615", festivalId, serial: "615", name: "宮本祥平", nickname: "みや", roleIds: ["hj-role-leader"], baggageGroupId: "hj-bg-3" },
    { id: "hj-p-216", festivalId, serial: "216", name: "大渕由貴", nickname: "ふっちー", roleIds: ["hj-role-dancer"] },
    { id: "hj-p-706", festivalId, serial: "706", name: "松本望", nickname: "のぞみ", roleIds: ["hj-role-dancer"], baggageGroupId: "hj-bg-3" },
  ],
  baggageGroups: [
    { id: "hj-bg-3", festivalId, groupCode: "3", leaderParticipantId: "hj-p-615" },
    { id: "hj-bg-4", festivalId, groupCode: "4" },
  ],
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
    {
      id: "hj-loc-kaikan",
      festivalId,
      kind: "changing_room",
      name: "明治神宮会館",
      lat: 35.6734,
      lng: 139.7003,
      address: "明治神宮内",
      description: "更衣室。9:10頃には出発。",
    },
  ],
  venueRoutes: [],
  scheduleItems: [
    {
      // 役職限定の予定(リーダーのみ表示)の動作確認用
      id: "hj-item-leader",
      festivalDayId: day1,
      title: "リーダー打ち合わせ",
      category: "gather",
      gatherTime: iso(0, 12, 30),
      isConfirmed: true,
      isCancelled: false,
      audienceAll: false,
      audienceRoleIds: ["hj-role-leader"],
    },
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
    },
  ],
  announcements: [
    {
      id: "hj-ann-1",
      festivalId,
      title: "原宿よさこいへようこそ",
      body: "こちらは原宿よさこいのお知らせです。",
      priority: "normal",
      // 実行環境のタイムゾーンに関わらず「公開済み」になるよう前日にする
      publishedAt: iso(-1, 9, 0),
    },
    {
      // 役職向けお知らせの動作確認用
      id: "hj-ann-leader",
      festivalId,
      title: "【リーダー向け】受付時間のご案内",
      body: "リーダーは受付を済ませてください。",
      priority: "important",
      publishedAt: iso(-1, 9, 30),
      audienceType: "roles",
      audienceRoleIds: ["hj-role-leader"],
    },
    {
      // 個人向けお知らせの動作確認用(216/ふっちー のみ)
      id: "hj-ann-personal",
      festivalId,
      title: "【個人宛】忘れ物のお知らせ",
      body: "お預かりしています。本部までお越しください。",
      priority: "normal",
      publishedAt: iso(-1, 10, 0),
      audienceType: "participants",
      audienceParticipantIds: ["hj-p-216"],
    },
  ],
};
