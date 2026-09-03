import { supabase } from "./supabase";
import { mockRepository } from "../repositories/mockRepository";
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
  BaggageGroup,
  Festival,
  FestivalDay,
  FestivalParticipant,
  FestivalRole,
  Location,
  LocationKind,
  ScheduleCategory,
  ScheduleItem,
  VenueRoute,
} from "../types/domain";
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
} from "../repositories/mappers";

// 運営管理画面用のデータ操作(要ログイン。RLSにより authenticated のみ書込可)。

function client() {
  if (!supabase) throw new Error("Supabaseが設定されていません");
  return supabase;
}

// ---------- 祭り・開催日 ----------

export async function listFestivals(): Promise<Festival[]> {
  // mock モード(Supabase 未設定)では祭りの一覧だけ mock から返し、
  // 開発時に管理画面の枠を表示できるようにする。
  if (!supabase) return mockRepository.listFestivals();
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
  /** 演舞回数の集計機能を使うか */
  danceCountEnabled: boolean;
  /** 開催中(true)か終了(false)か */
  isActive: boolean;
  /** 予定の完了を時刻の経過で自動判定するか */
  scheduleAutoComplete: boolean;
}

function festivalToRow(input: FestivalInput) {
  return {
    slug: input.slug,
    name: input.name,
    weather_lat: input.weatherLat,
    weather_lng: input.weatherLng,
    dance_count_enabled: input.danceCountEnabled,
    is_active: input.isActive,
    schedule_auto_complete: input.scheduleAutoComplete,
  };
}

/** 新規の祭りに自動投入する初期役職(is_default は番号指定なし利用者の役職) */
const DEFAULT_ROLES = [
  { name: "リーダー", is_default: false, sort_order: 1 },
  { name: "踊り子一般", is_default: true, sort_order: 2 },
  { name: "マネージャー", is_default: false, sort_order: 3 },
  { name: "歌い手・煽り", is_default: false, sort_order: 4 },
];

/** 予報地点の変更を次回取得で確実に反映させるため天気キャッシュを消す */
async function clearWeatherCache(festivalId: string): Promise<void> {
  await client().from("weather_hourly").delete().eq("festival_id", festivalId);
  await client().from("weather_daily").delete().eq("festival_id", festivalId);
}

/** 作成した祭りの id を返す(初期役職も自動で投入する) */
export async function createFestival(input: FestivalInput): Promise<string> {
  const { data, error } = await client()
    .from("festivals")
    .insert(festivalToRow(input))
    .select("id")
    .single();
  if (error) throw error;
  const festivalId = (data as { id: string }).id;
  const { error: roleError } = await client()
    .from("festival_roles")
    .insert(DEFAULT_ROLES.map((r) => ({ ...r, festival_id: festivalId })));
  if (roleError) throw roleError;
  return festivalId;
}

/** 開催中 / 終了 を切り替える */
export async function setFestivalActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await client()
    .from("festivals")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
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
  isCompleted: boolean;
  dancesRejoice: boolean;
  dancesSakaseya: boolean;
  rejoiceCount: number;
  sakaseyaCount: number;
  /** 全員に表示するか。false の場合は audienceRoleIds の役職のみ */
  audienceAll: boolean;
  audienceRoleIds: string[];
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
    is_completed: input.isCompleted,
    dances_rejoice: input.dancesRejoice,
    dances_sakaseya: input.dancesSakaseya,
    rejoice_count: input.rejoiceCount,
    sakaseya_count: input.sakaseyaCount,
    // 旧列は合計値として維持(公開中の旧バージョンが参照するため)
    dance_count: input.rejoiceCount + input.sakaseyaCount,
    audience_all: input.audienceAll,
  };
}

/** 予定の表示対象役職を置き換える(全員向けは紐付けを空にする) */
async function replaceScheduleItemRoles(
  scheduleItemId: string,
  input: ScheduleItemInput,
): Promise<void> {
  const { error: deleteError } = await client()
    .from("schedule_item_roles")
    .delete()
    .eq("schedule_item_id", scheduleItemId);
  if (deleteError) throw deleteError;
  if (input.audienceAll || input.audienceRoleIds.length === 0) return;
  const { error } = await client()
    .from("schedule_item_roles")
    .insert(
      input.audienceRoleIds.map((roleId) => ({
        schedule_item_id: scheduleItemId,
        role_id: roleId,
      })),
    );
  if (error) throw error;
}

export async function listScheduleItems(
  dayIds: string[],
): Promise<ScheduleItem[]> {
  if (dayIds.length === 0) return [];
  const { data, error } = await client()
    .from("schedule_items")
    .select(SCHEDULE_ITEM_COLUMNS)
    .in("festival_day_id", dayIds)
    .order("gather_time", { nullsFirst: false })
    .order("start_time", { nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as ScheduleItemRow[]).map(toScheduleItem);
}

export async function createScheduleItem(
  input: ScheduleItemInput,
): Promise<void> {
  const { data, error } = await client()
    .from("schedule_items")
    .insert(scheduleItemToRow(input))
    .select("id")
    .single();
  if (error) throw error;
  await replaceScheduleItemRoles((data as { id: string }).id, input);
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
  await replaceScheduleItemRoles(id, input);
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

/** 作成した場所を返す(予定フォームからの追加時に選択状態にするため) */
export async function createLocation(input: LocationInput): Promise<Location> {
  const { data, error } = await client()
    .from("locations")
    .insert(locationToRow(input))
    .select("id")
    .single();
  if (error) throw error;
  return {
    id: (data as { id: string }).id,
    festivalId: input.festivalId,
    kind: input.kind,
    name: input.name,
    lat: input.lat,
    lng: input.lng,
    address: input.address ?? undefined,
    description: input.description ?? undefined,
  };
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
  /** 配信対象(all=全員 / roles=役職 / participants=個人) */
  audienceType: AnnouncementAudience;
  audienceRoleIds: string[];
  audienceParticipantIds: string[];
}

function announcementToRow(input: AnnouncementInput) {
  return {
    festival_id: input.festivalId,
    title: input.title,
    body: input.body,
    priority: input.priority,
    published_at: input.publishedAt,
    expires_at: input.expiresAt,
    audience_type: input.audienceType,
  };
}

/** お知らせの配信対象(役職・個人)の紐付けを置き換える */
async function replaceAnnouncementAudience(
  announcementId: string,
  input: AnnouncementInput,
): Promise<void> {
  const [rolesDel, participantsDel] = await Promise.all([
    client()
      .from("announcement_roles")
      .delete()
      .eq("announcement_id", announcementId),
    client()
      .from("announcement_participants")
      .delete()
      .eq("announcement_id", announcementId),
  ]);
  if (rolesDel.error) throw rolesDel.error;
  if (participantsDel.error) throw participantsDel.error;

  if (input.audienceType === "roles" && input.audienceRoleIds.length > 0) {
    const { error } = await client()
      .from("announcement_roles")
      .insert(
        input.audienceRoleIds.map((roleId) => ({
          announcement_id: announcementId,
          role_id: roleId,
        })),
      );
    if (error) throw error;
  }
  if (
    input.audienceType === "participants" &&
    input.audienceParticipantIds.length > 0
  ) {
    const { error } = await client()
      .from("announcement_participants")
      .insert(
        input.audienceParticipantIds.map((participantId) => ({
          announcement_id: announcementId,
          festival_participant_id: participantId,
        })),
      );
    if (error) throw error;
  }
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
  const id = (data as { id: string }).id;
  await replaceAnnouncementAudience(id, input);
  return id;
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
  await replaceAnnouncementAudience(id, input);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await client().from("announcements").delete().eq("id", id);
  if (error) throw error;
}

// ---------- 役職 ----------

export async function listRoles(festivalId: string): Promise<FestivalRole[]> {
  const { data, error } = await client()
    .from("festival_roles")
    .select(FESTIVAL_ROLE_COLUMNS)
    .eq("festival_id", festivalId)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as FestivalRoleRow[]).map(toFestivalRole);
}

export async function createRole(
  festivalId: string,
  name: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await client().from("festival_roles").insert({
    festival_id: festivalId,
    name,
    sort_order: sortOrder,
  });
  if (error) throw error;
}

// ---------- 参加者 ----------

export async function listParticipants(
  festivalId: string,
): Promise<FestivalParticipant[]> {
  // mock モード(Supabase 未設定)。リハの出欠集計を開発時に確認するために使う。
  if (!supabase) {
    const list = await mockRepository.listFestivals();
    const slug = list.find((f) => f.id === festivalId)?.slug;
    const data = slug ? await mockRepository.loadFestivalData(slug) : null;
    return data?.participants ?? [];
  }
  const { data, error } = await client()
    .from("festival_participants")
    .select(FESTIVAL_PARTICIPANT_COLUMNS)
    .eq("festival_id", festivalId)
    .order("serial");
  if (error) throw error;
  return ((data ?? []) as FestivalParticipantRow[]).map(toFestivalParticipant);
}

export async function updateParticipant(
  id: string,
  name: string,
  nickname: string,
): Promise<void> {
  const { error } = await client()
    .from("festival_participants")
    .update({ name, nickname })
    .eq("id", id);
  if (error) throw error;
}

/** 参加者の役職を置き換える(複数役職可) */
export async function setParticipantRoles(
  festivalParticipantId: string,
  roleIds: string[],
): Promise<void> {
  const { error: deleteError } = await client()
    .from("festival_participant_roles")
    .delete()
    .eq("festival_participant_id", festivalParticipantId);
  if (deleteError) throw deleteError;
  if (roleIds.length === 0) return;
  const { error } = await client()
    .from("festival_participant_roles")
    .insert(
      roleIds.map((roleId) => ({
        festival_participant_id: festivalParticipantId,
        role_id: roleId,
      })),
    );
  if (error) throw error;
}

export interface ParticipantImportRow {
  serial: string;
  name: string;
  nickname: string;
}

/** この祭りの既定役職(踊り子一般)の id */
async function defaultRoleId(festivalId: string): Promise<string | null> {
  const { data, error } = await client()
    .from("festival_roles")
    .select("id")
    .eq("festival_id", festivalId)
    .eq("is_default", true)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as { id: string } | undefined)?.id ?? null;
}

/** マスターに無いシリアルをマスターへ追加する(名前は持たせない) */
async function ensureMasterSerials(serials: string[]): Promise<void> {
  const { error } = await client()
    .from("participants")
    .upsert(
      serials.map((serial) => ({ serial })),
      { onConflict: "serial", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/**
 * 参加者の一括登録(初期登録専用)。
 * 全員に既定役職(踊り子一般)を付与する。
 */
export async function bulkRegisterParticipants(
  festivalId: string,
  rows: ParticipantImportRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await ensureMasterSerials(rows.map((r) => r.serial));

  const { data, error } = await client()
    .from("festival_participants")
    .insert(
      rows.map((r) => ({
        festival_id: festivalId,
        serial: r.serial,
        name: r.name,
        nickname: r.nickname,
      })),
    )
    .select("id");
  if (error) throw error;

  const roleId = await defaultRoleId(festivalId);
  if (!roleId) return;
  const { error: roleError } = await client()
    .from("festival_participant_roles")
    .insert(
      ((data ?? []) as { id: string }[]).map((p) => ({
        festival_participant_id: p.id,
        role_id: roleId,
      })),
    );
  if (roleError) throw roleError;
}

/** 参加者を1人追加する(役職未指定なら踊り子一般を付与) */
export async function createParticipant(
  festivalId: string,
  row: ParticipantImportRow,
  roleIds: string[],
): Promise<void> {
  await ensureMasterSerials([row.serial]);
  const { data, error } = await client()
    .from("festival_participants")
    .insert({
      festival_id: festivalId,
      serial: row.serial,
      name: row.name,
      nickname: row.nickname,
    })
    .select("id")
    .single();
  if (error) throw error;
  let ids = roleIds;
  if (ids.length === 0) {
    const roleId = await defaultRoleId(festivalId);
    ids = roleId ? [roleId] : [];
  }
  await setParticipantRoles((data as { id: string }).id, ids);
}

/** この参加者が荷物リーダーになっているグループ(いなければ null) */
async function leaderGroupOf(
  participantId: string,
): Promise<BaggageGroup | null> {
  const { data, error } = await client()
    .from("baggage_groups")
    .select(BAGGAGE_GROUP_COLUMNS)
    .eq("leader_participant_id", participantId)
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as BaggageGroupRow | undefined;
  return row ? toBaggageGroup(row) : null;
}

/**
 * 参加者を1人削除する。
 * 役職の紐付け・個人宛お知らせの紐付けは cascade で削除される。
 * 参加者マスター(シリアル)は残る。
 * 荷物リーダーに設定されている場合は削除せずエラーにする。
 */
export async function deleteParticipant(id: string): Promise<void> {
  const leaderOf = await leaderGroupOf(id);
  if (leaderOf) {
    throw new Error(
      `この参加者は荷物グループ${leaderOf.groupCode}のリーダーです。先に別の荷物リーダーを設定するか、リーダー設定を解除してください。`,
    );
  }
  const { error } = await client()
    .from("festival_participants")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * この祭りの参加者を一括削除する。
 * 役職・個人宛お知らせ・荷物グループの所属は cascade / set null で解除され、
 * 荷物リーダー設定も自動で未設定に戻る(グループ本体は残る)。
 * 参加者マスター(シリアル)・お知らせ本体・予定・場所は残る。
 */
export async function deleteAllParticipants(festivalId: string): Promise<void> {
  const { error } = await client()
    .from("festival_participants")
    .delete()
    .eq("festival_id", festivalId);
  if (error) throw error;
}

// ---------- 荷物グループ ----------

export async function listBaggageGroups(
  festivalId: string,
): Promise<BaggageGroup[]> {
  const { data, error } = await client()
    .from("baggage_groups")
    .select(BAGGAGE_GROUP_COLUMNS)
    .eq("festival_id", festivalId)
    .order("group_code");
  if (error) throw error;
  return ((data ?? []) as BaggageGroupRow[]).map(toBaggageGroup);
}

export async function createBaggageGroup(
  festivalId: string,
  groupCode: string,
): Promise<void> {
  const { error } = await client().from("baggage_groups").insert({
    festival_id: festivalId,
    group_code: groupCode,
  });
  if (error) throw error;
}

/**
 * 荷物グループを削除する。
 * 所属参加者は baggage_group_id の on delete set null で自動的に未配属へ戻る。
 */
export async function deleteBaggageGroup(id: string): Promise<void> {
  const { error } = await client().from("baggage_groups").delete().eq("id", id);
  if (error) throw error;
}

/** 荷物リーダーを設定・解除する(null で解除) */
export async function setBaggageGroupLeader(
  groupId: string,
  participantId: string | null,
): Promise<void> {
  const { error } = await client()
    .from("baggage_groups")
    .update({
      leader_participant_id: participantId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId);
  if (error) throw error;
}

/**
 * 参加者の所属グループを変更する(複数人まとめて可)。
 * groupId=null で未配属へ戻す。別グループ所属者は自動的に移動になる。
 * 荷物リーダーに設定中の参加者が含まれる場合はエラーにする(先にリーダーを解除する)。
 */
export async function assignBaggageGroup(
  participantIds: string[],
  groupId: string | null,
): Promise<void> {
  if (participantIds.length === 0) return;
  // リーダー整合性: 移動対象がどこかのグループのリーダーなら中断
  const { data, error: leaderError } = await client()
    .from("baggage_groups")
    .select(BAGGAGE_GROUP_COLUMNS)
    .in("leader_participant_id", participantIds);
  if (leaderError) throw leaderError;
  const leaderRows = (data ?? []) as BaggageGroupRow[];
  // 同じグループへの割り当て直しは問題ない(リーダーのまま)
  const blocking = leaderRows.filter((g) => g.id !== groupId);
  if (blocking.length > 0) {
    throw new Error(
      `荷物グループ${blocking[0].group_code}のリーダーが含まれています。先に別の荷物リーダーを設定するか、リーダー設定を解除してください。`,
    );
  }
  const { error } = await client()
    .from("festival_participants")
    .update({ baggage_group_id: groupId })
    .in("id", participantIds);
  if (error) throw error;
}
