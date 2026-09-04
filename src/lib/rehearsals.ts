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

/**
 * リハの出欠を全員分取得する。
 * 誰が来られないかは立ち位置の調整に必要なので、踊り子にも見せる。
 */
export async function listAllAttendances(
  rehearsalIds: string[],
): Promise<Attendance[]> {
  if (rehearsalIds.length === 0) return [];
  if (!supabase) return mockListAttendances(rehearsalIds);
  const { data, error } = await supabase
    .from("rehearsal_attendances")
    .select("rehearsal_id, serial, status, time_note")
    .in("rehearsal_id", rehearsalIds);
  if (error) throw new Error(error.message);
  return ((data ?? []) as AttendanceRow[]).map(toAttendance);
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

// ---------- 出欠シートの自動更新 ----------

/**
 * 画面を開いたときにシートを読み直す間隔。
 * Edge Function 側でも同じ間隔で弾いているが、ここで先に判断することで
 * 「古くないときは関数を呼ばない」= 呼び出し回数をほぼ同期の回数まで減らす。
 */
export const SHEET_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/**
 * 最後にシートを読んだ時刻。設定が無ければ null。
 * anon には last_synced_at の列だけ権限を与えてあるので、
 * シートのURLはここからは読めない。
 */
export async function getSheetSyncedAt(
  festivalId: string,
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rehearsal_sheet_sync")
    .select("festival_id, last_synced_at")
    .eq("festival_id", festivalId)
    .maybeSingle();
  if (error) return null; // 設定が無い・権限が無い場合は自動更新しないだけ
  return (data as { last_synced_at: string | null } | null)?.last_synced_at ?? null;
}

/**
 * シートを読み直すよう頼む。実際に読むかは Edge Function が判断する。
 * 失敗しても画面は既存のデータで動くので、例外は投げない。
 */
export async function requestSheetRefresh(festivalId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.functions.invoke("sync-rehearsal-attendance", {
      body: { festivalId, refreshOnly: true },
    });
  } catch {
    // 同期できなくても、取り込み済みの出欠は表示できる
  }
}
