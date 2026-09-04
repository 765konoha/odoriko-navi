import { useCallback, useEffect, useState } from "react";
import { useUser } from "../../context/UserContext";
import { useUserSelect } from "../../hooks/useUserSelect";
import { useNow } from "../../hooks/useNow";
import { useSheetAutoRefresh } from "../../hooks/useSheetAutoRefresh";
import {
  isPastRehearsal,
  loadRehearsalBoard,
  venueMapUrl,
  type RehearsalBoard,
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
  festivalName,
  attendance,
  past,
  all,
  nameBySerial,
}: {
  rehearsal: Rehearsal;
  festivalName: string | null;
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
      {festivalName && (
        <p className="mt-0.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
          {festivalName}
        </p>
      )}
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
  const { selection } = useUser();
  const { requestChange } = useUserSelect();
  const now = useNow(60_000);
  const serial = selection?.serial ?? null;

  const [board, setBoard] = useState<RehearsalBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadRehearsalBoard(serial);
        if (!cancelled) setBoard(loaded);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "読み込みに失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serial, reloadKey]);

  const rehearsals = board?.rehearsals ?? null;
  const upcoming = (rehearsals ?? []).filter((r) => !isPastRehearsal(r, now));
  const past = (rehearsals ?? []).filter((r) => isPastRehearsal(r, now));

  // シートと同期している祭りなら、画面を開いたときに古ければ読み直す。
  // これから先のリハがある祭りだけを見る(終わった祭りは読み直しても変わらない)
  const activeFestivalIds = [...new Set(upcoming.map((r) => r.festivalId))];
  const { refreshing } = useSheetAutoRefresh(activeFestivalIds, reload);

  const byRehearsal = new Map<string, Attendance[]>();
  for (const a of board?.all ?? []) {
    byRehearsal.set(a.rehearsalId, [...(byRehearsal.get(a.rehearsalId) ?? []), a]);
  }

  function cardProps(r: Rehearsal) {
    return {
      rehearsal: r,
      festivalName: board?.festivalNameById.get(r.festivalId) ?? null,
      attendance: board?.mine.get(r.id),
      all: byRehearsal.get(r.id) ?? [],
      // 未回答が誰かは祭りごとの名簿で決まる
      nameBySerial: board?.rosterByFestival.get(r.festivalId) ?? new Map(),
    };
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-xl font-bold">リハ予定</h1>

      <p className="text-sm text-slate-500">
        参加している祭りのリハを、祭りをまたいでまとめて表示しています。
      </p>

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

      {refreshing && (
        <p className="text-center text-xs text-slate-500">
          最新の出欠を取得しています…
        </p>
      )}

      {rehearsals != null && rehearsals.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          {board?.filteredBySerial
            ? "参加しているお祭りのリハは登録されていません。"
            : "リハの予定はまだ登録されていません。"}
        </p>
      )}

      <div className="space-y-2">
        {upcoming.map((r) => (
          <RehearsalCard key={r.id} {...cardProps(r)} past={false} />
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
                <RehearsalCard key={r.id} {...cardProps(r)} past />
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
