import { supabase } from "./supabase";
import { mockParticipantMaster } from "../data/mock/participants";
import type { ParticipantMasterEntry } from "../types/domain";

// 踊り子マスタ(participants)の管理(要ログイン)。
// 統合・削除は付け替える表が多いので、まとめて1回で行う RPC を使う
// (supabase/migrations/0026_participant_master_admin.sql)。

function client() {
  if (!supabase) throw new Error("Supabaseが設定されていません");
  return supabase;
}

/** 統合・削除の前に見せる「何が起きるか」の1行 */
export interface MasterChangeLine {
  /** info: そのまま進む / warn: 消えるものがある / error: このままではできない */
  level: "info" | "warn" | "error";
  message: string;
}

interface MasterRow {
  serial: string;
  name: string | null;
  nickname: string | null;
  festival_names: string[] | null;
  attendance_count: number;
  prop_count: number;
  transfer_count: number;
  push_count: number;
  last_seen_at: string | null;
}

// mock モード(Supabase 未設定)では、画面の流れを確かめられるよう手元で消す
let mockRows: ParticipantMasterEntry[] | null = null;
function mockMaster(): ParticipantMasterEntry[] {
  mockRows ??= mockParticipantMaster();
  return mockRows;
}

export async function listParticipantMaster(): Promise<ParticipantMasterEntry[]> {
  if (!supabase) return mockMaster().map((r) => ({ ...r }));
  const { data, error } = await client().rpc("admin_participant_master");
  if (error) throw error;
  return ((data ?? []) as MasterRow[]).map((r) => ({
    serial: r.serial,
    name: r.name,
    nickname: r.nickname,
    festivalNames: r.festival_names ?? [],
    attendanceCount: r.attendance_count,
    propCount: r.prop_count,
    transferCount: r.transfer_count,
    pushCount: r.push_count,
    lastSeenAt: r.last_seen_at,
  }));
}

/** 統合で何が起きるか(apply = true で反映。error があれば反映されない) */
export async function mergeParticipant(
  from: string,
  to: string,
  apply: boolean,
): Promise<MasterChangeLine[]> {
  if (!supabase) {
    const lines: MasterChangeLine[] = [
      { level: "info", message: `${from} の記録を ${to} に付け替えます(mock)。` },
      { level: "info", message: `${from} はマスタから消えます。` },
    ];
    if (apply) mockRows = mockMaster().filter((r) => r.serial !== from);
    return lines;
  }
  const { data, error } = await client().rpc("admin_merge_participant", {
    p_from: from,
    p_to: to,
    p_apply: apply,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MasterChangeLine[];
}

/** 削除で何が起きるか(apply = true で反映。error があれば反映されない) */
export async function deleteMasterParticipant(
  serial: string,
  apply: boolean,
): Promise<MasterChangeLine[]> {
  if (!supabase) {
    const lines: MasterChangeLine[] = [
      { level: "info", message: `${serial} はマスタから消えます(mock)。` },
    ];
    if (apply) mockRows = mockMaster().filter((r) => r.serial !== serial);
    return lines;
  }
  const { data, error } = await client().rpc("admin_delete_participant", {
    p_serial: serial,
    p_apply: apply,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MasterChangeLine[];
}
