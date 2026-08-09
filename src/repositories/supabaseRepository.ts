import type { FestivalRepository } from "./types";
import type { FestivalData } from "../types/domain";
import { supabase } from "../lib/supabase";
import {
  ANNOUNCEMENT_COLUMNS,
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
} from "./mappers";

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

    const [daysRes, locationsRes, venueRoutesRes, announcementsRes] =
      await Promise.all([
        supabase
          .from("festival_days")
          .select("id, festival_id, date, label, sort_order")
          .eq("festival_id", festivalId)
          .order("date"),
        supabase
          .from("locations")
          .select(LOCATION_COLUMNS)
          .eq("festival_id", festivalId),
        supabase
          .from("venue_routes")
          .select(VENUE_ROUTE_COLUMNS)
          .eq("festival_id", festivalId)
          .order("created_at"),
        supabase
          .from("announcements")
          .select(ANNOUNCEMENT_COLUMNS)
          .eq("festival_id", festivalId)
          .order("published_at", { ascending: false }),
      ]);

    if (daysRes.error) throw daysRes.error;
    if (locationsRes.error) throw locationsRes.error;
    if (venueRoutesRes.error) throw venueRoutesRes.error;
    if (announcementsRes.error) throw announcementsRes.error;

    const dayRows = (daysRes.data ?? []) as FestivalDayRow[];
    const dayIds = dayRows.map((d) => d.id);

    let itemRows: ScheduleItemRow[] = [];
    if (dayIds.length > 0) {
      const { data, error } = await supabase
        .from("schedule_items")
        .select(SCHEDULE_ITEM_COLUMNS)
        .in("festival_day_id", dayIds)
        .order("sort_order");
      if (error) throw error;
      itemRows = (data ?? []) as ScheduleItemRow[];
    }

    return {
      festival: toFestival(festivalRow),
      days: dayRows.map(toFestivalDay),
      locations: ((locationsRes.data ?? []) as LocationRow[]).map(toLocation),
      venueRoutes: ((venueRoutesRes.data ?? []) as VenueRouteRow[]).map(
        toVenueRoute,
      ),
      scheduleItems: itemRows.map(toScheduleItem),
      announcements: ((announcementsRes.data ?? []) as AnnouncementRow[]).map(
        toAnnouncement,
      ),
    };
  },
};
