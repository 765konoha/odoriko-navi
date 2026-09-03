import { supabase } from "./supabase";
import type { Attendance, AttendanceStatus, Rehearsal } from "../types/rehearsal";
import {
  mockListAttendances,
  mockListRehearsals,
} from "../data/mock/rehearsals";

const REHEARSAL_COLUMNS =
  "id, festival_id, title, starts_at, ends_at, venue_name, venue_url, venue_address, note, is_cancelled";

interface RehearsalRow {
  id: string;
  festival_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string;
  venue_url: string | null;
  venue_address: string | null;
  note: string | null;
  is_cancelled: boolean;
}

interface AttendanceRow {
  rehearsal_id: string;
  serial: string;
  status: AttendanceStatus;
  time_note: string | null;
}

export function toRehearsal(row: RehearsalRow): Rehearsal {
  return {
    id: row.id,
    festivalId: row.festival_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    venueName: row.venue_name,
    venueUrl: row.venue_url ?? undefined,
    venueAddress: row.venue_address ?? undefined,
    note: row.note ?? undefined,
    isCancelled: row.is_cancelled,
  };
}

function toAttendance(row: AttendanceRow): Attendance {
  return {
    rehearsalId: row.rehearsal_id,
    serial: row.serial,
    status: row.status,
    timeNote: row.time_note ?? undefined,
  };
}

/** 祭りのリハ一覧(開始時刻の昇順) */
export async function listRehearsals(festivalId: string): Promise<Rehearsal[]> {
  if (!supabase) return mockListRehearsals(festivalId);
  const { data, error } = await supabase
    .from("rehearsals")
    .select(REHEARSAL_COLUMNS)
    .eq("festival_id", festivalId)
    .order("starts_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as RehearsalRow[]).map(toRehearsal);
}

/** 自分の出欠だけを取得する */
export async function listMyAttendances(
  serial: string,
  rehearsalIds: string[],
): Promise<Map<string, Attendance>> {
  if (rehearsalIds.length === 0) return new Map();
  if (!supabase) {
    return new Map(
      mockListAttendances(rehearsalIds)
        .filter((a) => a.serial === serial)
        .map((a) => [a.rehearsalId, a]),
    );
  }
  const { data, error } = await supabase
    .from("rehearsal_attendances")
    .select("rehearsal_id, serial, status, time_note")
    .eq("serial", serial)
    .in("rehearsal_id", rehearsalIds);
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as AttendanceRow[])
      .map(toAttendance)
      .map((a) => [a.rehearsalId, a]),
  );
}

/**
 * 一覧や確認ダイアログで使う呼び名。
 * 踊り子が知りたいのは「いつ・どこ」なので、会場名で呼ぶ。
 * 目的・内容(「踊りこみ、固め」など)は参考情報として添えるだけにする。
 */
export function rehearsalLabel(rehearsal: Rehearsal): string {
  return rehearsal.venueName;
}

/** 会場を地図で開く(緯度経度は持たず、名前と住所で検索する) */
export function venueMapUrl(rehearsal: Rehearsal): string {
  const q = [rehearsal.venueAddress, rehearsal.venueName]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** 終わったリハか(終了時刻。無ければ開始時刻を基準にする) */
export function isPastRehearsal(rehearsal: Rehearsal, now: Date): boolean {
  const at = rehearsal.endsAt ?? rehearsal.startsAt;
  return new Date(at).getTime() < now.getTime();
}
