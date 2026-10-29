import { supabase } from "./supabase";
import {
  mockParticipantMaster,
  mockRegistrations,
} from "../data/mock/participants";
import type { ParticipantMasterEntry } from "../types/domain";
import { normalizeSerial } from "./serial";
import { updateParticipant } from "./adminApi";

// 踊り子マスタ(participants)の管理(要ログイン)。
// シリアルの変更・統合・削除は付け替える表が多いので、まとめて1回で行う RPC を使う
// (supabase/migrations/0026_participant_master_admin.sql / 0027_participant_rename.sql)。
// 名前は祭りごとの名簿(festival_participants)が持っているので、そちらを書き換える。

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

/**
 * シリアルを変更する(apply = true で反映)。
 * 新しいシリアルは表記をそろえてから使う。既にあるシリアルには変更できない
 * (同じ人をまとめるときは統合を使う)。
 */
export async function renameParticipant(
  from: string,
  to: string,
  apply: boolean,
): Promise<MasterChangeLine[]> {
  if (!supabase) {
    const target = normalizeSerial(to);
    if (mockMaster().some((r) => r.serial === target)) {
      return [{ level: "error", message: `シリアル「${target}」は既にあります。` }];
    }
    if (apply) {
      mockRows = mockMaster().map((r) =>
        r.serial === from ? { ...r, serial: target } : r,
      );
    }
    return [{ level: "info", message: `${from} を ${target} に変更します(mock)。` }];
  }
  const { data, error } = await client().rpc("admin_rename_participant", {
    p_from: from,
    p_to: to,
    p_apply: apply,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MasterChangeLine[];
}

/** 祭りごとの名簿の登録(名前・ニックネームは祭りごとに持っている) */
export interface MasterRegistration {
  /** festival_participants.id */
  id: string;
  festivalName: string;
  name: string;
  nickname: string;
}

export async function listRegistrations(
  serial: string,
): Promise<MasterRegistration[]> {
  if (!supabase) return mockRegistrations(serial);
  const { data, error } = await client()
    .from("festival_participants")
    .select("id, festival_id, name, nickname")
    .eq("serial", serial);
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    festival_id: string;
    name: string;
    nickname: string;
  }[];
  if (rows.length === 0) return [];
  const { data: festivals, error: festivalError } = await client()
    .from("festivals")
    .select("id, name")
    .in("id", rows.map((r) => r.festival_id));
  if (festivalError) throw festivalError;
  const nameById = new Map(
    ((festivals ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name]),
  );
  return rows
    .map((r) => ({
      id: r.id,
      festivalName: nameById.get(r.festival_id) ?? "",
      name: r.name,
      nickname: r.nickname,
    }))
    .sort((a, b) => a.festivalName.localeCompare(b.festivalName, "ja"));
}

/** 名簿の名前・ニックネームを書き換える(変わったものだけを渡す) */
export async function updateRegistrations(
  serial: string,
  changed: MasterRegistration[],
): Promise<void> {
  if (!supabase) {
    const last = changed[changed.length - 1];
    if (last) {
      mockRows = mockMaster().map((r) =>
        r.serial === serial ? { ...r, name: last.name, nickname: last.nickname } : r,
      );
    }
    return;
  }
  for (const r of changed) {
    await updateParticipant(r.id, r.name, r.nickname);
  }
}
