import { useCallback, useEffect, useState } from "react";
import {
  deleteSheetSync,
  getSheetSync,
  parseSheetUrl,
  runSheetSync,
  saveSheetSync,
  type SheetSync,
} from "../../../lib/rehearsalsAdminApi";
import { formatDateLabel, formatTime, toDateString } from "../../../lib/time";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

/** 出欠シートとの同期設定。シートのURLはここでだけ扱う。 */
export default function SheetSyncPanel({
  festivalId,
  onSynced,
}: {
  festivalId: string;
  onSynced: () => void;
}) {
  const [sync, setSync] = useState<SheetSync | null>(null);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await getSheetSync(festivalId);
    setSync(s);
    if (s) {
      setUrl(
        `https://docs.google.com/spreadsheets/d/${s.sheetId}/edit` +
          (s.gid ? `#gid=${s.gid}` : ""),
      );
      setEnabled(s.enabled);
    }
  }, [festivalId]);

  useEffect(() => {
    void load().catch(() => setError("設定の読み込みに失敗しました"));
  }, [load]);

  async function handleSave() {
    const parsed = parseSheetUrl(url);
    if (!parsed) {
      setError("スプレッドシートのURLを貼り付けてください。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await saveSheetSync(festivalId, parsed.sheetId, parsed.gid, enabled);
      await load();
      setMessage("保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await runSheetSync(festivalId);
      setMessage(result);
      await load();
      onSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : "同期に失敗しました");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("シートとの同期設定を削除しますか?")) return;
    setBusy(true);
    try {
      await deleteSheetSync(festivalId);
      setSync(null);
      setUrl("");
      setMessage("設定を削除しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">
        出欠シートと同期する
      </h2>
      <p className="text-xs leading-relaxed text-slate-500">
        エントリーフォームの回答シートを読みに行き、出欠を反映します。
        見出しの月日から対応するリハを自動で選ぶので、貼り付けは不要です。
        誰かがリハ画面を開いたときに、前回の更新から30分以上たっていれば
        読み直します。シートは「リンクを知っている全員が閲覧可」に
        しておいてください。
      </p>

      <label className="block">
        <span className={labelClass}>スプレッドシートのURL</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
          className={`${inputClass} text-xs`}
          inputMode="url"
        />
        <span className="mt-1 block text-xs text-slate-500">
          取り込みたいタブを開いた状態のURLを貼ってください。
          URLに #gid= が含まれていればそのタブを、無ければ先頭のタブを読みます。
        </span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="text-base font-medium">
          リハ画面を開いたときに自動で更新する
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
        >
          保存
        </button>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={busy || sync == null}
          className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
        >
          {busy ? "実行中…" : "今すぐ同期"}
        </button>
      </div>

      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {sync?.lastSyncedAt && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <p className="font-bold text-slate-600">
            最終同期 {formatDateLabel(toDateString(sync.lastSyncedAt))}{" "}
            {formatTime(sync.lastSyncedAt)}
          </p>
          <p className={sync.lastOk === false ? "text-red-700" : "text-slate-600"}>
            {sync.lastResult}
          </p>
        </div>
      )}

      {sync && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="text-xs font-bold text-red-600"
        >
          同期設定を削除する
        </button>
      )}
    </div>
  );
}
