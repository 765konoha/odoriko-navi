import { useState, type FormEvent } from "react";
import type { Rehearsal } from "../../../types/rehearsal";
import {
  createRehearsal,
  updateRehearsal,
  type RehearsalInput,
} from "../../../lib/rehearsalsAdminApi";
import { formatTime, jstToIso, toDateString } from "../../../lib/time";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

export default function RehearsalForm({
  festivalId,
  rehearsal,
  onSaved,
  onCancel,
}: {
  festivalId: string;
  rehearsal: Rehearsal | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(rehearsal?.title ?? "");
  const [date, setDate] = useState(
    rehearsal ? toDateString(rehearsal.startsAt) : "",
  );
  const [start, setStart] = useState(
    rehearsal ? formatTime(rehearsal.startsAt) : "",
  );
  const [end, setEnd] = useState(
    rehearsal?.endsAt ? formatTime(rehearsal.endsAt) : "",
  );
  const [venueName, setVenueName] = useState(rehearsal?.venueName ?? "");
  const [venueUrl, setVenueUrl] = useState(rehearsal?.venueUrl ?? "");
  const [venueAddress, setVenueAddress] = useState(
    rehearsal?.venueAddress ?? "",
  );
  const [note, setNote] = useState(rehearsal?.note ?? "");
  const [isCancelled, setIsCancelled] = useState(rehearsal?.isCancelled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const startsAt = jstToIso(date, start);
    if (!startsAt) {
      setError("日付と開始時刻を入れてください");
      return;
    }
    setSaving(true);
    setError(null);
    const input: RehearsalInput = {
      festivalId,
      title: title.trim(),
      startsAt,
      endsAt: end ? jstToIso(date, end) : null,
      venueName: venueName.trim(),
      venueUrl: venueUrl.trim() || null,
      venueAddress: venueAddress.trim() || null,
      note: note.trim() || null,
      isCancelled,
    };
    try {
      if (rehearsal) await updateRehearsal(rehearsal.id, input);
      else await createRehearsal(input);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-bold text-slate-800">
        {rehearsal ? "リハを編集" : "リハを追加"}
      </h2>

      <label className="block">
        <span className={labelClass}>目的・内容 *</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
          placeholder="踊りこみ、固め"
        />
      </label>

      <label className="block">
        <span className={labelClass}>日付 *</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>開始 *</span>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>終了(任意)</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>会場名 *</span>
        <input
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          required
          className={inputClass}
          placeholder="ミハタホール(八幡山)"
        />
      </label>

      <label className="block">
        <span className={labelClass}>会場のURL(任意)</span>
        <input
          value={venueUrl}
          onChange={(e) => setVenueUrl(e.target.value)}
          className={inputClass}
          placeholder="https://..."
          inputMode="url"
        />
      </label>

      <label className="block">
        <span className={labelClass}>住所(任意)</span>
        <input
          value={venueAddress}
          onChange={(e) => setVenueAddress(e.target.value)}
          className={inputClass}
          placeholder="世田谷区八幡山..."
        />
        <span className="mt-1 block text-xs text-slate-500">
          地図は会場名と住所での検索で開きます(緯度経度の登録は不要です)。
        </span>
      </label>

      <label className="block">
        <span className={labelClass}>特記事項(任意)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
          placeholder="※17時過ぎから本番なので早めに終わる"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isCancelled}
          onChange={(e) => setIsCancelled(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="text-base font-medium">中止にする</span>
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
          className="flex-1 rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-40"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-600"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
