import { useEffect, useState } from "react";
import { useFestivalData } from "../../context/FestivalDataContext";
import { useUser } from "../../context/UserContext";
import { useUserSelect } from "../../hooks/useUserSelect";
import { useNow } from "../../hooks/useNow";
import {
  isPastRehearsal,
  listMyAttendances,
  listRehearsals,
  venueMapUrl,
} from "../../lib/rehearsals";
import { ATTENDANCE_LABELS } from "../../types/rehearsal";
import type { Attendance, Rehearsal } from "../../types/rehearsal";
import { formatDateLabel, formatTime, toDateString } from "../../lib/time";

/** 出欠のバッジ色(参加=緑、欠席=赤、途中の出入り=橙) */
const STATUS_CLASS: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-800",
  late: "bg-amber-100 text-amber-800",
  leave_early: "bg-amber-100 text-amber-800",
  late_leave_early: "bg-amber-100 text-amber-800",
  absent: "bg-red-100 text-red-700",
};

function RehearsalCard({
  rehearsal,
  attendance,
  past,
}: {
  rehearsal: Rehearsal;
  attendance: Attendance | undefined;
  past: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-sm ${past ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1">
          <span className="text-base font-bold text-slate-900">
            {formatDateLabel(toDateString(rehearsal.startsAt))}{" "}
            {formatTime(rehearsal.startsAt)}
            {rehearsal.endsAt && `〜${formatTime(rehearsal.endsAt)}`}
          </span>
        </p>
        {rehearsal.isCancelled ? (
          <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
            中止
          </span>
        ) : (
          attendance && (
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                STATUS_CLASS[attendance.status] ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {ATTENDANCE_LABELS[attendance.status]}
              {attendance.timeNote && ` ${attendance.timeNote}`}
            </span>
          )
        )}
      </div>

      <p className="mt-1 text-base font-bold text-slate-800">
        {rehearsal.venueName}
      </p>
      {rehearsal.title.trim() !== "" && (
        <p className="text-sm text-slate-600">{rehearsal.title}</p>
      )}
      {rehearsal.venueAddress && (
        <p className="text-xs text-slate-500">{rehearsal.venueAddress}</p>
      )}
      {rehearsal.note && (
        <p className="mt-1 text-sm font-medium text-amber-800">
          {rehearsal.note}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-3">
        <a
          href={venueMapUrl(rehearsal)}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-bold text-blue-700"
        >
          地図で見る
        </a>
        {rehearsal.venueUrl && (
          <a
            href={rehearsal.venueUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold text-blue-700"
          >
            会場のページ
          </a>
        )}
      </div>

      {!rehearsal.isCancelled && !attendance && (
        <p className="mt-2 text-xs text-slate-500">
          出欠は未回答です(エントリーフォームから回答してください)。
        </p>
      )}
    </div>
  );
}

export default function RehearsalPage() {
  const { data } = useFestivalData();
  const { selection } = useUser();
  const { requestChange } = useUserSelect();
  const now = useNow(60_000);
  const festivalId = data?.festival.id ?? null;
  const serial = selection?.serial ?? null;

  const [rehearsals, setRehearsals] = useState<Rehearsal[] | null>(null);
  const [mine, setMine] = useState<Map<string, Attendance>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (!festivalId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listRehearsals(festivalId);
        if (cancelled) return;
        setRehearsals(list);
        if (serial) {
          const map = await listMyAttendances(
            serial,
            list.map((r) => r.id),
          );
          if (!cancelled) setMine(map);
        } else {
          setMine(new Map());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "読み込みに失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [festivalId, serial]);

  const upcoming = (rehearsals ?? []).filter((r) => !isPastRehearsal(r, now));
  const past = (rehearsals ?? []).filter((r) => isPastRehearsal(r, now));

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-xl font-bold">リハ予定</h1>

      {data && (
        <p className="text-sm text-slate-500">{data.festival.name}</p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      {serial == null && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            自分の出欠を表示するにはシリアルの選択が必要です。
          </p>
          <button
            type="button"
            onClick={requestChange}
            className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600"
          >
            シリアルを選択する
          </button>
        </div>
      )}

      {rehearsals == null && !error && (
        <p className="py-4 text-center text-slate-500">読み込み中…</p>
      )}

      {rehearsals != null && rehearsals.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          リハの予定はまだ登録されていません。
        </p>
      )}

      <div className="space-y-2">
        {upcoming.map((r) => (
          <RehearsalCard
            key={r.id}
            rehearsal={r}
            attendance={mine.get(r.id)}
            past={false}
          />
        ))}
      </div>

      {upcoming.length === 0 && past.length > 0 && (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          今後のリハはありません。
        </p>
      )}

      {past.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="w-full py-2 text-sm font-bold text-slate-500"
          >
            終わったリハ({past.length}件){showPast ? " を隠す" : " を見る"}
          </button>
          {showPast && (
            <div className="space-y-2">
              {past.map((r) => (
                <RehearsalCard
                  key={r.id}
                  rehearsal={r}
                  attendance={mine.get(r.id)}
                  past
                />
              ))}
            </div>
          )}
        </section>
      )}

      <p className="pt-2 text-xs leading-relaxed text-slate-500">
        出欠はエントリーフォームの回答をもとに表示しています。
        変更したいときはフォームから回答し直してください(この画面からは変更できません)。
      </p>
    </div>
  );
}
