import type { PropsAdminData } from "./PropsAdminPage";
import { serialLabel } from "../../../lib/props";

export default function PropsDashboard({ data }: { data: PropsAdminData }) {
  const active = data.items.filter((i) => !i.isArchived);
  const pending = data.transfers.filter((t) => t.status === "pending");
  const noHolder = active.filter((i) => !i.currentHolderSerial);
  const brokenish = active.filter((i) =>
    ["damaged", "broken", "repairing"].includes(i.condition),
  );
  const lost = active.filter((i) => i.condition === "lost");
  const upcoming = [...data.events]
    .filter((e) => e.eventDate)
    .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""))
    .find((e) => (e.eventDate ?? "") >= new Date().toISOString().slice(0, 10));

  const tiles = [
    { label: "登録小道具", value: active.length, tone: "" },
    {
      label: "受け渡し待ち",
      value: pending.length,
      tone: pending.length > 0 ? "text-blue-700" : "",
    },
    {
      label: "保有者未設定",
      value: noHolder.length,
      tone: noHolder.length > 0 ? "text-amber-700" : "",
    },
    {
      label: "破損・故障・修理中",
      value: brokenish.length,
      tone: brokenish.length > 0 ? "text-amber-700" : "",
    },
    {
      label: "紛失",
      value: lost.length,
      tone: lost.length > 0 ? "text-red-600" : "",
    },
    { label: "アーカイブ", value: data.items.length - active.length, tone: "" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{t.label}</p>
            <p className={`text-2xl font-bold ${t.tone}`}>
              {t.value}
              <span className="text-sm font-normal text-slate-500">件</span>
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">次回イベント</p>
        <p className="text-base font-bold text-slate-900">
          {upcoming
            ? `${upcoming.eventDate} ${upcoming.name}`
            : "予定されているイベントはありません"}
        </p>
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold text-slate-700">
            受け渡し待ち
          </h2>
          <div className="space-y-2">
            {pending.slice(0, 5).map((t) => {
              const item = data.items.find((i) => i.id === t.propItemId);
              return (
                <div key={t.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-sm font-bold text-slate-900">
                    {item?.displayName ?? "(不明な小道具)"}
                  </p>
                  <p className="text-sm text-slate-600">
                    {serialLabel(t.fromSerial, data.names)} →{" "}
                    {serialLabel(t.toSerial, data.names)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
