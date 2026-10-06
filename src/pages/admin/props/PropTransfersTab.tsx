import { useMemo, useState, type FormEvent } from "react";
import type { PropsAdminData } from "./PropsAdminPage";
import type { PropTransfer } from "../../../types/props";
import { BLOCKED_CONDITIONS, sameSerials, sortSerials } from "../../../types/props";
import {
  createHandover,
  expectedHolder,
  giversOf,
  leavingOf,
  nextGivers,
  serialsLabel,
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
  // 受け取る人(1人以上。今持っている人を含めてよい)
  const [receivers, setReceivers] = useState<string[]>([]);
  const [receiverPick, setReceiverPick] = useState("");
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
  // 次の受け渡しの渡す側は、鎖の末尾の受け取る人全員(予定が無ければ今持っている人全員)。
  // fromSerial はその代表で、DB で順番が変わっていないかの確認に使う
  const fromSerial = selected ? expectedHolder(selected, pending) : null;
  const givers = selected ? nextGivers(selected, pending) : [];
  const unchanged = receivers.length > 0 && sameSerials(receivers, givers);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!selected || !fromSerial || receivers.length === 0 || unchanged) return;
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      await createHandover(
        selected.id,
        fromSerial,
        receivers,
        // 日付のみの指定。JSTの0時として保存する
        jstToIso(scheduledDate, "00:00"),
        note.trim() || undefined,
      );
      setItemId("");
      setReceivers([]);
      setReceiverPick("");
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
    const to = serialsLabel(transfer.receivers, data.names);
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
                {serialsLabel(nextGivers(i, pending), data.names)}から)
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
              {serialsLabel(nextGivers(selected, pending), data.names)}
            </span>
          </p>
        )}

        <div>
          <span className={labelClass}>受け渡し先(複数可)</span>
          {receivers.length > 0 && (
            <ul className="mt-1 space-y-1">
              {receivers.map((r) => (
                <li
                  key={r}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-bold text-slate-800">
                    {serialLabel(r, data.names)}
                    {givers.includes(r) && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        (今も持っている)
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setReceivers((prev) => prev.filter((x) => x !== r))
                    }
                    className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs font-bold text-slate-600"
                  >
                    外す
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1 flex gap-2">
            <select
              value={receiverPick}
              onChange={(e) => setReceiverPick(e.target.value)}
              aria-label="受け渡し先に追加する人"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
            >
              <option value="">追加する人を選択</option>
              {data.serials
                .filter((s) => !receivers.includes(s))
                .map((s) => (
                  <option key={s} value={s}>
                    {serialLabel(s, data.names)}
                    {givers.includes(s) ? "(今も持っている)" : ""}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!receiverPick) return;
                setReceivers((prev) => sortSerials([...prev, receiverPick]));
                setReceiverPick("");
              }}
              disabled={!receiverPick}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
            >
              追加
            </button>
          </div>
          <span className="mt-1 block text-xs text-slate-500">
            複数人を選ぶと、受け渡し後は全員で持ちます。今持っている人を選ぶと、
            その人が持ち続けます(例: 402・615 → 402 は 615 が抜けて 402 だけが持つ)。
            受け取る人のうち誰か1人が「受け取りました」を押せば完了します。
          </span>
        </div>

        {selected && receivers.length > 0 && !unchanged && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            受け渡し後は{" "}
            <span className="font-bold">
              {serialsLabel(receivers, data.names)}
            </span>{" "}
            が持ちます
            {leavingOf(givers, receivers).length > 0 && (
              <>
                ({serialsLabel(leavingOf(givers, receivers), data.names)}{" "}
                は外れます)
              </>
            )}
          </p>
        )}
        {unchanged && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            今持っている人と同じ顔ぶれのため、受け渡しになりません。
          </p>
        )}

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
          disabled={saving || !itemId || receivers.length === 0 || unchanged}
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
                {serialsLabel(giversOf(t, item, pending), data.names)} →{" "}
                {serialsLabel(t.receivers, data.names)}
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
                      : `受取完了にする(${serialsLabel(t.receivers, data.names)})`}
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
