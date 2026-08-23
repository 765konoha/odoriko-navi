import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PropsAdminData } from "./PropsAdminPage";
import type { PropAssignment, PropCondition, PropItem } from "../../../types/props";
import { PROP_CONDITIONS, conditionLabel } from "../../../types/props";
import { listAssignments, serialLabel } from "../../../lib/props";
import {
  adminSetHolder,
  createPropItem,
  setPropArchived,
  updatePropItem,
  type PropItemInput,
} from "../../../lib/propsAdminApi";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

function emptyInput(): PropItemInput {
  return {
    category: "",
    identifier: "",
    displayName: "",
    condition: "normal",
    conditionNote: null,
    note: null,
    currentHolderSerial: null,
  };
}

/** 小道具の登録・編集(保有者の変更は専用RPC経由) */
function ItemForm({
  data,
  item,
  onDone,
  onCancel,
}: {
  data: PropsAdminData;
  item: PropItem | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PropItemInput>(() =>
    item
      ? {
          category: item.category,
          identifier: item.identifier,
          displayName: item.displayName,
          condition: item.condition,
          conditionNote: item.conditionNote ?? null,
          note: item.note ?? null,
        }
      : emptyInput(),
  );
  const [holder, setHolder] = useState(item?.currentHolderSerial ?? "");
  const [holderNote, setHolderNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function set<K extends keyof PropItemInput>(key: K, value: PropItemInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: PropItemInput = {
      ...form,
      category: form.category.trim(),
      identifier: form.identifier.trim(),
      displayName:
        form.displayName.trim() ||
        `${form.category.trim()}${form.identifier.trim()}`,
      conditionNote: form.conditionNote?.trim() || null,
      note: form.note?.trim() || null,
      currentHolderSerial: item ? undefined : holder || null,
    };
    try {
      if (item) await updatePropItem(item.id, input);
      else await createPropItem(input);
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存に失敗しました";
      setError(
        message.includes("duplicate")
          ? "同じ種類・識別番号の小道具がすでに登録されています"
          : message,
      );
      setSaving(false);
    }
  }

  /** 通常の受取フローを通さずに現在保有者を変更する */
  async function handleHolderChange() {
    if (!item) return;
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      await adminSetHolder(item.id, holder || null, holderNote.trim() || null);
      setHolderNote("");
      setFlash("保有者を変更しました(受け渡し予定があればキャンセルしました)。");
      await data.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "変更に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-bold text-slate-800">
        {item ? `${item.displayName} を編集` : "小道具を追加"}
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelClass}>種類 *</span>
          <input
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            required
            className={inputClass}
            placeholder="太鼓"
          />
        </label>
        <label className="block">
          <span className={labelClass}>識別番号・色 *</span>
          <input
            value={form.identifier}
            onChange={(e) => set("identifier", e.target.value)}
            required
            className={inputClass}
            placeholder="8"
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>表示名(空欄なら種類+識別)</span>
        <input
          value={form.displayName}
          onChange={(e) => set("displayName", e.target.value)}
          className={inputClass}
          placeholder="太鼓8"
        />
      </label>

      <label className="block">
        <span className={labelClass}>状態</span>
        <select
          value={form.condition}
          onChange={(e) => set("condition", e.target.value as PropCondition)}
          className={inputClass}
        >
          {PROP_CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>状態の備考</span>
        <input
          value={form.conditionNote ?? ""}
          onChange={(e) => set("conditionNote", e.target.value)}
          className={inputClass}
          placeholder="例: 持ち手部分にヒビあり"
        />
      </label>

      <label className="block">
        <span className={labelClass}>備考</span>
        <textarea
          value={form.note ?? ""}
          onChange={(e) => set("note", e.target.value)}
          rows={2}
          className={inputClass}
        />
      </label>

      {!item && (
        <label className="block">
          <span className={labelClass}>現在保有者</span>
          <select
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            className={inputClass}
          >
            <option value="">未設定</option>
            {data.serials.map((s) => (
              <option key={s} value={s}>
                {serialLabel(s, data.names)}
              </option>
            ))}
          </select>
        </label>
      )}

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
          閉じる
        </button>
      </div>

      {item && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-bold text-slate-700">現在保有者の手動変更</p>
          <p className="text-xs text-slate-500">
            現在: {serialLabel(item.currentHolderSerial, data.names)}
            <br />
            受け渡し予定がある場合は自動でキャンセルされ、履歴に残ります。
          </p>
          <select
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
          >
            <option value="">未設定</option>
            {data.serials.map((s) => (
              <option key={s} value={s}>
                {serialLabel(s, data.names)}
              </option>
            ))}
          </select>
          <input
            value={holderNote}
            onChange={(e) => setHolderNote(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
            placeholder="理由・備考(任意) 例: 練習で直接回収"
          />
          <button
            type="button"
            onClick={() => void handleHolderChange()}
            disabled={saving}
            className="w-full rounded-lg bg-slate-700 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            保有者を変更
          </button>
          <button
            type="button"
            onClick={() =>
              void setPropArchived(item.id, !item.isArchived).then(() => {
                void data.reload();
                onDone();
              })
            }
            className="w-full rounded-lg border border-slate-300 py-2 text-sm font-bold text-slate-600"
          >
            {item.isArchived ? "利用を再開する" : "利用終了(アーカイブ)"}
          </button>
        </div>
      )}
    </form>
  );
}

export default function PropItemsTab({ data }: { data: PropsAdminData }) {
  const [query, setQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; item: PropItem } | null
  >(null);
  const [assignments, setAssignments] = useState<PropAssignment[]>([]);

  // 次回イベントの使用予定者を一覧に表示する
  const nextEvent = useMemo(
    () =>
      [...data.events]
        .filter((e) => e.eventDate)
        .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""))
        .find((e) => (e.eventDate ?? "") >= new Date().toISOString().slice(0, 10)),
    [data.events],
  );

  useEffect(() => {
    if (!nextEvent) {
      setAssignments([]);
      return;
    }
    let cancelled = false;
    void listAssignments(nextEvent.id)
      .then((list) => {
        if (!cancelled) setAssignments(list);
      })
      .catch(() => setAssignments([]));
    return () => {
      cancelled = true;
    };
  }, [nextEvent]);

  const pendingByItem = useMemo(() => {
    const set = new Set<string>();
    for (const t of data.transfers) {
      if (t.status === "pending") set.add(t.propItemId);
    }
    return set;
  }, [data.transfers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter((i) => {
      if (!showArchived && i.isArchived) return false;
      if (conditionFilter && i.condition !== conditionFilter) return false;
      if (!q) return true;
      const holder = i.currentHolderSerial ?? "";
      return (
        i.displayName.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.identifier.toLowerCase().includes(q) ||
        holder.toLowerCase().includes(q) ||
        (data.names.get(holder) ?? "").toLowerCase().includes(q)
      );
    });
  }, [data.items, data.names, query, conditionFilter, showArchived]);

  if (editing) {
    return (
      <ItemForm
        data={data}
        item={editing.mode === "edit" ? editing.item : null}
        onDone={() => {
          setEditing(null);
          void data.reload();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setEditing({ mode: "new" })}
        className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
      >
        + 小道具を追加
      </button>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base"
        placeholder="🔍 小道具名・種類・保有者で検索"
      />

      <div className="flex gap-2">
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">すべての状態</option>
          {PROP_CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4"
          />
          終了分も表示
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-bold">小道具</th>
                <th className="px-3 py-2 font-bold">現在保有者</th>
                <th className="px-3 py-2 font-bold">次回使用</th>
                <th className="px-3 py-2 font-bold">状態</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const assignee = assignments.find(
                  (a) => a.propItemId === item.id,
                )?.userSerial;
                return (
                  <tr
                    key={item.id}
                    onClick={() => setEditing({ mode: "edit", item })}
                    className="cursor-pointer border-b border-slate-100 last:border-b-0 active:bg-slate-50"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-slate-900">
                        {item.displayName}
                      </span>
                      {pendingByItem.has(item.id) && (
                        <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                          受渡待ち
                        </span>
                      )}
                      {item.isArchived && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          終了
                        </span>
                      )}
                      <span className="block text-xs text-slate-500">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                      {item.currentHolderSerial ? (
                        serialLabel(item.currentHolderSerial, data.names)
                      ) : (
                        <span className="text-amber-700">未設定</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                      {assignee ? serialLabel(assignee, data.names) : "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={
                          item.condition === "normal"
                            ? "text-slate-500"
                            : "font-bold text-amber-700"
                        }
                      >
                        {conditionLabel(item.condition)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    該当する小道具がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        行をタップすると編集・状態変更・保有者の手動変更ができます。
        {nextEvent && `「次回使用」は ${nextEvent.name} の使用予定者です。`}
      </p>
    </div>
  );
}
