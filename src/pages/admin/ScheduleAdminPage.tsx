import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import type {
  FestivalDay,
  Location,
  ScheduleCategory,
  ScheduleItem,
} from "../../types/domain";
import {
  createDay,
  createScheduleItem,
  deleteDay,
  deleteScheduleItem,
  listDays,
  listLocations,
  listScheduleItems,
  updateScheduleItem,
  type ScheduleItemInput,
} from "../../lib/adminApi";
import { formatDateLabel, formatTime, jstToIso, todayString } from "../../lib/time";
import { CATEGORY_META } from "../../lib/schedule";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

const CATEGORY_OPTIONS: ScheduleCategory[] = [
  "performance",
  "gather",
  "practice",
  "move",
  "break",
  "dismiss",
  "other",
];

interface FormState {
  title: string;
  category: ScheduleCategory;
  gatherTime: string;
  startTime: string;
  endTime: string;
  venueName: string;
  meetingLocationId: string;
  notes: string;
  isConfirmed: boolean;
  tbdNote: string;
  isCancelled: boolean;
  sortOrder: number;
}

function toFormState(item: ScheduleItem | null, nextSortOrder: number): FormState {
  return {
    title: item?.title ?? "",
    category: item?.category ?? "performance",
    gatherTime: item?.gatherTime ? formatTime(item.gatherTime) : "",
    startTime: item?.startTime ? formatTime(item.startTime) : "",
    endTime: item?.endTime ? formatTime(item.endTime) : "",
    venueName: item?.venueName ?? "",
    meetingLocationId: item?.meetingLocationId ?? "",
    notes: item?.notes ?? "",
    isConfirmed: item?.isConfirmed ?? true,
    tbdNote: item?.tbdNote ?? "",
    isCancelled: item?.isCancelled ?? false,
    sortOrder: item?.sortOrder ?? nextSortOrder,
  };
}

function ItemForm({
  day,
  item,
  locations,
  nextSortOrder,
  onSaved,
  onCancel,
}: {
  day: FestivalDay;
  item: ScheduleItem | null;
  locations: Location[];
  nextSortOrder: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    toFormState(item, nextSortOrder),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meetingPoints = locations.filter((l) => l.kind === "meeting_point");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: ScheduleItemInput = {
      festivalDayId: day.id,
      title: form.title.trim(),
      category: form.category,
      gatherTime: jstToIso(day.date, form.gatherTime),
      startTime: jstToIso(day.date, form.startTime),
      endTime: jstToIso(day.date, form.endTime),
      venueName: form.venueName.trim() || null,
      meetingLocationId: form.meetingLocationId || null,
      notes: form.notes.trim() || null,
      isConfirmed: form.isConfirmed,
      tbdNote: form.isConfirmed ? null : form.tbdNote.trim() || null,
      isCancelled: form.isCancelled,
      sortOrder: form.sortOrder,
    };
    try {
      if (item) {
        await updateScheduleItem(item.id, input);
      } else {
        await createScheduleItem(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">
        {item ? "予定を編集" : "予定を追加"}(
        {formatDateLabel(day.date)})
      </h2>

      <label className="block">
        <span className={labelClass}>タイトル *</span>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
          className={inputClass}
          placeholder="例: 追手筋本部競演場"
        />
      </label>

      <label className="block">
        <span className={labelClass}>種別</span>
        <select
          value={form.category}
          onChange={(e) => set("category", e.target.value as ScheduleCategory)}
          className={inputClass}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className={labelClass}>集合</span>
          <input
            type="time"
            value={form.gatherTime}
            onChange={(e) => set("gatherTime", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>開始/演舞</span>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => set("startTime", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>終了</span>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => set("endTime", e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>会場名</span>
        <input
          value={form.venueName}
          onChange={(e) => set("venueName", e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>集合場所</span>
        <select
          value={form.meetingLocationId}
          onChange={(e) => set("meetingLocationId", e.target.value)}
          className={inputClass}
        >
          <option value="">(なし)</option>
          {meetingPoints.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>注意事項</span>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className={inputClass}
        />
      </label>

      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!form.isConfirmed}
            onChange={(e) => set("isConfirmed", !e.target.checked)}
            className="h-5 w-5"
          />
          <span className="text-base">未確定</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isCancelled}
            onChange={(e) => set("isCancelled", e.target.checked)}
            className="h-5 w-5"
          />
          <span className="text-base">中止</span>
        </label>
      </div>

      {!form.isConfirmed && (
        <label className="block">
          <span className={labelClass}>未確定の補足(踊り子に表示)</span>
          <input
            value={form.tbdNote}
            onChange={(e) => set("tbdNote", e.target.value)}
            className={inputClass}
            placeholder="例: 17:30頃予定・当日連絡・演舞15分前集合"
          />
        </label>
      )}

      <label className="block">
        <span className={labelClass}>表示順(小さいほど上)</span>
        <input
          type="number"
          value={form.sortOrder}
          onChange={(e) => set("sortOrder", Number(e.target.value))}
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
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-600"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

export default function ScheduleAdminPage() {
  const { festival } = useAdminFestival();
  const [days, setDays] = useState<FestivalDay[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [currentDayId, setCurrentDayId] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; item: ScheduleItem } | null
  >(null);
  const [showDayManager, setShowDayManager] = useState(false);
  const [newDayDate, setNewDayDate] = useState("");
  const [newDayLabel, setNewDayLabel] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!festival) return;
    setLoading(true);
    const [dayList, locationList] = await Promise.all([
      listDays(festival.id),
      listLocations(festival.id),
    ]);
    const itemList = await listScheduleItems(dayList.map((d) => d.id));
    setDays(dayList);
    setLocations(locationList);
    setItems(itemList);
    setLoading(false);
  }, [festival]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!festival) return null;
  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  const currentDay =
    days.find((d) => d.id === currentDayId) ??
    days.find((d) => d.date === todayString()) ??
    days[0] ??
    null;
  const dayItems = items
    .filter((i) => i.festivalDayId === currentDay?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const nextSortOrder =
    dayItems.length > 0 ? Math.max(...dayItems.map((i) => i.sortOrder)) + 1 : 1;

  async function handleDelete(item: ScheduleItem) {
    if (!window.confirm(`「${item.title}」を削除しますか?`)) return;
    await deleteScheduleItem(item.id);
    await load();
  }

  async function handleAddDay(e: FormEvent) {
    e.preventDefault();
    if (!newDayDate || !festival) return;
    await createDay(festival.id, newDayDate, newDayLabel.trim() || null);
    setNewDayDate("");
    setNewDayLabel("");
    await load();
  }

  async function handleDeleteDay(day: FestivalDay) {
    const count = items.filter((i) => i.festivalDayId === day.id).length;
    if (
      !window.confirm(
        `${formatDateLabel(day.date)}を削除しますか?(予定${count}件も削除されます)`,
      )
    )
      return;
    await deleteDay(day.id);
    setCurrentDayId(null);
    await load();
  }

  if (editing && currentDay) {
    return (
      <ItemForm
        day={currentDay}
        item={editing.mode === "edit" ? editing.item : null}
        locations={locations}
        nextSortOrder={nextSortOrder}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-lg font-bold text-slate-800">スケジュール管理</h1>
        <button
          type="button"
          onClick={() => setShowDayManager((v) => !v)}
          className="ml-auto text-sm font-bold text-blue-700"
        >
          開催日を管理
        </button>
      </div>

      {showDayManager && (
        <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
          {days.map((day) => (
            <div key={day.id} className="flex items-center gap-2">
              <span className="text-base">
                {formatDateLabel(day.date)} {day.label}
              </span>
              <button
                type="button"
                onClick={() => void handleDeleteDay(day)}
                className="ml-auto text-sm font-bold text-red-600"
              >
                削除
              </button>
            </div>
          ))}
          <form onSubmit={handleAddDay} className="flex items-end gap-2 pt-2">
            <label className="block flex-1">
              <span className={labelClass}>日付</span>
              <input
                type="date"
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            <label className="block flex-1">
              <span className={labelClass}>名称</span>
              <input
                value={newDayLabel}
                onChange={(e) => setNewDayLabel(e.target.value)}
                placeholder="本祭1日目"
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white"
            >
              追加
            </button>
          </form>
        </div>
      )}

      {days.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          「開催日を管理」から開催日を追加してください。
        </p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {days.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => setCurrentDayId(day.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                  day.id === currentDay?.id
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600"
                }`}
              >
                {formatDateLabel(day.date)}
                {day.label ? ` ${day.label}` : ""}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setEditing({ mode: "new" })}
            className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
          >
            + 予定を追加
          </button>

          <div className="space-y-2">
            {dayItems.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${CATEGORY_META[item.category].badgeClass}`}
                  >
                    {CATEGORY_META[item.category].label}
                  </span>
                  {item.isCancelled && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      中止
                    </span>
                  )}
                  {!item.isConfirmed && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                      未確定
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-400">
                    順:{item.sortOrder}
                  </span>
                </div>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {item.title}
                </p>
                <p className="text-sm text-slate-600">
                  {item.gatherTime && `集合 ${formatTime(item.gatherTime)} `}
                  {item.startTime && `開始 ${formatTime(item.startTime)}`}
                  {item.endTime && `〜${formatTime(item.endTime)}`}
                </p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", item })}
                    className="text-sm font-bold text-blue-700"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    className="text-sm font-bold text-red-600"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
