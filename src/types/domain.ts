// ドメイン型。Supabase のテーブル構造(docs/DESIGN.md §4)と1対1対応させる。

export interface Festival {
  id: string;
  slug: string;
  name: string;
}

export interface FestivalDay {
  id: string;
  festivalId: string;
  /** YYYY-MM-DD */
  date: string;
  label?: string;
  sortOrder: number;
}

export type LocationKind = "meeting_point" | "toilet";

export interface Location {
  id: string;
  festivalId: string;
  kind: LocationKind;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  description?: string;
}

export type ScheduleCategory =
  | "performance"
  | "gather"
  | "practice"
  | "move"
  | "break"
  | "dismiss"
  | "other";

export interface ScheduleItem {
  id: string;
  festivalDayId: string;
  title: string;
  category: ScheduleCategory;
  /** 集合時間(ISO) */
  gatherTime?: string;
  /** 開始/演舞時間(ISO) */
  startTime?: string;
  endTime?: string;
  venueName?: string;
  meetingLocationId?: string;
  notes?: string;
  isConfirmed: boolean;
  /** 未確定時の表示文(例: 17:30頃予定・当日連絡) */
  tbdNote?: string;
  isCancelled: boolean;
  sortOrder: number;
}

export type AnnouncementPriority = "normal" | "important" | "emergency";

export interface Announcement {
  id: string;
  festivalId: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  publishedAt: string;
  expiresAt?: string;
}

/** 1つの祭りの全データ(1回の取得=1スナップショット。オフラインキャッシュの単位) */
export interface FestivalData {
  festival: Festival;
  days: FestivalDay[];
  scheduleItems: ScheduleItem[];
  locations: Location[];
  announcements: Announcement[];
}
