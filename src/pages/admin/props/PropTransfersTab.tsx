import { useMemo, useState, type FormEvent } from "react";
import type { PropsAdminData } from "./PropsAdminPage";
import type { PropTransfer } from "../../../types/props";
import { BLOCKED_CONDITIONS } from "../../../types/props";
import {
  createTransfer,
  expectedHolder,
  scheduledLabel,
  serialLabel,
  updateTransferSchedule,
} from "../../../lib/props";
import {
  adminCompleteTransfer,
  cancelTransfer,
} from "../../../lib/propsAdminApi";
import { formatTime, jstToIso, toDateString } from "../../../lib/time";

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
  const [scheduledDate, setScheduledDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // 登録済みの予定日を後から入れ直す
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = useMemo(
    () => data.transfers.filter((t) => t.status === "pending"),
    [data.transfers],
  );

  // 受け渡しを開始できる小道具(保有者が設定済み・紛失/使用停止でない)
  // 予定がすでにある小道具も、その末尾に続けて登録できる(1日目A→B、2日目B→C)
  const transferable = data.items.filter(
    (i) =>
      !i.isArchived &&
      i.currentHolderSerial &&
      !BLOCKED_CONDITIONS.includes(i.condition),
  );
  const selected = data.items.find((i) => i.id === itemId) ?? null;
  // 次の受け渡しの出し手は、鎖の末尾の受取者(予定が無ければ現在の保有者)
  const fromSerial = selected ? expectedHolder(selected, pending) : null;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!selected || !fromSerial) return;
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      // 受け渡しは常に現在の保有者からの移動として作成する
      await createTransfer(
        selected.id,
        fromSerial,
        toSerial,
        // 日付のみの指定。JSTの0時として保存する
        jstToIso(scheduledDate, "00:00"),
        note.trim() || undefined,
      );
      setItemId("");
      setToSerial("");
      setScheduledDate("");
      setNote("");
      setFlash("受け渡し予定を作成しました。");
      await data.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSchedule(transfer: PropTransfer) {
    setError(null);
    setFlash(null);
    try {
      await updateTransferSchedule(
        transfer.id,
        editDate ? jstToIso(editDate, "00:00") : null,
      );
      setEditingId(null);
      setFlash("予定日を更新しました。");
      await data.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    }
  }

  // 現物は渡っているのに本人が押していない場合の代理報告
  async function handleAdminComplete(transfer: PropTransfer) {
    const item = data.items.find((i) => i.id === transfer.propItemId);
    const to = serialLabel(transfer.toSerial, data.names);
    if (
      !window.confirm(
        `${item?.displayName ?? "この小道具"}を ${to} が受け取ったことにします。\n\n` +
          `現物の受け渡しが済んでいることを確認してから実行してください。\n` +
          `保有者が ${to} に変わり、履歴には「運営による代理報告」として残ります。`,
      )
    )
      return;
    setError(null);
    setFlash(null);
    setBusyId(transfer.id);
    try {
      await adminCompleteTransfer(transfer.id);
      setFlash(`${to} の受取完了として記録しました。`);
      await data.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "受取完了に失敗しました");
    } finally {
      setBusyId(null);
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
                {i.displayName}(
                {serialLabel(expectedHolder(i, pending), data.names)}から)
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            保有者未設定・紛失・使用停止の小道具は選べません。
            すでに予定がある場合は、その予定の受取者から続けて登録します
            (1日目 A→B、2日目 B→C)。
          </span>
        </label>

        {selected && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            渡す人:{" "}
            <span className="font-bold text-slate-900">
              {serialLabel(fromSerial, data.names)}
            </span>
          </p>
        )}

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
              .filter((s) => s !== fromSerial)
              .map((s) => (
                <option key={s} value={s}>
                  {serialLabel(s, data.names)}
                </option>
              ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>受け渡し予定日(任意)</span>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-500">
            指定すると、渡す人・受け取る人の画面に予定日が表示されます。
          </span>
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
              {t.status === "pending" ? (
                editingId === t.id ? (
                  <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveSchedule(t)}
                        className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-bold text-white"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600"
                      >
                        やめる
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      空欄にして保存すると予定日なしに戻ります。
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700">
                    予定日:{" "}
                    <span className="font-bold">
                      {scheduledLabel(t.scheduledAt) ?? "未設定"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(t.id);
                        setEditDate(
                          t.scheduledAt ? toDateString(t.scheduledAt) : "",
                        );
                      }}
                      className="ml-2 text-sm font-bold text-blue-700"
                    >
                      変更
                    </button>
                  </p>
                )
              ) : (
                scheduledLabel(t.scheduledAt) && (
                  <p className="text-sm text-slate-600">
                    予定日: {scheduledLabel(t.scheduledAt)}
                  </p>
                )
              )}
              {t.cancelledReason && (
                <p className="text-xs text-slate-500">{t.cancelledReason}</p>
              )}
              {t.status === "pending" && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleAdminComplete(t)}
                    disabled={busyId === t.id}
                    className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busyId === t.id
                      ? "処理中…"
                      : `受取完了にする(${serialLabel(t.toSerial, data.names)})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancel(t)}
                    className="shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-red-600"
                  >
                    キャンセル
                  </button>
                </div>
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
