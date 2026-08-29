import { supabase } from "./supabase";
import type { PropCondition, PropEvent, PropTransfer } from "../types/props";
import { requireOnline, toPropTransfer } from "./props";

// 小道具管理(小道具担当用)。既存の管理者ログイン(authenticated)で操作する。
// 保有者の手動変更だけは競合・pending整合性のため RPC を使う。

function client() {
  if (!supabase) throw new Error("Supabaseが設定されていません");
  return supabase;
}

export interface PropItemInput {
  category: string;
  identifier: string;
  condition: PropCondition;
  conditionNote: string | null;
  note: string | null;
  /** 登録時のみ利用(更新時の保有者変更は adminSetHolder を使う) */
  currentHolderSerial?: string | null;
}

/**
 * 表示名は「種類+識別」で固定する。
 * 個別に付け替えられると現物との突き合わせがぶれるため、ここだけで組み立てる。
 */
export function propDisplayName(category: string, identifier: string): string {
  return `${category.trim()}${identifier.trim()}`;
}

export async function createPropItem(input: PropItemInput): Promise<void> {
  const { error } = await client().from("prop_items").insert({
    category: input.category,
    identifier: input.identifier,
    display_name: propDisplayName(input.category, input.identifier),
    condition: input.condition,
    condition_note: input.conditionNote,
    note: input.note,
    current_holder_serial: input.currentHolderSerial ?? null,
  });
  if (error) throw error;
}

/** 保有者以外の項目を更新する(状態変更はトリガーが履歴に記録する) */
export async function updatePropItem(
  id: string,
  input: PropItemInput,
): Promise<void> {
  const { error } = await client()
    .from("prop_items")
    .update({
      category: input.category,
      identifier: input.identifier,
      display_name: propDisplayName(input.category, input.identifier),
      condition: input.condition,
      condition_note: input.conditionNote,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** 利用終了(履歴の参照整合性を保つため物理削除しない) */
export async function setPropArchived(
  id: string,
  archived: boolean,
): Promise<void> {
  const { error } = await client()
    .from("prop_items")
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** 現在保有者の手動変更(pending があれば自動キャンセル・履歴も記録) */
export async function adminSetHolder(
  propItemId: string,
  newHolderSerial: string | null,
  note: string | null,
): Promise<void> {
  requireOnline();
  const { error } = await client().rpc("prop_admin_set_holder", {
    p_item_id: propItemId,
    p_new_holder_serial: newHolderSerial,
    p_note: note,
  });
  if (error) throw new Error(error.message);
}

// ---------- イベント ----------

export interface PropEventInput {
  kind: PropEvent["kind"];
  festivalId: string | null;
  name: string;
  eventDate: string | null;
  note: string | null;
}

export async function createPropEvent(input: PropEventInput): Promise<void> {
  const { error } = await client().from("prop_events").insert({
    kind: input.kind,
    festival_id: input.festivalId,
    name: input.name,
    event_date: input.eventDate,
    note: input.note,
  });
  if (error) throw error;
}

export async function deletePropEvent(id: string): Promise<void> {
  const { error } = await client().from("prop_events").delete().eq("id", id);
  if (error) throw error;
}

/** イベントごとの使用予定者を設定する(保有者は変更しない) */
export async function setAssignment(
  eventId: string,
  propItemId: string,
  userSerial: string | null,
  previousSerial: string | null,
): Promise<void> {
  const { error } = await client()
    .from("prop_event_assignments")
    .upsert(
      { event_id: eventId, prop_item_id: propItemId, user_serial: userSerial },
      { onConflict: "event_id,prop_item_id" },
    );
  if (error) throw error;
  const { error: historyError } = await client().from("prop_history").insert({
    prop_item_id: propItemId,
    action: "assignment_changed",
    actor_is_admin: true,
    from_value: previousSerial,
    to_value: userSerial,
  });
  if (historyError) throw historyError;
}

// ---------- 受け渡し ----------

export async function listAllTransfers(limit = 100): Promise<PropTransfer[]> {
  const { data, error } = await client()
    .from("prop_transfers")
    .select(
      "id, prop_item_id, from_serial, to_serial, status, scheduled_at, note, created_at, completed_at, cancelled_at, cancelled_reason",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) =>
    toPropTransfer(row as Parameters<typeof toPropTransfer>[0]),
  );
}

/**
 * 運営による受取完了の代理報告。
 * 現物は渡っているのに本人が「受け取りました」を押さない場合に使う。
 * 保有者の直接変更と違い、受け渡し予定はキャンセルではなく完了として記録され、
 * 後続の予定(複数日の受け渡し)もそのまま残る。
 */
export async function adminCompleteTransfer(
  transferId: string,
  note?: string,
): Promise<void> {
  requireOnline();
  const { error } = await client().rpc("prop_admin_complete_transfer", {
    p_transfer_id: transferId,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

/** 受け渡し予定のキャンセル(履歴を残す) */
export async function cancelTransfer(transfer: PropTransfer): Promise<void> {
  const { error } = await client()
    .from("prop_transfers")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: "管理者によるキャンセル",
    })
    .eq("id", transfer.id)
    .eq("status", "pending");
  if (error) throw error;
  const { error: historyError } = await client().from("prop_history").insert({
    prop_item_id: transfer.propItemId,
    transfer_id: transfer.id,
    action: "transfer_cancelled",
    actor_is_admin: true,
    from_value: transfer.fromSerial ?? null,
    to_value: transfer.toSerial,
    note: "管理者によるキャンセル",
  });
  if (historyError) throw historyError;
}
