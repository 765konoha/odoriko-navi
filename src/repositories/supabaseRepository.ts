import type { FestivalRepository } from "./types";
import type { Festival, FestivalData } from "../types/domain";
import { supabase } from "../lib/supabase";
import {
  ANNOUNCEMENT_COLUMNS,
  BAGGAGE_GROUP_COLUMNS,
  FESTIVAL_COLUMNS,
  FESTIVAL_PARTICIPANT_COLUMNS,
  FESTIVAL_ROLE_COLUMNS,
  LOCATION_COLUMNS,
  SCHEDULE_ITEM_COLUMNS,
  VENUE_ROUTE_COLUMNS,
  toAnnouncement,
  toBaggageGroup,
  toFestival,
  toFestivalDay,
  toFestivalParticipant,
  toFestivalRole,
  toLocation,
  toScheduleItem,
  toVenueRoute,
  type AnnouncementRow,
  type BaggageGroupRow,
  type FestivalDayRow,
  type FestivalParticipantRow,
  type FestivalRoleRow,
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
      .select(FESTIVAL_COLUMNS)
      .eq("slug", slug)
      .maybeSingle<FestivalRow>();

    if (festivalError) throw festivalError;
    if (!festivalRow) return null;

    const festivalId = festivalRow.id;

    const [
      daysRes,
      locationsRes,
      venueRoutesRes,
      announcementsRes,
      rolesRes,
      participantsRes,
      baggageGroupsRes,
    ] = await Promise.all([
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
      supabase
        .from("festival_roles")
        .select(FESTIVAL_ROLE_COLUMNS)
        .eq("festival_id", festivalId)
        .order("sort_order"),
      supabase
        .from("festival_participants")
        .select(FESTIVAL_PARTICIPANT_COLUMNS)
        .eq("festival_id", festivalId),
      supabase
        .from("baggage_groups")
        .select(BAGGAGE_GROUP_COLUMNS)
        .eq("festival_id", festivalId),
    ]);

    if (daysRes.error) throw daysRes.error;
    if (locationsRes.error) throw locationsRes.error;
    if (venueRoutesRes.error) throw venueRoutesRes.error;
    if (announcementsRes.error) throw announcementsRes.error;
    if (rolesRes.error) throw rolesRes.error;
    if (participantsRes.error) throw participantsRes.error;
    if (baggageGroupsRes.error) throw baggageGroupsRes.error;

    const dayRows = (daysRes.data ?? []) as FestivalDayRow[];
    const dayIds = dayRows.map((d) => d.id);

    let itemRows: ScheduleItemRow[] = [];
    if (dayIds.length > 0) {
      const { data, error } = await supabase
        .from("schedule_items")
        .select(SCHEDULE_ITEM_COLUMNS)
        .in("festival_day_id", dayIds)
        .order("gather_time", { nullsFirst: false })
        .order("start_time", { nullsFirst: false });
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
      roles: ((rolesRes.data ?? []) as FestivalRoleRow[]).map(toFestivalRole),
      participants: (
        (participantsRes.data ?? []) as FestivalParticipantRow[]
      ).map(toFestivalParticipant),
      baggageGroups: ((baggageGroupsRes.data ?? []) as BaggageGroupRow[]).map(
        toBaggageGroup,
      ),
    };
  },

  async listFestivals(): Promise<Festival[]> {
    if (!supabase) throw new Error("Supabase client is not configured");
    const { data, error } = await supabase
      .from("festivals")
      .select(FESTIVAL_COLUMNS)
      .order("created_at");
    if (error) throw error;
    return ((data ?? []) as FestivalRow[]).map(toFestival);
  },

  async listParticipantSerials(): Promise<string[]> {
    if (!supabase) throw new Error("Supabase client is not configured");
    const { data, error } = await supabase
      .from("participants")
      .select("serial")
      .order("serial");
    if (error) throw error;
    return ((data ?? []) as { serial: string }[]).map((r) => r.serial);
  },
};
