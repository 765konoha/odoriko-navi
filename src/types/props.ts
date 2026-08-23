// 小道具(prop)関連のドメイン型。
// 小道具は祭りを跨いで継続管理するため festival には依存しない。
// 参加者の識別は participants(マスター)のシリアル文字列で行う。

export const PROP_CONDITIONS = [
  { value: "normal", label: "正常" },
  { value: "damaged", label: "破損" },
  { value: "broken", label: "故障" },
  { value: "lost", label: "紛失" },
  { value: "repairing", label: "修理中" },
  { value: "retired", label: "使用停止" },
] as const;

export type PropCondition = (typeof PROP_CONDITIONS)[number]["value"];

/** 新規の受け渡しを開始できない状態(保有者・履歴は残す) */
export const BLOCKED_CONDITIONS: PropCondition[] = ["lost", "retired"];

export function conditionLabel(condition: string): string {
  return (
    PROP_CONDITIONS.find((c) => c.value === condition)?.label ?? condition
  );
}

export interface PropItem {
  id: string;
  category: string;
  identifier: string;
  displayName: string;
  condition: PropCondition;
  conditionNote?: string;
  note?: string;
  /** 現在の保有者シリアル(未設定あり) */
  currentHolderSerial?: string;
  isArchived: boolean;
}

export type PropTransferStatus = "pending" | "completed" | "cancelled";

export interface PropTransfer {
  id: string;
  propItemId: string;
  fromSerial?: string;
  toSerial: string;
  status: PropTransferStatus;
  scheduledAt?: string;
  note?: string;
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
}

export type PropEventKind = "festival" | "project" | "practice" | "other";

export const PROP_EVENT_KINDS: { value: PropEventKind; label: string }[] = [
  { value: "festival", label: "祭り" },
  { value: "project", label: "案件" },
  { value: "practice", label: "練習・リハ" },
  { value: "other", label: "その他" },
];

export interface PropEvent {
  id: string;
  kind: PropEventKind;
  festivalId?: string;
  name: string;
  eventDate?: string;
  note?: string;
}

/** イベントごとの使用予定者(現在の保有者とは独立) */
export interface PropAssignment {
  id: string;
  eventId: string;
  propItemId: string;
  userSerial?: string;
}

export type PropHistoryAction =
  | "item_created"
  | "transfer_created"
  | "transfer_target_changed"
  | "transfer_completed"
  | "transfer_cancelled"
  | "holder_changed_by_admin"
  | "condition_changed"
  | "assignment_changed";

export interface PropHistoryEntry {
  id: string;
  propItemId: string;
  transferId?: string;
  action: PropHistoryAction;
  actorSerial?: string;
  actorIsAdmin: boolean;
  fromValue?: string;
  toValue?: string;
  note?: string;
  createdAt: string;
}

const ACTION_LABELS: Record<PropHistoryAction, string> = {
  item_created: "小道具を登録",
  transfer_created: "受け渡し予定を作成",
  transfer_target_changed: "受け渡し先を変更",
  transfer_completed: "受取完了",
  transfer_cancelled: "受け渡しをキャンセル",
  holder_changed_by_admin: "管理者による保有者変更",
  condition_changed: "状態を変更",
  assignment_changed: "使用予定者を変更",
};

export function historyActionLabel(action: string): string {
  return ACTION_LABELS[action as PropHistoryAction] ?? action;
}
