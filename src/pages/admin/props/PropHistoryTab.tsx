import { useEffect, useState } from "react";
import type { PropsAdminData } from "./PropsAdminPage";
import type { PropHistoryEntry } from "../../../types/props";
import { conditionLabel, historyActionLabel } from "../../../types/props";
import { listHistory, serialLabel } from "../../../lib/props";
import { formatTime, toDateString } from "../../../lib/time";

/** 変更前後の値はシリアル・状態のいずれかなので、両方に対応した表示にする */
function valueLabel(
  value: string | undefined,
  action: string,
  names: Map<string, string>,
): string {
  if (!value) return "未設定";
  if (action === "condition_changed") return conditionLabel(value);
  return serialLabel(value, names);
}

export default function PropHistoryTab({ data }: { data: PropsAdminData }) {
  const [itemId, setItemId] = useState(data.items[0]?.id ?? "");
  const [entries, setEntries] = useState<PropHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void listHistory(itemId)
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch(() => setEntries([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-slate-600">小道具</span>
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        >
          {data.items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.displayName}
            </option>
          ))}
        </select>
      </label>

      {loading && <p className="py-4 text-center text-slate-500">読み込み中…</p>}

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                {historyActionLabel(e.action)}
              </span>
              {e.actorIsAdmin && (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-700">
                  管理者
                </span>
              )}
              <span className="ml-auto text-xs tabular-nums text-slate-500">
                {toDateString(e.createdAt).slice(5).replace("-", "/")}{" "}
                {formatTime(e.createdAt)}
              </span>
            </div>
            {(e.fromValue || e.toValue) && (
              <p className="mt-1 text-sm text-slate-700">
                {valueLabel(e.fromValue, e.action, data.names)} →{" "}
                {valueLabel(e.toValue, e.action, data.names)}
              </p>
            )}
            {e.actorSerial && (
              <p className="text-xs text-slate-500">
                操作者: {serialLabel(e.actorSerial, data.names)}
              </p>
            )}
            {e.note && <p className="text-xs text-slate-600">{e.note}</p>}
          </div>
        ))}
        {!loading && entries.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            履歴はまだありません。
          </p>
        )}
      </div>
    </div>
  );
}
