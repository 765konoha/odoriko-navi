export interface Rehearsal {
  id: string;
  festivalId: string;
  title: string;
  /** ISO */
  startsAt: string;
  endsAt?: string;
  venueName: string;
  venueUrl?: string;
  venueAddress?: string;
  note?: string;
  isCancelled: boolean;
}

/** エントリーフォームの選択肢に対応する */
export type AttendanceStatus =
  | "present"
  | "late"
  | "leave_early"
  | "late_leave_early"
  | "absent";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "参加",
  late: "遅刻",
  leave_early: "早退",
  late_leave_early: "遅刻早退",
  absent: "欠席",
};

/** 出欠バッジの色(参加=緑、欠席=赤、途中の出入り=橙) */
export const ATTENDANCE_BADGE_CLASS: Record<AttendanceStatus, string> = {
  present: "bg-emerald-100 text-emerald-800",
  late: "bg-amber-100 text-amber-800",
  leave_early: "bg-amber-100 text-amber-800",
  late_leave_early: "bg-amber-100 text-amber-800",
  absent: "bg-red-100 text-red-700",
};

/** 集計・一覧での並び順(参加から欠席へ) */
export const ATTENDANCE_ORDER: AttendanceStatus[] = [
  "present",
  "late",
  "leave_early",
  "late_leave_early",
  "absent",
];

export interface Attendance {
  rehearsalId: string;
  serial: string;
  status: AttendanceStatus;
  /** 「19:30in」など、フォームの入力をそのまま保持する */
  timeNote?: string;
}
