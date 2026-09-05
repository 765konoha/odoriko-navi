import { supabase } from "./supabase";
import type { Attendance, AttendanceStatus, Rehearsal } from "../types/rehearsal";
import {
  mockListAllAttendances,
  mockListAllRehearsals,
} from "../data/mock/rehearsals";
import { mockRosters } from "../data/mock/participants";
import { repository } from "../repositories";
import { formatDuration, minutesUntil, toDateString } from "./time";

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

/**
 * 祭りを問わないリハ一覧(開始時刻の昇順)。
 * 踊り子から見ると、リハは「祭りAのリハ → 祭りBのリハ → 両方のリハ」と
 * 続くひと続きの予定なので、選んでいる祭りで絞らずにまとめて出す。
 */
export async function listAllRehearsals(): Promise<Rehearsal[]> {
  if (!supabase) return mockListAllRehearsals();
  const { data, error } = await supabase
    .from("rehearsals")
    .select(REHEARSAL_COLUMNS)
    .order("starts_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as RehearsalRow[]).map(toRehearsal);
}

interface RosterRow {
  festival_id: string;
  serial: string;
  name: string;
  nickname: string;
}

/**
 * 祭りごとの名簿(シリアル → 表示名)。
 * 未回答が誰かは祭りごとの名簿でしか分からないため、リハの祭りごとに引く。
 */
export async function loadRosters(
  festivalIds: string[],
): Promise<Map<string, Map<string, string>>> {
  if (festivalIds.length === 0) return new Map();
  if (!supabase) return mockRosters(festivalIds);
  const { data, error } = await supabase
    .from("festival_participants")
    .select("festival_id, serial, name, nickname")
    .in("festival_id", festivalIds);
  if (error) throw new Error(error.message);
  const result = new Map<string, Map<string, string>>();
  for (const row of (data ?? []) as RosterRow[]) {
    const roster = result.get(row.festival_id) ?? new Map<string, string>();
    roster.set(row.serial, row.nickname || row.name);
    result.set(row.festival_id, roster);
  }
  return result;
}

/** 踊り子の画面が必要とするものを一度にまとめたもの */
export interface RehearsalBoard {
  /** 表示するリハ(開始時刻の昇順)。自分が参加する祭りのものだけ */
  rehearsals: Rehearsal[];
  /** リハに添える祭りの名前 */
  festivalNameById: Map<string, string>;
  /** 祭りごとの名簿(シリアル → 表示名) */
  rosterByFestival: Map<string, Map<string, string>>;
  /** 自分の出欠(リハID → 出欠)。シリアル未選択なら空 */
  mine: Map<string, Attendance>;
  /** 全員の出欠 */
  all: Attendance[];
  /**
   * シリアルで祭りを絞ったか。
   * 番号指定なしのときは誰の名簿とも照合できないため絞らない。
   */
  filteredBySerial: boolean;
}

export async function loadRehearsalBoard(
  serial: string | null,
): Promise<RehearsalBoard> {
  const [rehearsals, festivals] = await Promise.all([
    listAllRehearsals(),
    repository.listFestivals(),
  ]);
  const festivalIds = [...new Set(rehearsals.map((r) => r.festivalId))];
  const [rosterByFestival, all, mine] = await Promise.all([
    loadRosters(festivalIds),
    listAllAttendances(),
    serial
      ? listMyAttendances(serial)
      : Promise.resolve(new Map<string, Attendance>()),
  ]);
  // 自分が名簿に載っている祭りのリハだけを出す。
  // 祭りをまたいで並べるが、参加していない祭りのリハまでは要らないため。
  const visible = serial
    ? rehearsals.filter(
        (r) => rosterByFestival.get(r.festivalId)?.has(serial) ?? false,
      )
    : rehearsals;

  return {
    rehearsals: visible,
    festivalNameById: new Map(festivals.map((f) => [f.id, f.name])),
    rosterByFestival,
    mine,
    all,
    filteredBySerial: serial != null,
  };
}

/**
 * 全リハの出欠を全員分取得する。
 * 誰が来られないかは立ち位置の調整に必要なので、踊り子にも見せる。
 * リハIDで絞らないのは、祭りをまたいで全部を見るため
 * (絞るとリハが増えるほどURLが長くなる)。
 */
export async function listAllAttendances(): Promise<Attendance[]> {
  if (!supabase) return mockListAllAttendances();
  const { data, error } = await supabase
    .from("rehearsal_attendances")
    .select("rehearsal_id, serial, status, time_note");
  if (error) throw new Error(error.message);
  return ((data ?? []) as AttendanceRow[]).map(toAttendance);
}

/** 自分の出欠だけを取得する(リハID → 出欠) */
export async function listMyAttendances(
  serial: string,
): Promise<Map<string, Attendance>> {
  const rows = !supabase
    ? mockListAllAttendances().filter((a) => a.serial === serial)
    : await (async () => {
        const { data, error } = await supabase
          .from("rehearsal_attendances")
          .select("rehearsal_id, serial, status, time_note")
          .eq("serial", serial);
        if (error) throw new Error(error.message);
        return ((data ?? []) as AttendanceRow[]).map(toAttendance);
      })();
  return new Map(rows.map((a) => [a.rehearsalId, a]));
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

/** JSTの日付で数えた日数差("2026-09-04" → "2026-09-06" は 2) */
function daysBetween(from: string, to: string): number {
  const ms =
    Date.parse(`${to}T00:00:00+09:00`) - Date.parse(`${from}T00:00:00+09:00`);
  return Math.round(ms / 86_400_000);
}

/**
 * 「次のリハ」に添える残り時間。
 * 当日は分単位で、先の日はカレンダー上の日数で言う
 * (本番当日の予定と違い、リハは何日も先のことがあるため)。
 * 始まっている・終わっている場合は null。
 */
export function rehearsalCountdown(
  rehearsal: Rehearsal,
  now: Date,
): string | null {
  const min = minutesUntil(rehearsal.startsAt, now);
  if (min < 0) return null;
  const days = daysBetween(
    toDateString(now.toISOString()),
    toDateString(rehearsal.startsAt),
  );
  if (days <= 0) return `開始まで ${formatDuration(min)}`;
  if (days === 1) return "明日";
  return `あと${days}日`;
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
 * 最後にシートを読んだ時刻を、祭りごとにまとめて取得する。
 * 画面には複数の祭りのリハが並ぶため、祭りごとに判断できるようにする。
 * anon には last_synced_at の列だけ権限を与えてあるので、
 * シートのURLはここからは読めない。
 */
export async function listSheetSyncedAt(
  festivalIds: string[],
): Promise<Map<string, string | null>> {
  if (!supabase || festivalIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("rehearsal_sheet_sync")
    .select("festival_id, last_synced_at")
    .in("festival_id", festivalIds);
  if (error) return new Map(); // 設定が無い・権限が無い場合は自動更新しないだけ
  return new Map(
    ((data ?? []) as { festival_id: string; last_synced_at: string | null }[])
      .map((r) => [r.festival_id, r.last_synced_at] as const),
  );
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
