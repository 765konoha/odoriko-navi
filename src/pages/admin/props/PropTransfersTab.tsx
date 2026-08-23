import { useMemo, useState, type FormEvent } from "react";
import type { PropsAdminData } from "./PropsAdminPage";
import type { PropTransfer } from "../../../types/props";
import { BLOCKED_CONDITIONS } from "../../../types/props";
import { createTransfer, serialLabel } from "../../../lib/props";
import { cancelTransfer } from "../../../lib/propsAdminApi";
import { formatTime, toDateString } from "../../../lib/time";

const STATUS_LABELS: Record<PropTransfer["status"], string> = {
  pending: "受取待ち",
  completed: "完了",
  cancelled: "キャンセル",
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

export default function PropTransfersTab({ data }: { data: PropsAdminData }) {
  const [itemId, setItemId] = useState("");
  const [toSerial, setToSerial] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const pendingItemIds = useMemo(
    () =>
      new Set(
        data.transfers.filter((t) => t.status === "pending").map((t) => t.propItemId),
      ),
    [data.transfers],
  );

  // 受け渡しを開始できる小道具(保有者が設定済み・紛失/使用停止でない・pendingなし)
  const transferable = data.items.filter(
    (i) =>
      !i.isArchived &&
      i.currentHolderSerial &&
      !BLOCKED_CONDITIONS.includes(i.condition) &&
      !pendingItemIds.has(i.id),
  );
  const selected = data.items.find((i) => i.id === itemId) ?? null;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!selected?.currentHolderSerial) return;
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      // 受け渡しは常に現在の保有者からの移動として作成する
      await createTransfer(
        selected.id,
        selected.currentHolderSerial,
        toSerial,
        note.trim() || undefined,
      );
      setItemId("");
      setToSerial("");
      setNote("");
      setFlash("受け渡し予定を作成しました。");
      await data.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(transfer: PropTransfer) {
    const item = data.items.find((i) => i.id === transfer.propItemId);
    if (
      !window.confirm(
        `${item?.displayName ?? "この小道具"}の受け渡し予定をキャンセルしますか?`,
      )
    )
      return;
    setError(null);
    try {
      await cancelTransfer(transfer);
      await data.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "キャンセルに失敗しました");
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
      >
        <h2 className="text-base font-bold text-slate-800">
          受け渡し予定を作成
        </h2>
        <label className="block">
          <span className={labelClass}>小道具</span>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">選択してください</option>
            {transferable.map((i) => (
              <option key={i.id} value={i.id}>
                {i.displayName}({serialLabel(i.currentHolderSerial, data.names)}
                )
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            保有者未設定・紛失・使用停止・受け渡し予定ありの小道具は選べません。
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>受け渡し先</span>
          <select
            value={toSerial}
            onChange={(e) => setToSerial(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">選択してください</option>
            {data.serials
              .filter((s) => s !== selected?.currentHolderSerial)
              .map((s) => (
                <option key={s} value={s}>
                  {serialLabel(s, data.names)}
                </option>
              ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>メモ(任意)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
            placeholder="例: 自前のたすきを使う場合は要相談"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {flash && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {flash}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !itemId || !toSerial}
          className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-40"
        >
          {saving ? "作成中…" : "受け渡し予定を作成"}
        </button>
      </form>

      <div className="space-y-2">
        {data.transfers.map((t) => {
          const item = data.items.find((i) => i.id === t.propItemId);
          return (
            <div key={t.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    t.status === "pending"
                      ? "bg-blue-100 text-blue-700"
                      : t.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {STATUS_LABELS[t.status]}
                </span>
                <span className="ml-auto text-xs tabular-nums text-slate-500">
                  {toDateString(t.createdAt).slice(5).replace("-", "/")}{" "}
                  {formatTime(t.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-base font-bold text-slate-900">
                {item?.displayName ?? "(不明な小道具)"}
              </p>
              <p className="text-sm text-slate-600">
                {serialLabel(t.fromSerial, data.names)} →{" "}
                {serialLabel(t.toSerial, data.names)}
              </p>
              {t.cancelledReason && (
                <p className="text-xs text-slate-500">{t.cancelledReason}</p>
              )}
              {t.status === "pending" && (
                <button
                  type="button"
                  onClick={() => void handleCancel(t)}
                  className="mt-2 text-sm font-bold text-red-600"
                >
                  キャンセル
                </button>
              )}
            </div>
          );
        })}
        {data.transfers.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            受け渡しの記録はまだありません。
          </p>
        )}
      </div>
    </div>
  );
}
