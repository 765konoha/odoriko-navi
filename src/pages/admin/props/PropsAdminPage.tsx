import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PropEvent, PropItem, PropTransfer } from "../../../types/props";
import {
  listPropEvents,
  listPropItems,
  loadDisplayNames,
} from "../../../lib/props";
import { listAllTransfers } from "../../../lib/propsAdminApi";
import { repository } from "../../../repositories";
import { compareSerial } from "../../../lib/audience";
import PropsDashboard from "./PropsDashboard";
import PropItemsTab from "./PropItemsTab";
import PropEventsTab from "./PropEventsTab";
import PropTransfersTab from "./PropTransfersTab";
import PropHistoryTab from "./PropHistoryTab";

export interface PropsAdminData {
  items: PropItem[];
  transfers: PropTransfer[];
  events: PropEvent[];
  names: Map<string, string>;
  serials: string[];
  reload: () => Promise<void>;
}

const TABS = [
  { key: "dashboard", label: "概要" },
  { key: "items", label: "小道具" },
  { key: "events", label: "イベント" },
  { key: "transfers", label: "受け渡し" },
  { key: "history", label: "履歴" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** 小道具管理(小道具担当用)。祭り運営とは責務を分けた独立セクション */
export default function PropsAdminPage() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [data, setData] = useState<PropsAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [items, transfers, events, names, serials] = await Promise.all([
      listPropItems(true),
      listAllTransfers(),
      listPropEvents(),
      loadDisplayNames(),
      repository.listParticipantSerials(),
    ]);
    setData({
      items,
      transfers,
      events,
      names,
      serials: [...serials].sort(compareSerial),
      reload,
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "読み込みに失敗しました"),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }
  if (error || !data) {
    return (
      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
        {error ?? "読み込みに失敗しました"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold text-slate-800">小道具管理</h1>
        <Link to="/admin" className="ml-auto text-sm font-bold text-blue-700">
          運営メニューへ
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                tab === t.key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 shadow-sm"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && <PropsDashboard data={data} />}
      {tab === "items" && <PropItemsTab data={data} />}
      {tab === "events" && <PropEventsTab data={data} />}
      {tab === "transfers" && <PropTransfersTab data={data} />}
      {tab === "history" && <PropHistoryTab data={data} />}
    </div>
  );
}
