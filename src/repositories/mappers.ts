import type {
  Announcement,
  AnnouncementPriority,
  Festival,
  FestivalDay,
  Location,
  LocationKind,
  ScheduleCategory,
  ScheduleItem,
  VenueRoute,
} from "../types/domain";

// Supabase の snake_case 行 ⇔ ドメイン型(camelCase)の変換。

export interface FestivalRow {
  id: string;
  slug: string;
  name: string;
  weather_lat: number | null;
  weather_lng: number | null;
}

export interface FestivalDayRow {
  id: string;
  festival_id: string;
  date: string;
  label: string | null;
  sort_order: number;
}

export interface LocationRow {
  id: string;
  festival_id: string;
  kind: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
}

export interface ScheduleItemRow {
  id: string;
  festival_day_id: string;
  title: string;
  category: string;
  gather_time: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  meeting_location_id: string | null;
  venue_route_id: string | null;
  notes: string | null;
  is_confirmed: boolean;
  tbd_note: string | null;
  is_cancelled: boolean;
  sort_order: number;
  is_completed: boolean;
  dance_count: number;
  dances_rejoice: boolean;
  dances_sakaseya: boolean;
  rejoice_count: number;
  sakaseya_count: number;
}

export interface VenueRouteRow {
  id: string;
  festival_id: string;
  name: string;
  path: [number, number][];
  description: string | null;
}

export function toVenueRoute(row: VenueRouteRow): VenueRoute {
  return {
    id: row.id,
    festivalId: row.festival_id,
    name: row.name,
    path: Array.isArray(row.path) ? row.path : [],
    description: row.description ?? undefined,
  };
}

export interface AnnouncementRow {
  id: string;
  festival_id: string;
  title: string;
  body: string;
  priority: string;
  published_at: string;
  expires_at: string | null;
}

export function toFestival(row: FestivalRow): Festival {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    weatherLat: row.weather_lat ?? undefined,
    weatherLng: row.weather_lng ?? undefined,
  };
}

export function toFestivalDay(row: FestivalDayRow): FestivalDay {
  return {
    id: row.id,
    festivalId: row.festival_id,
    date: row.date,
    label: row.label ?? undefined,
    sortOrder: row.sort_order,
  };
}

export function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    festivalId: row.festival_id,
    kind: row.kind as LocationKind,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    address: row.address ?? undefined,
    description: row.description ?? undefined,
  };
}

export function toScheduleItem(row: ScheduleItemRow): ScheduleItem {
  return {
    id: row.id,
    festivalDayId: row.festival_day_id,
    title: row.title,
    category: row.category as ScheduleCategory,
    gatherTime: row.gather_time ?? undefined,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    venueName: row.venue_name ?? undefined,
    meetingLocationId: row.meeting_location_id ?? undefined,
    venueRouteId: row.venue_route_id ?? undefined,
    notes: row.notes ?? undefined,
    isConfirmed: row.is_confirmed,
    tbdNote: row.tbd_note ?? undefined,
    isCancelled: row.is_cancelled,
    sortOrder: row.sort_order,
    isCompleted: row.is_completed ?? false,
    danceCount: Number(row.dance_count ?? 0),
    dancesRejoice: row.dances_rejoice ?? false,
    dancesSakaseya: row.dances_sakaseya ?? false,
    rejoiceCount: Number(row.rejoice_count ?? 0),
    sakaseyaCount: Number(row.sakaseya_count ?? 0),
  };
}

export function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    festivalId: row.festival_id,
    title: row.title,
    body: row.body,
    priority: row.priority as AnnouncementPriority,
    publishedAt: row.published_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

export const FESTIVAL_COLUMNS = "id, slug, name, weather_lat, weather_lng";

export const SCHEDULE_ITEM_COLUMNS =
  "id, festival_day_id, title, category, gather_time, start_time, end_time, venue_name, meeting_location_id, venue_route_id, notes, is_confirmed, tbd_note, is_cancelled, sort_order, is_completed, dance_count, dances_rejoice, dances_sakaseya, rejoice_count, sakaseya_count";

export const VENUE_ROUTE_COLUMNS = "id, festival_id, name, path, description";

export const LOCATION_COLUMNS =
  "id, festival_id, kind, name, lat, lng, address, description";

export const ANNOUNCEMENT_COLUMNS =
  "id, festival_id, title, body, priority, published_at, expires_at";
