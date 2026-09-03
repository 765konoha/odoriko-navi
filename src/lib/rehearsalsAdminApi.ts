import { supabase } from "./supabase";
import type { Attendance, AttendanceStatus, Rehearsal } from "../types/rehearsal";
import { toRehearsal } from "./rehearsals";
import type { ImportRow } from "./attendanceImport";
import {
  mockCreateRehearsal,
  mockDeleteRehearsal,
  mockImportAttendances,
  mockListAttendances,
  mockListRehearsals,
  mockUpdateRehearsal,
} from "../data/mock/rehearsals";

/** mock モード(Supabase 未設定)ではメモリ上のダミーデータを読み書きする */
function toDomain(input: RehearsalInput): Omit<Rehearsal, "id"> {
  return {
    festivalId: input.festivalId,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? undefined,
    venueName: input.venueName,
    venueUrl: input.venueUrl ?? undefined,
    venueAddress: input.venueAddress ?? undefined,
    note: input.note ?? undefined,
    isCancelled: input.isCancelled,
  };
}

function client() {
  if (!supabase) throw new Error("Supabase が設定されていません");
  return supabase;
}

export interface RehearsalInput {
  festivalId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  venueUrl: string | null;
  venueAddress: string | null;
  note: string | null;
  isCancelled: boolean;
}

function toRow(input: RehearsalInput) {
  return {
    festival_id: input.festivalId,
    title: input.title,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    venue_name: input.venueName,
    venue_url: input.venueUrl,
    venue_address: input.venueAddress,
    note: input.note,
    is_cancelled: input.isCancelled,
  };
}

export async function createRehearsal(input: RehearsalInput): Promise<void> {
  if (!supabase) return mockCreateRehearsal(toDomain(input));
  const { error } = await client().from("rehearsals").insert(toRow(input));
  if (error) throw new Error(error.message);
}

export async function updateRehearsal(
  id: string,
  input: RehearsalInput,
): Promise<void> {
  if (!supabase) return mockUpdateRehearsal(id, toDomain(input));
  const { error } = await client()
    .from("rehearsals")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRehearsal(id: string): Promise<void> {
  if (!supabase) return mockDeleteRehearsal(id);
  const { error } = await client().from("rehearsals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listRehearsalsForAdmin(
  festivalId: string,
): Promise<Rehearsal[]> {
  if (!supabase) return mockListRehearsals(festivalId);
  const { data, error } = await client()
    .from("rehearsals")
    .select(
      "id, festival_id, title, starts_at, ends_at, venue_name, venue_url, venue_address, note, is_cancelled",
    )
    .eq("festival_id", festivalId)
    .order("starts_at");
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as Parameters<typeof toRehearsal>[0][]
  ).map(toRehearsal);
}

/** 祭りのリハすべての出欠(集計・一覧用) */
export async function listAttendances(
  rehearsalIds: string[],
): Promise<Attendance[]> {
  if (rehearsalIds.length === 0) return [];
  if (!supabase) return mockListAttendances(rehearsalIds);
  const { data, error } = await client()
    .from("rehearsal_attendances")
    .select("rehearsal_id, serial, status, time_note")
    .in("rehearsal_id", rehearsalIds);
  if (error) throw new Error(error.message);
  return ((data ?? []) as {
    rehearsal_id: string;
    serial: string;
    status: AttendanceStatus;
    time_note: string | null;
  }[]).map((r) => ({
    rehearsalId: r.rehearsal_id,
    serial: r.serial,
    status: r.status,
    timeNote: r.time_note ?? undefined,
  }));
}

/**
 * 貼り付けた出欠を取り込む(同じシリアルは上書き)。
 * 参加者マスターに無いシリアルは外部キーで弾かれるため、事前に呼び出し側で
 * 照合してから渡す。
 */
export async function importAttendances(
  rehearsalId: string,
  rows: ImportRow[],
): Promise<void> {
  if (rows.length === 0) return;
  if (!supabase) return mockImportAttendances(rehearsalId, rows);
  const { error } = await client()
    .from("rehearsal_attendances")
    .upsert(
      rows.map((r) => ({
        rehearsal_id: rehearsalId,
        serial: r.serial,
        status: r.status,
        time_note: r.timeNote ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "rehearsal_id,serial" },
    );
  if (error) throw new Error(error.message);
}

// ---------- 出欠シートの同期設定 ----------

export interface SheetSync {
  festivalId: string;
  /** スプレッドシートのID(URLの /d/ と /edit の間) */
  sheetId: string;
  /** シート(タブ)のgid */
  gid: string;
  /** 定期実行の対象にするか */
  enabled: boolean;
  lastSyncedAt?: string;
  lastResult?: string;
  lastOk?: boolean;
}

interface SheetSyncRow {
  festival_id: string;
  sheet_id: string;
  gid: string;
  enabled: boolean;
  last_synced_at: string | null;
  last_result: string | null;
  last_ok: boolean | null;
}

function toSheetSync(row: SheetSyncRow): SheetSync {
  return {
    festivalId: row.festival_id,
    sheetId: row.sheet_id,
    gid: row.gid,
    enabled: row.enabled,
    lastSyncedAt: row.last_synced_at ?? undefined,
    lastResult: row.last_result ?? undefined,
    lastOk: row.last_ok ?? undefined,
  };
}

/**
 * 貼り付けられたURLからシートIDとgidを取り出す。
 * ID だけを貼られた場合もそのまま受ける。
 */
export function parseSheetUrl(
  input: string,
): { sheetId: string; gid: string } | null {
  const value = input.trim();
  if (value === "") return null;
  const id = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(value)?.[1] ?? value;
  if (!/^[a-zA-Z0-9-_]{20,}$/.test(id)) return null;
  const gid = /[#&?]gid=(\d+)/.exec(value)?.[1] ?? "0";
  return { sheetId: id, gid };
}

export async function getSheetSync(
  festivalId: string,
): Promise<SheetSync | null> {
  if (!supabase) return null;
  const { data, error } = await client()
    .from("rehearsal_sheet_sync")
    .select("festival_id, sheet_id, gid, enabled, last_synced_at, last_result, last_ok")
    .eq("festival_id", festivalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSheetSync(data as SheetSyncRow) : null;
}

export async function saveSheetSync(
  festivalId: string,
  sheetId: string,
  gid: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await client()
    .from("rehearsal_sheet_sync")
    .upsert(
      {
        festival_id: festivalId,
        sheet_id: sheetId,
        gid,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "festival_id" },
    );
  if (error) throw new Error(error.message);
}

export async function deleteSheetSync(festivalId: string): Promise<void> {
  const { error } = await client()
    .from("rehearsal_sheet_sync")
    .delete()
    .eq("festival_id", festivalId);
  if (error) throw new Error(error.message);
}

/** 「今すぐ同期」。結果の文言をそのまま返す。 */
export async function runSheetSync(festivalId: string): Promise<string> {
  const { data, error } = await client().functions.invoke(
    "sync-rehearsal-attendance",
    { body: { festivalId } },
  );
  if (error) throw new Error(error.message);
  const results = (data as { results?: { message: string }[] } | null)?.results;
  return results?.[0]?.message ?? "同期しました";
}
