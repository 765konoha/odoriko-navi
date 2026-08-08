import type { FestivalRepository } from "./types";
import type {
  Announcement,
  AnnouncementPriority,
  FestivalData,
  Location,
  LocationKind,
  ScheduleCategory,
  ScheduleItem,
} from "../types/domain";
import { supabase } from "../lib/supabase";

// Supabase の snake_case 行をドメイン型(camelCase)へ変換する。

interface FestivalRow {
  id: string;
  slug: string;
  name: string;
}

interface FestivalDayRow {
  id: string;
  festival_id: string;
  date: string;
  label: string | null;
  sort_order: number;
}

interface LocationRow {
  id: string;
  festival_id: string;
  kind: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
}

interface ScheduleItemRow {
  id: string;
  festival_day_id: string;
  title: string;
  category: string;
  gather_time: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  meeting_location_id: string | null;
  notes: string | null;
  is_confirmed: boolean;
  tbd_note: string | null;
  is_cancelled: boolean;
  sort_order: number;
}

interface AnnouncementRow {
  id: string;
  festival_id: string;
  title: string;
  body: string;
  priority: string;
  published_at: string;
  expires_at: string | null;
}

function toLocation(row: LocationRow): Location {
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

function toScheduleItem(row: ScheduleItemRow): ScheduleItem {
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
    notes: row.notes ?? undefined,
    isConfirmed: row.is_confirmed,
    tbdNote: row.tbd_note ?? undefined,
    isCancelled: row.is_cancelled,
    sortOrder: row.sort_order,
  };
}

function toAnnouncement(row: AnnouncementRow): Announcement {
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

export const supabaseRepository: FestivalRepository = {
  async loadFestivalData(slug: string): Promise<FestivalData | null> {
    if (!supabase) throw new Error("Supabase client is not configured");

    const { data: festivalRow, error: festivalError } = await supabase
      .from("festivals")
      .select("id, slug, name")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle<FestivalRow>();

    if (festivalError) throw festivalError;
    if (!festivalRow) return null;

    const festivalId = festivalRow.id;

    const [daysRes, locationsRes, announcementsRes] = await Promise.all([
      supabase
        .from("festival_days")
        .select("id, festival_id, date, label, sort_order")
        .eq("festival_id", festivalId)
        .order("sort_order"),
      supabase
        .from("locations")
        .select("id, festival_id, kind, name, lat, lng, address, description")
        .eq("festival_id", festivalId),
      supabase
        .from("announcements")
        .select("id, festival_id, title, body, priority, published_at, expires_at")
        .eq("festival_id", festivalId)
        .order("published_at", { ascending: false }),
    ]);

    if (daysRes.error) throw daysRes.error;
    if (locationsRes.error) throw locationsRes.error;
    if (announcementsRes.error) throw announcementsRes.error;

    const dayRows = (daysRes.data ?? []) as FestivalDayRow[];
    const dayIds = dayRows.map((d) => d.id);

    let itemRows: ScheduleItemRow[] = [];
    if (dayIds.length > 0) {
      const { data, error } = await supabase
        .from("schedule_items")
        .select(
          "id, festival_day_id, title, category, gather_time, start_time, end_time, venue_name, meeting_location_id, notes, is_confirmed, tbd_note, is_cancelled, sort_order",
        )
        .in("festival_day_id", dayIds)
        .order("sort_order");
      if (error) throw error;
      itemRows = (data ?? []) as ScheduleItemRow[];
    }

    return {
      festival: {
        id: festivalRow.id,
        slug: festivalRow.slug,
        name: festivalRow.name,
      },
      days: dayRows.map((d) => ({
        id: d.id,
        festivalId: d.festival_id,
        date: d.date,
        label: d.label ?? undefined,
        sortOrder: d.sort_order,
      })),
      locations: ((locationsRes.data ?? []) as LocationRow[]).map(toLocation),
      scheduleItems: itemRows.map(toScheduleItem),
      announcements: ((announcementsRes.data ?? []) as AnnouncementRow[]).map(
        toAnnouncement,
      ),
    };
  },
};
