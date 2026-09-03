import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminFestival } from "../../../context/AdminFestivalContext";
import { listParticipants } from "../../../lib/adminApi";
import {
  deleteRehearsal,
  listAttendances,
  listRehearsalsForAdmin,
} from "../../../lib/rehearsalsAdminApi";
import {
  isPastRehearsal,
  rehearsalLabel,
  venueMapUrl,
} from "../../../lib/rehearsals";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_ORDER,
  type Attendance,
  type Rehearsal,
} from "../../../types/rehearsal";
import type { FestivalParticipant } from "../../../types/domain";
import { formatDateLabel, formatTime, toDateString } from "../../../lib/time";
import { compareSerial } from "../../../lib/audience";
import RehearsalForm from "./RehearsalForm";
import AttendanceImport from "./AttendanceImport";
import RehearsalNoteImport from "./RehearsalNoteImport";

export default function RehearsalAdminPage() {
  const { festival } = useAdminFestival();
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [participants, setParticipants] = useState<FestivalParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; rehearsal: Rehearsal } | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [noteImporting, setNoteImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const festivalId = festival?.id ?? null;

  const load = useCallback(async () => {
    if (!festivalId) return;
    const [list, people] = await Promise.all([
      listRehearsalsForAdmin(festivalId),
      listParticipants(festivalId),
    ]);
    setRehearsals(list);
    setParticipants(people);
    setAttendances(await listAttendances(list.map((r) => r.id)));
    setLoading(false);
  }, [festivalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const serials = useMemo(
    () => new Set(participants.map((p) => p.serial)),
    [participants],
  );
  const nameBySerial = useMemo(
    () => new Map(participants.map((p) => [p.serial, p.nickname || p.name])),
    [participants],
  );

  if (!festival) return null;

  if (editing) {
    return (
      <RehearsalForm
        festivalId={festival.id}
        rehearsal={editing.mode === "edit" ? editing.rehearsal : null}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  async function handleDelete(rehearsal: Rehearsal) {
    if (
      !window.confirm(
        `「${rehearsalLabel(rehearsal)}」を削除しますか?\n\n取り込んだ出欠も一緒に消えます。`,
      )
    )
      return;
    await deleteRehearsal(rehearsal.id);
    await load();
  }

  const now = new Date();

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setEditing({ mode: "new" })}
        className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
      >
        + リハを追加
      </button>

      <button
        type="button"
        onClick={() => setNoteImporting((v) => !v)}
        className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-600"
      >
        {noteImporting
          ? "ノートからの読み取りを閉じる"
          : "LINEのノートを貼り付けてリハを登録"}
      </button>

      {noteImporting && (
        <RehearsalNoteImport
          festivalId={festival.id}
          rehearsals={rehearsals}
          onDone={() => void load()}
        />
      )}

      <button
        type="button"
        onClick={() => setImporting((v) => !v)}
        className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-600"
      >
        {importing ? "出欠の取り込みを閉じる" : "出欠を貼り付けて取り込む"}
      </button>

      {importing && (
        <AttendanceImport
          rehearsals={rehearsals}
          serials={serials}
          onDone={() => void load()}
        />
      )}

      {loading && <p className="py-8 text-center text-slate-500">読み込み中…</p>}

      {!loading && rehearsals.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          リハがまだ登録されていません。
        </p>
      )}

      <div className="space-y-2">
        {rehearsals.map((r) => {
          const rows = attendances.filter((a) => a.rehearsalId === r.id);
          const byStatus = new Map(
            ATTENDANCE_ORDER.map((s) => [
              s,
              rows.filter((a) => a.status === s),
            ]),
          );
          const answered = new Set(rows.map((a) => a.serial));
          const noAnswer = participants
            .filter((p) => !answered.has(p.serial))
            .sort((a, b) => compareSerial(a.serial, b.serial));
          const open = openId === r.id;

          return (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-base font-bold text-slate-900">
                  {formatDateLabel(toDateString(r.startsAt))}{" "}
                  {formatTime(r.startsAt)}
                  {r.endsAt && `〜${formatTime(r.endsAt)}`}
                </p>
                {r.isCancelled && (
                  <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                    中止
                  </span>
                )}
                {!r.isCancelled && isPastRehearsal(r, now) && (
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                    終了
                  </span>
                )}
              </div>
              <p className="text-base font-bold text-slate-800">
                {rehearsalLabel(r)}
              </p>
              {/* 目的が無いときは会場名が見出しになるので、繰り返さない */}
              {r.title.trim() !== "" && (
                <p className="text-sm text-slate-600">{r.venueName}</p>
              )}
              {r.note && (
                <p className="text-sm font-medium text-amber-800">{r.note}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {ATTENDANCE_ORDER.map((s) => (
                  <span key={s} className="text-slate-600">
                    {ATTENDANCE_LABELS[s]}{" "}
                    <span className="font-bold tabular-nums text-slate-900">
                      {byStatus.get(s)?.length ?? 0}
                    </span>
                  </span>
                ))}
                <span
                  className={
                    noAnswer.length > 0
                      ? "font-bold text-amber-700"
                      : "text-slate-600"
                  }
                >
                  未回答{" "}
                  <span className="tabular-nums">{noAnswer.length}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.id)}
                className="mt-2 text-sm font-bold text-blue-700"
              >
                {open ? "内訳を閉じる" : "内訳を見る"}
              </button>

              {open && (
                <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                  {ATTENDANCE_ORDER.map((s) => {
                    const list = (byStatus.get(s) ?? []).sort((a, b) =>
                      compareSerial(a.serial, b.serial),
                    );
                    if (list.length === 0) return null;
                    return (
                      <div key={s}>
                        <p className="text-xs font-bold text-slate-500">
                          {ATTENDANCE_LABELS[s]}({list.length})
                        </p>
                        <p className="text-slate-700">
                          {list
                            .map(
                              (a) =>
                                `${nameBySerial.get(a.serial) ?? a.serial}` +
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
                          .map((p) => p.nickname || p.name)
                          .join("、")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditing({ mode: "edit", rehearsal: r })}
                  className="text-sm font-bold text-blue-700"
                >
                  編集
                </button>
                <a
                  href={venueMapUrl(r)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-bold text-blue-700"
                >
                  地図
                </a>
                <button
                  type="button"
                  onClick={() => void handleDelete(r)}
                  className="text-sm font-bold text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
