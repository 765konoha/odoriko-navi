import { supabase } from "./supabase";
import type { Attendance, AttendanceStatus, Rehearsal } from "../types/rehearsal";
import { toRehearsal } from "./rehearsals";
import type { ImportRow } from "./attendanceImport";

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
  const { error } = await client().from("rehearsals").insert(toRow(input));
  if (error) throw new Error(error.message);
}

export async function updateRehearsal(
  id: string,
  input: RehearsalInput,
): Promise<void> {
  const { error } = await client()
    .from("rehearsals")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRehearsal(id: string): Promise<void> {
  const { error } = await client().from("rehearsals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listRehearsalsForAdmin(
  festivalId: string,
): Promise<Rehearsal[]> {
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
