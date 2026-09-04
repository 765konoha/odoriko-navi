import { supabase } from "./supabase";
import { mockDisplayNames } from "../data/mock/participants";
import { formatDateLabel, toDateString } from "./time";
import type {
  PropAssignment,
  PropEvent,
  PropHistoryEntry,
  PropItem,
  PropTransfer,
} from "../types/props";

// 小道具の参照と、踊り子側からの安全な更新(RPC)。
// 更新はすべて Supabase の RPC 経由で行い、テーブルを直接 UPDATE しない。

const PROP_ITEM_COLUMNS =
  "id, category, identifier, display_name, condition, condition_note, note, current_holder_serial, is_archived";
const PROP_TRANSFER_COLUMNS =
  "id, prop_item_id, from_serial, to_serial, status, scheduled_at, note, created_at, completed_at, cancelled_at, cancelled_reason";
const PROP_EVENT_COLUMNS = "id, kind, festival_id, name, event_date, note";
const PROP_ASSIGNMENT_COLUMNS = "id, event_id, prop_item_id, user_serial";
const PROP_HISTORY_COLUMNS =
  "id, prop_item_id, transfer_id, action, actor_serial, actor_is_admin, from_value, to_value, note, created_at";

interface PropItemRow {
  id: string;
  category: string;
  identifier: string;
  display_name: string;
  condition: string;
  condition_note: string | null;
  note: string | null;
  current_holder_serial: string | null;
  is_archived: boolean;
}

interface PropTransferRow {
  id: string;
  prop_item_id: string;
  from_serial: string | null;
  to_serial: string;
  status: string;
  scheduled_at: string | null;
  note: string | null;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}

export function toPropItem(row: PropItemRow): PropItem {
  return {
    id: row.id,
    category: row.category,
    identifier: row.identifier,
    displayName: row.display_name,
    condition: row.condition as PropItem["condition"],
    conditionNote: row.condition_note ?? undefined,
    note: row.note ?? undefined,
    currentHolderSerial: row.current_holder_serial ?? undefined,
    isArchived: row.is_archived,
  };
}

export function toPropTransfer(row: PropTransferRow): PropTransfer {
  return {
    id: row.id,
    propItemId: row.prop_item_id,
    fromSerial: row.from_serial ?? undefined,
    toSerial: row.to_serial,
    status: row.status as PropTransfer["status"],
    scheduledAt: row.scheduled_at ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelledReason: row.cancelled_reason ?? undefined,
  };
}

function client() {
  if (!supabase) throw new Error("Supabaseが設定されていません");
  return supabase;
}

/**
 * 所有権・受け渡し状態の更新はオンラインでDB確定した場合のみ完了扱いにする。
 * オフラインでは実行前に中断する。
 */
export function requireOnline(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error(
      "通信が必要な操作です。接続後にもう一度お試しください。",
    );
  }
}

// ---------- 参照 ----------

export async function listPropItems(
  includeArchived = false,
): Promise<PropItem[]> {
  if (!supabase) return [];
  let query = supabase.from("prop_items").select(PROP_ITEM_COLUMNS);
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query.order("category").order("identifier");
  if (error) throw error;
  return ((data ?? []) as PropItemRow[]).map(toPropItem);
}

/** 受け渡し予定(pending)の一覧。件数が少ないため全件取得して画面側で絞る */
export async function listPendingTransfers(): Promise<PropTransfer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("prop_transfers")
    .select(PROP_TRANSFER_COLUMNS)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as PropTransferRow[]).map(toPropTransfer);
}

export async function listTransfersOfItem(
  propItemId: string,
): Promise<PropTransfer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("prop_transfers")
    .select(PROP_TRANSFER_COLUMNS)
    .eq("prop_item_id", propItemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as PropTransferRow[]).map(toPropTransfer);
}

/** シリアル → 最新のニックネーム(取得できない場合はシリアルのみ表示する) */
export async function loadDisplayNames(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase) return mockDisplayNames();
  const { data, error } = await supabase
    .from("participant_display")
    .select("serial, nickname");
  if (error) return map;
  for (const row of (data ?? []) as { serial: string; nickname: string }[]) {
    map.set(row.serial, row.nickname);
  }
  return map;
}

/** 「615 / みや」形式。ニックネーム不明ならシリアルのみ */
export function serialLabel(
  serial: string | undefined | null,
  names: Map<string, string>,
): string {
  if (!serial) return "未設定";
  const nickname = names.get(serial);
  return nickname ? `${serial} / ${nickname}` : serial;
}

export interface PropUserData {
  /** 自分が現在保管中 */
  holding: PropItem[];
  /** 自分が渡す予定(pending) */
  outgoing: { transfer: PropTransfer; item: PropItem }[];
  /** 自分が受け取る予定(pending)。ready=false は前の受け渡し待ち */
  incoming: { transfer: PropTransfer; item: PropItem; ready: boolean }[];
  names: Map<string, string>;
}

export async function loadPropUserData(serial: string): Promise<PropUserData> {
  const [items, pending, names] = await Promise.all([
    listPropItems(),
    listPendingTransfers(),
    loadDisplayNames(),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const withItem = (t: PropTransfer) => {
    const item = itemById.get(t.propItemId);
    return item ? { transfer: t, item } : null;
  };
  const isPair = (
    v: { transfer: PropTransfer; item: PropItem } | null,
  ): v is { transfer: PropTransfer; item: PropItem } => v != null;
  // 予定日の早い順。未設定は末尾
  const bySchedule = (
    a: { transfer: PropTransfer },
    b: { transfer: PropTransfer },
  ) => {
    const x = a.transfer.scheduledAt;
    const y = b.transfer.scheduledAt;
    if (x === y) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return x < y ? -1 : 1;
  };
  const byScheduleThenChain = (
    a: { transfer: PropTransfer },
    b: { transfer: PropTransfer },
  ) =>
    bySchedule(a, b) ||
    (a.transfer.createdAt < b.transfer.createdAt ? -1 : 1);
  return {
    holding: items.filter((i) => i.currentHolderSerial === serial),
    outgoing: pending
      .filter((t) => t.fromSerial === serial)
      .map(withItem)
      .filter(isPair)
      .sort(byScheduleThenChain),
    incoming: pending
      .filter((t) => t.toSerial === serial)
      .map(withItem)
      .filter(isPair)
      .sort(byScheduleThenChain)
      .map((v) => ({ ...v, ready: isHeadTransfer(v.transfer, pending) })),
    names,
  };
}

export async function listPropEvents(): Promise<PropEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("prop_events")
    .select(PROP_EVENT_COLUMNS)
    .order("event_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      kind: string;
      festival_id: string | null;
      name: string;
      event_date: string | null;
      note: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    kind: r.kind as PropEvent["kind"],
    festivalId: r.festival_id ?? undefined,
    name: r.name,
    eventDate: r.event_date ?? undefined,
    note: r.note ?? undefined,
  }));
}

export async function listAssignments(
  eventId: string,
): Promise<PropAssignment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("prop_event_assignments")
    .select(PROP_ASSIGNMENT_COLUMNS)
    .eq("event_id", eventId);
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      event_id: string;
      prop_item_id: string;
      user_serial: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    propItemId: r.prop_item_id,
    userSerial: r.user_serial ?? undefined,
  }));
}

export async function listHistory(
  propItemId: string,
): Promise<PropHistoryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("prop_history")
    .select(PROP_HISTORY_COLUMNS)
    .eq("prop_item_id", propItemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      prop_item_id: string;
      transfer_id: string | null;
      action: string;
      actor_serial: string | null;
      actor_is_admin: boolean;
      from_value: string | null;
      to_value: string | null;
      note: string | null;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    propItemId: r.prop_item_id,
    transferId: r.transfer_id ?? undefined,
    action: r.action as PropHistoryEntry["action"],
    actorSerial: r.actor_serial ?? undefined,
    actorIsAdmin: r.actor_is_admin,
    fromValue: r.from_value ?? undefined,
    toValue: r.to_value ?? undefined,
    note: r.note ?? undefined,
    createdAt: r.created_at,
  }));
}

// ---------- 更新(RPC。競合・不整合はDB側で検証する) ----------

async function callRpc(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  requireOnline();
  const { data, error } = await client().rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

/** 受け渡し予定の作成(現在の保有者本人) */
export async function createTransfer(
  propItemId: string,
  actorSerial: string,
  toSerial: string,
  /** 受け渡し予定日(ISO)。未指定なら null */
  scheduledAt: string | null,
  note?: string,
): Promise<void> {
  await callRpc("prop_create_transfer", {
    p_item_id: propItemId,
    p_actor_serial: actorSerial,
    p_to_serial: toSerial,
    p_scheduled_at: scheduledAt,
    p_note: note ?? null,
  });
}

/**
 * 次に受け渡しを作れる人(鎖の末尾の受取者。予定が無ければ現在の保有者)。
 * DB側の prop_expected_holder と同じ考え方。
 */
export function expectedHolder(
  item: PropItem,
  pending: PropTransfer[],
): string | null {
  const chain = pending
    .filter((t) => t.propItemId === item.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const last = chain[chain.length - 1];
  return last ? last.toSerial : (item.currentHolderSerial ?? null);
}

/** その受け渡しが鎖の先頭か(先頭だけ受取完了できる) */
export function isHeadTransfer(
  transfer: PropTransfer,
  pending: PropTransfer[],
): boolean {
  const first = pending
    .filter((t) => t.propItemId === transfer.propItemId)
    .reduce<PropTransfer | null>(
      (min, t) => (min == null || t.createdAt < min.createdAt ? t : min),
      null,
    );
  return first?.id === transfer.id;
}

/** 受け渡し予定日の表示(例: 8/29(土))。未設定なら null */
export function scheduledLabel(iso: string | undefined): string | null {
  return iso ? formatDateLabel(toDateString(iso)) : null;
}

/** 受け渡し予定日の変更(管理者のみ) */
export async function updateTransferSchedule(
  transferId: string,
  scheduledAt: string | null,
): Promise<void> {
  await callRpc("prop_update_transfer_schedule", {
    p_transfer_id: transferId,
    p_scheduled_at: scheduledAt,
  });
}

/** 受け渡し先の変更(鎖の末尾のみ・出し手本人) */
export async function changeTransferTarget(
  transferId: string,
  actorSerial: string,
  newToSerial: string,
): Promise<void> {
  await callRpc("prop_change_transfer_target", {
    p_transfer_id: transferId,
    p_actor_serial: actorSerial,
    p_new_to_serial: newToSerial,
  });
}

/** 受取完了(受取予定者本人のみ) */
export async function completeTransfer(
  transferId: string,
  actorSerial: string,
): Promise<void> {
  await callRpc("prop_complete_transfer", {
    p_transfer_id: transferId,
    p_actor_serial: actorSerial,
  });
}
