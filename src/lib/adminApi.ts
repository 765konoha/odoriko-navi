import { supabase } from "./supabase";
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
import {
  ANNOUNCEMENT_COLUMNS,
  FESTIVAL_COLUMNS,
  LOCATION_COLUMNS,
  SCHEDULE_ITEM_COLUMNS,
  VENUE_ROUTE_COLUMNS,
  toAnnouncement,
  toFestival,
  toFestivalDay,
  toLocation,
  toScheduleItem,
  toVenueRoute,
  type AnnouncementRow,
  type FestivalDayRow,
  type FestivalRow,
  type LocationRow,
  type ScheduleItemRow,
  type VenueRouteRow,
} from "../repositories/mappers";

// 運営管理画面用のデータ操作(要ログイン。RLSにより authenticated のみ書込可)。

function client() {
  if (!supabase) throw new Error("Supabaseが設定されていません");
  return supabase;
}

// ---------- 祭り・開催日 ----------

export async function listFestivals(): Promise<Festival[]> {
  const { data, error } = await client()
    .from("festivals")
    .select(FESTIVAL_COLUMNS)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as FestivalRow[]).map(toFestival);
}

export interface FestivalInput {
  /** URL(/#/{slug}/...)になる識別子。例: harajuku-2026 */
  slug: string;
  name: string;
  /** 天気予報の取得地点(Open-Meteo に渡す緯度・経度) */
  weatherLat: number | null;
  weatherLng: number | null;
}

function festivalToRow(input: FestivalInput) {
  return {
    slug: input.slug,
    name: input.name,
    weather_lat: input.weatherLat,
    weather_lng: input.weatherLng,
  };
}

/** 予報地点の変更を次回取得で確実に反映させるため天気キャッシュを消す */
async function clearWeatherCache(festivalId: string): Promise<void> {
  await client().from("weather_hourly").delete().eq("festival_id", festivalId);
  await client().from("weather_daily").delete().eq("festival_id", festivalId);
}

/** 作成した祭りの id を返す */
export async function createFestival(input: FestivalInput): Promise<string> {
  const { data, error } = await client()
    .from("festivals")
    .insert(festivalToRow(input))
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateFestival(
  id: string,
  input: FestivalInput,
): Promise<void> {
  const { error } = await client()
    .from("festivals")
    .update(festivalToRow(input))
    .eq("id", id);
  if (error) throw error;
  await clearWeatherCache(id);
}

export async function listDays(festivalId: string): Promise<FestivalDay[]> {
  const { data, error } = await client()
    .from("festival_days")
    .select("id, festival_id, date, label, sort_order")
    .eq("festival_id", festivalId)
    .order("date");
  if (error) throw error;
  return ((data ?? []) as FestivalDayRow[]).map(toFestivalDay);
}

export async function createDay(
  festivalId: string,
  date: string,
  label: string | null,
): Promise<void> {
  const { error } = await client().from("festival_days").insert({
    festival_id: festivalId,
    date,
    label,
    sort_order: Date.parse(date) / 86_400_000, // 日付順になる連番
  });
  if (error) throw error;
}

export async function deleteDay(dayId: string): Promise<void> {
  const { error } = await client()
    .from("festival_days")
    .delete()
    .eq("id", dayId);
  if (error) throw error;
}

// ---------- スケジュール ----------

export interface ScheduleItemInput {
  festivalDayId: string;
  title: string;
  category: ScheduleCategory;
  gatherTime: string | null;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  meetingLocationId: string | null;
  venueRouteId: string | null;
  notes: string | null;
  isConfirmed: boolean;
  tbdNote: string | null;
  isCancelled: boolean;
  sortOrder: number;
  isCompleted: boolean;
  dancesRejoice: boolean;
  dancesSakaseya: boolean;
  rejoiceCount: number;
  sakaseyaCount: number;
}

function scheduleItemToRow(input: ScheduleItemInput) {
  return {
    festival_day_id: input.festivalDayId,
    title: input.title,
    category: input.category,
    gather_time: input.gatherTime,
    start_time: input.startTime,
    end_time: input.endTime,
    venue_name: input.venueName,
    meeting_location_id: input.meetingLocationId,
    venue_route_id: input.venueRouteId,
    notes: input.notes,
    is_confirmed: input.isConfirmed,
    tbd_note: input.tbdNote,
    is_cancelled: input.isCancelled,
    sort_order: input.sortOrder,
    is_completed: input.isCompleted,
    dances_rejoice: input.dancesRejoice,
    dances_sakaseya: input.dancesSakaseya,
    rejoice_count: input.rejoiceCount,
    sakaseya_count: input.sakaseyaCount,
    // 旧列は合計値として維持(公開中の旧バージョンが参照するため)
    dance_count: input.rejoiceCount + input.sakaseyaCount,
  };
}

export async function listScheduleItems(
  dayIds: string[],
): Promise<ScheduleItem[]> {
  if (dayIds.length === 0) return [];
  const { data, error } = await client()
    .from("schedule_items")
    .select(SCHEDULE_ITEM_COLUMNS)
    .in("festival_day_id", dayIds)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as ScheduleItemRow[]).map(toScheduleItem);
}

export async function createScheduleItem(
  input: ScheduleItemInput,
): Promise<void> {
  const { error } = await client()
    .from("schedule_items")
    .insert(scheduleItemToRow(input));
  if (error) throw error;
}

export async function updateScheduleItem(
  id: string,
  input: ScheduleItemInput,
): Promise<void> {
  const { error } = await client()
    .from("schedule_items")
    .update(scheduleItemToRow(input))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteScheduleItem(id: string): Promise<void> {
  const { error } = await client()
    .from("schedule_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** 予定を完了にして演目ごとの踊った回数を記録する(0.5回単位) */
export async function completeScheduleItem(
  id: string,
  rejoiceCount: number,
  sakaseyaCount: number,
): Promise<void> {
  const { error } = await client()
    .from("schedule_items")
    .update({
      is_completed: true,
      rejoice_count: rejoiceCount,
      sakaseya_count: sakaseyaCount,
      dance_count: rejoiceCount + sakaseyaCount,
    })
    .eq("id", id);
  if (error) throw error;
}

/** 完了を取り消す(回数は保持し、集計からは除外される) */
export async function uncompleteScheduleItem(id: string): Promise<void> {
  const { error } = await client()
    .from("schedule_items")
    .update({ is_completed: false })
    .eq("id", id);
  if (error) throw error;
}

// ---------- 場所 ----------

export interface LocationInput {
  festivalId: string;
  kind: LocationKind;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
}

function locationToRow(input: LocationInput) {
  return {
    festival_id: input.festivalId,
    kind: input.kind,
    name: input.name,
    lat: input.lat,
    lng: input.lng,
    address: input.address,
    description: input.description,
  };
}

export async function listLocations(festivalId: string): Promise<Location[]> {
  const { data, error } = await client()
    .from("locations")
    .select(LOCATION_COLUMNS)
    .eq("festival_id", festivalId)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as LocationRow[]).map(toLocation);
}

export async function createLocation(input: LocationInput): Promise<void> {
  const { error } = await client().from("locations").insert(locationToRow(input));
  if (error) throw error;
}

export async function updateLocation(
  id: string,
  input: LocationInput,
): Promise<void> {
  const { error } = await client()
    .from("locations")
    .update(locationToRow(input))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await client().from("locations").delete().eq("id", id);
  if (error) throw error;
}

// ---------- 演舞会場コース ----------

export interface VenueRouteInput {
  festivalId: string;
  name: string;
  path: [number, number][];
  description: string | null;
}

function venueRouteToRow(input: VenueRouteInput) {
  return {
    festival_id: input.festivalId,
    name: input.name,
    path: input.path,
    description: input.description,
  };
}

export async function listVenueRoutes(
  festivalId: string,
): Promise<VenueRoute[]> {
  const { data, error } = await client()
    .from("venue_routes")
    .select(VENUE_ROUTE_COLUMNS)
    .eq("festival_id", festivalId)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as VenueRouteRow[]).map(toVenueRoute);
}

export async function createVenueRoute(input: VenueRouteInput): Promise<void> {
  const { error } = await client()
    .from("venue_routes")
    .insert(venueRouteToRow(input));
  if (error) throw error;
}

export async function updateVenueRoute(
  id: string,
  input: VenueRouteInput,
): Promise<void> {
  const { error } = await client()
    .from("venue_routes")
    .update(venueRouteToRow(input))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteVenueRoute(id: string): Promise<void> {
  const { error } = await client().from("venue_routes").delete().eq("id", id);
  if (error) throw error;
}

// ---------- お知らせ ----------

export interface AnnouncementInput {
  festivalId: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  publishedAt: string;
  expiresAt: string | null;
}

function announcementToRow(input: AnnouncementInput) {
  return {
    festival_id: input.festivalId,
    title: input.title,
    body: input.body,
    priority: input.priority,
    published_at: input.publishedAt,
    expires_at: input.expiresAt,
  };
}

/** 管理画面用: 配信前・配信終了も含む全件 */
export async function listAllAnnouncements(
  festivalId: string,
): Promise<Announcement[]> {
  const { data, error } = await client()
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("festival_id", festivalId)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as AnnouncementRow[]).map(toAnnouncement);
}

/** 作成したお知らせの id を返す(プッシュ通知の遷移先URLに使う) */
export async function createAnnouncement(
  input: AnnouncementInput,
): Promise<string> {
  const { data, error } = await client()
    .from("announcements")
    .insert(announcementToRow(input))
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
): Promise<void> {
  const { error } = await client()
    .from("announcements")
    .update({ ...announcementToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await client().from("announcements").delete().eq("id", id);
  if (error) throw error;
}
