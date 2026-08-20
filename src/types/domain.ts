// ドメイン型。Supabase のテーブル構造(docs/DESIGN.md §4)と1対1対応させる。

export interface Festival {
  id: string;
  slug: string;
  name: string;
  /** 天気予報の取得地点(緯度)。未設定なら登録場所の重心で代替 */
  weatherLat?: number;
  /** 天気予報の取得地点(経度) */
  weatherLng?: number;
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

/** 演舞会場コース(地図上の帯状ライン) */
export interface VenueRoute {
  id: string;
  festivalId: string;
  name: string;
  /** [lat, lng] の座標列(折れ線) */
  path: [number, number][];
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
  /** 演舞会場コース(venue_routes)との紐付け */
  venueRouteId?: string;
  notes?: string;
  isConfirmed: boolean;
  /** 未確定時の表示文(例: 17:30頃予定・当日連絡) */
  tbdNote?: string;
  isCancelled: boolean;
  sortOrder: number;
  /** 運営が完了ボタンで更新(時刻ではなくこれで進行を判定する) */
  isCompleted?: boolean;
  /** 踊った回数の合計(旧仕様との互換用。= rejoiceCount + sakaseyaCount) */
  danceCount?: number;
  /** この予定で「Rejoice」を踊るか */
  dancesRejoice?: boolean;
  /** この予定で「咲かせや」を踊るか */
  dancesSakaseya?: boolean;
  /** Rejoice を踊った回数(0.5回単位) */
  rejoiceCount?: number;
  /** 咲かせや を踊った回数(0.5回単位) */
  sakaseyaCount?: number;
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
  venueRoutes: VenueRoute[];
  announcements: Announcement[];
}
