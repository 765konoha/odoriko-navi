import { Link } from "react-router-dom";
import { useNextRehearsal } from "../../hooks/useNextRehearsal";
import { useNow } from "../../hooks/useNow";
import {
  ATTENDANCE_BADGE_CLASS,
  ATTENDANCE_LABELS,
} from "../../types/rehearsal";
import { rehearsalCountdown, venueMapUrl } from "../../lib/rehearsals";
import { formatDateLabel, formatTime, toDateString } from "../../lib/time";

/**
 * ホームに置く「次のリハ」。
 * 祭りモードの「次の予定」と同じ形にして、
 * いつ・どこ・自分の出欠が一目で分かるようにする。
 */
export default function NextRehearsalCard() {
  const { loading, next } = useNextRehearsal();
  const now = useNow(60_000);

  // 予定が無いときに黒い箱を出すと目立ちすぎるので、案内だけ小さく出す
  if (loading || next == null) {
    return (
      <Link
        to="/rehearsal"
        className="block rounded-2xl bg-white p-4 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-slate-500">🕒 次のリハ</p>
          <span className="ml-auto text-sm font-bold text-blue-700">
            確認する ›
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {loading ? "読み込み中…" : "予定されているリハはありません。"}
        </p>
      </Link>
    );
  }

  const { rehearsal, attendance, festivalName } = next;
  const countdown = rehearsalCountdown(rehearsal, now);

  return (
    <section className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg">
      <p className="text-sm font-medium text-slate-300">次のリハ</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <span className="text-2xl font-bold">
          {formatDateLabel(toDateString(rehearsal.startsAt))}
        </span>
        <span className="text-4xl font-bold tabular-nums">
          {formatTime(rehearsal.startsAt)}
        </span>
        {rehearsal.endsAt && (
          <span className="text-lg font-medium text-slate-300">
            〜{formatTime(rehearsal.endsAt)}
          </span>
        )}
      </div>

      <p className="mt-1 text-lg font-medium">{rehearsal.venueName}</p>

      <div className="mt-3 space-y-1 text-sm text-slate-200">
        {festivalName && <p>{festivalName}</p>}
        {rehearsal.title.trim() !== "" && <p>内容:{rehearsal.title}</p>}
        {rehearsal.venueAddress && <p>{rehearsal.venueAddress}</p>}
        {rehearsal.note && (
          <p className="font-medium text-amber-300">⚠ {rehearsal.note}</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-slate-300">自分の出欠</span>
        {attendance ? (
          <span
            className={`rounded px-2 py-0.5 text-xs font-bold ${
              ATTENDANCE_BADGE_CLASS[attendance.status]
            }`}
          >
            {ATTENDANCE_LABELS[attendance.status]}
            {attendance.timeNote && ` ${attendance.timeNote}`}
          </span>
        ) : (
          <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-bold text-slate-200">
            未回答
          </span>
        )}
      </div>

      {countdown && (
        <p className="mt-4 text-xl font-bold text-amber-300">{countdown}</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2">
        <a
          href={venueMapUrl(rehearsal)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-white py-3 text-center text-base font-bold text-slate-900"
        >
          地図を見る
        </a>
        <Link
          to="/rehearsal"
          className="rounded-xl border border-slate-500 py-3 text-center text-base font-bold text-white"
        >
          リハ予定を見る
        </Link>
      </div>
    </section>
  );
}
