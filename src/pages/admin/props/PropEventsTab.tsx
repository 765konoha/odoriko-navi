import { useEffect, useState, type FormEvent } from "react";
import type { PropsAdminData } from "./PropsAdminPage";
import type { PropAssignment, PropEvent, PropEventKind } from "../../../types/props";
import { PROP_EVENT_KINDS } from "../../../types/props";
import { listAssignments, serialLabel } from "../../../lib/props";
import {
  createPropEvent,
  deletePropEvent,
  setAssignment,
} from "../../../lib/propsAdminApi";
import { listFestivals, listParticipants } from "../../../lib/adminApi";
import type { Festival, FestivalParticipant } from "../../../types/domain";
import { compareSerial } from "../../../lib/audience";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

/** イベントごとの使用予定者(現在の保有者とは独立して設定する) */
function AssignmentEditor({
  data,
  event,
}: {
  data: PropsAdminData;
  event: PropEvent;
}) {
  const [assignments, setAssignments] = useState<PropAssignment[]>([]);
  const [participants, setParticipants] = useState<FestivalParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const list = await listAssignments(event.id);
      // 祭りイベントの場合は、その祭りの参加者から使用者を選ぶ
      const people = event.festivalId
        ? await listParticipants(event.festivalId)
        : [];
      if (!cancelled) {
        setAssignments(list);
        setParticipants(people);
        setLoading(false);
      }
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [event.id, event.festivalId]);

  async function handleChange(propItemId: string, serial: string) {
    const previous =
      assignments.find((a) => a.propItemId === propItemId)?.userSerial ?? null;
    setError(null);
    try {
      await setAssignment(event.id, propItemId, serial || null, previous);
      setAssignments(await listAssignments(event.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  }

  const options = event.festivalId
    ? [...participants]
        .sort((a, b) => compareSerial(a.serial, b.serial))
        .map((p) => p.serial)
    : data.serials;

  if (loading) {
    return <p className="py-3 text-sm text-slate-500">読み込み中…</p>;
  }

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <p className="text-sm font-bold text-slate-700">使用予定者</p>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {data.items
        .filter((i) => !i.isArchived)
        .map((item) => {
          const current =
            assignments.find((a) => a.propItemId === item.id)?.userSerial ?? "";
          return (
            <div key={item.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                {item.displayName}
              </span>
              <select
                value={current}
                onChange={(e) => void handleChange(item.id, e.target.value)}
                className="w-40 shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">未定</option>
                {options.map((s) => (
                  <option key={s} value={s}>
                    {serialLabel(s, data.names)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      {data.items.filter((i) => !i.isArchived).length === 0 && (
        <p className="text-sm text-slate-500">小道具が登録されていません。</p>
      )}
    </div>
  );
}

export default function PropEventsTab({ data }: { data: PropsAdminData }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<PropEventKind>("festival");
  const [festivalId, setFestivalId] = useState("");
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [note, setNote] = useState("");
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listFestivals()
      .then(setFestivals)
      .catch(() => setFestivals([]));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createPropEvent({
        kind,
        festivalId: kind === "festival" ? festivalId || null : null,
        name: name.trim(),
        eventDate: eventDate || null,
        note: note.trim() || null,
      });
      setName("");
      setEventDate("");
      setNote("");
      setAdding(false);
      await data.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event: PropEvent) {
    if (
      !window.confirm(
        `「${event.name}」を削除しますか?(使用予定者の設定も削除されます)`,
      )
    )
      return;
    await deletePropEvent(event.id);
    await data.reload();
  }

  return (
    <div className="space-y-3">
      {adding ? (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
        >
          <h2 className="text-base font-bold text-slate-800">イベントを追加</h2>
          <label className="block">
            <span className={labelClass}>種別</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PropEventKind)}
              className={inputClass}
            >
              {PROP_EVENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {kind === "festival" && (
            <label className="block">
              <span className={labelClass}>紐付ける祭り(任意)</span>
              <select
                value={festivalId}
                onChange={(e) => setFestivalId(e.target.value)}
                className={inputClass}
              >
                <option value="">(紐付けない)</option>
                {festivals.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className={labelClass}>名称 *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
              placeholder="例: 8/29-30 原宿"
            />
          </label>
          <label className="block">
            <span className={labelClass}>日付</span>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>備考</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-50"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-600"
            >
              キャンセル
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
        >
          + イベントを追加
        </button>
      )}

      {data.events.map((event) => (
        <section
          key={event.id}
          className="overflow-hidden rounded-2xl bg-white shadow-sm"
        >
          <button
            type="button"
            onClick={() => setOpenId(openId === event.id ? null : event.id)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <span
              className={`text-slate-400 transition-transform ${openId === event.id ? "rotate-90" : ""}`}
            >
              ›
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold text-slate-900">
                {event.name}
              </span>
              <span className="block text-xs text-slate-500">
                {event.eventDate ?? "日付未設定"} ・
                {PROP_EVENT_KINDS.find((k) => k.value === event.kind)?.label}
              </span>
            </span>
          </button>
          {openId === event.id && (
            <div className="px-4 pb-3">
              <AssignmentEditor data={data} event={event} />
              <button
                type="button"
                onClick={() => void handleDelete(event)}
                className="mt-3 w-full rounded-lg border border-red-300 py-2 text-sm font-bold text-red-600"
              >
                このイベントを削除
              </button>
            </div>
          )}
        </section>
      ))}
      {data.events.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
          イベントがまだありません。
        </p>
      )}
    </div>
  );
}
