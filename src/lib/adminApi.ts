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
} from "../types/domain";
import {
  ANNOUNCEMENT_COLUMNS,
  LOCATION_COLUMNS,
  SCHEDULE_ITEM_COLUMNS,
  toAnnouncement,
  toFestival,
  toFestivalDay,
  toLocation,
  toScheduleItem,
  type AnnouncementRow,
  type FestivalDayRow,
  type FestivalRow,
  type LocationRow,
  type ScheduleItemRow,
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
    .select("id, slug, name")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as FestivalRow[]).map(toFestival);
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
  notes: string | null;
  isConfirmed: boolean;
  tbdNote: string | null;
  isCancelled: boolean;
  sortOrder: number;
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
    notes: input.notes,
    is_confirmed: input.isConfirmed,
    tbd_note: input.tbdNote,
    is_cancelled: input.isCancelled,
    sort_order: input.sortOrder,
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
