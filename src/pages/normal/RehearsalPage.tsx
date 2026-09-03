import { useEffect, useState } from "react";
import { useFestivalData } from "../../context/FestivalDataContext";
import { useUser } from "../../context/UserContext";
import { useUserSelect } from "../../hooks/useUserSelect";
import { useNow } from "../../hooks/useNow";
import {
  isPastRehearsal,
  listAllAttendances,
  listMyAttendances,
  listRehearsals,
  venueMapUrl,
} from "../../lib/rehearsals";
import {
  ATTENDANCE_BADGE_CLASS,
  ATTENDANCE_LABELS,
  ATTENDANCE_ORDER,
} from "../../types/rehearsal";
import type {
  Attendance,
  AttendanceStatus,
  Rehearsal,
} from "../../types/rehearsal";
import { formatDateLabel, formatTime, toDateString } from "../../lib/time";
import { compareSerial } from "../../lib/audience";

/**
 * 当日その場にいない人の一覧。
 * 立ち位置の空きを確認するために、参加以外の人を名前で出す。
 */
function AttendanceBreakdown({
  attendances,
  nameBySerial,
}: {
  attendances: Attendance[];
  nameBySerial: Map<string, string>;
}) {
  const total = nameBySerial.size;
  const answered = new Set(attendances.map((a) => a.serial));
  const noAnswer = [...nameBySerial.keys()].filter((x) => !answered.has(x));
  const byStatus = new Map<AttendanceStatus, Attendance[]>();
  for (const a of attendances) {
    byStatus.set(a.status, [...(byStatus.get(a.status) ?? []), a]);
  }
  const present = byStatus.get("present")?.length ?? 0;

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
      <p className="text-xs text-slate-500">
        参加 {present} / {total}人
      </p>
      {ATTENDANCE_ORDER.filter((st) => st !== "present").map((st) => {
        const list = (byStatus.get(st) ?? []).sort((a, b) =>
          compareSerial(a.serial, b.serial),
        );
        if (list.length === 0) return null;
        return (
          <div key={st}>
            <p className="text-xs font-bold text-slate-500">
              {ATTENDANCE_LABELS[st]}({list.length})
            </p>
            <p className="text-slate-700">
              {list
                .map(
                  (a) =>
                    (nameBySerial.get(a.serial) ?? a.serial) +
                    (a.timeNote ? `(${a.timeNote})` : ""),
                )
                .join("、")}
            </p>
          </div>
        );
      })}
      {noAnswer.length > 0 && (
        <div>
          <p className="text-xs font-bold text-amber-700">
            未回答({noAnswer.length})
          </p>
          <p className="text-slate-700">
            {noAnswer
              .sort(compareSerial)
              .map((x) => nameBySerial.get(x) ?? x)
              .join("、")}
          </p>
        </div>
      )}
      {byStatus.size <= 1 && noAnswer.length === 0 && (
        <p className="text-slate-600">全員が参加で回答しています。</p>
      )}
    </div>
  );
}

function RehearsalCard({
  rehearsal,
  attendance,
  past,
  all,
  nameBySerial,
}: {
  rehearsal: Rehearsal;
  attendance: Attendance | undefined;
  past: boolean;
  all: Attendance[];
  nameBySerial: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
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
                ATTENDANCE_BADGE_CLASS[attendance.status]
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

      {!rehearsal.isCancelled && nameBySerial.size > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 text-sm font-bold text-blue-700"
          >
            {open ? "みんなの出欠を閉じる" : "みんなの出欠を見る"}
          </button>
          {open && (
            <AttendanceBreakdown
              attendances={all}
              nameBySerial={nameBySerial}
            />
          )}
        </>
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
  const [all, setAll] = useState<Attendance[]>([]);
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
        const everyone = await listAllAttendances(list.map((r) => r.id));
        if (cancelled) return;
        setAll(everyone);
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

  // 名前は祭りの参加者から引く(ニックネームがあればそちらを使う)
  const nameBySerial = new Map(
    (data?.participants ?? []).map((p) => [p.serial, p.nickname || p.name]),
  );
  const byRehearsal = new Map<string, Attendance[]>();
  for (const a of all) {
    byRehearsal.set(a.rehearsalId, [...(byRehearsal.get(a.rehearsalId) ?? []), a]);
  }

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
            all={byRehearsal.get(r.id) ?? []}
            nameBySerial={nameBySerial}
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
                  all={byRehearsal.get(r.id) ?? []}
                  nameBySerial={nameBySerial}
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
