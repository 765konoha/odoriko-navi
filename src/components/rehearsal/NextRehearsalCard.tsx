import { Link } from "react-router-dom";
import { useNextRehearsal } from "../../hooks/useNextRehearsal";
import {
  ATTENDANCE_BADGE_CLASS,
  ATTENDANCE_LABELS,
} from "../../types/rehearsal";
import { formatDateLabel, formatTime, toDateString } from "../../lib/time";

/** ホームに置く「次のリハ」の入口 */
export default function NextRehearsalCard({ slug }: { slug: string }) {
  const { loading, next } = useNextRehearsal();

  return (
    <Link
      to={`/${slug}/rehearsal`}
      className="block rounded-2xl bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold text-slate-500">🕒 次のリハ</p>
        <span className="ml-auto text-sm font-bold text-blue-700">
          確認する ›
        </span>
      </div>

      {loading && <p className="mt-1 text-sm text-slate-500">読み込み中…</p>}

      {!loading && next == null && (
        <p className="mt-1 text-sm text-slate-600">
          予定されているリハはありません。
        </p>
      )}

      {next && (
        <>
          <div className="mt-1 flex items-start gap-2">
            <p className="min-w-0 flex-1 text-base font-bold text-slate-900">
              {formatDateLabel(toDateString(next.rehearsal.startsAt))}{" "}
              {formatTime(next.rehearsal.startsAt)}
              {next.rehearsal.endsAt && `〜${formatTime(next.rehearsal.endsAt)}`}
            </p>
            {next.attendance && (
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                  ATTENDANCE_BADGE_CLASS[next.attendance.status]
                }`}
              >
                {ATTENDANCE_LABELS[next.attendance.status]}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700">{next.rehearsal.venueName}</p>
          {next.rehearsal.note && (
            <p className="mt-1 text-sm font-medium text-amber-800">
              {next.rehearsal.note}
            </p>
          )}
        </>
      )}
    </Link>
  );
}
