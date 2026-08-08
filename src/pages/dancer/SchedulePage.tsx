import { useState } from "react";
import { useFestivalData } from "../../context/FestivalDataContext";
import { useNow } from "../../hooks/useNow";
import { findNextItem, findToday, itemsOfDay } from "../../lib/schedule";
import { formatDateLabel } from "../../lib/time";
import ScheduleItemCard from "../../components/schedule/ScheduleItemCard";
import RefreshIndicator from "../../components/layout/RefreshIndicator";

export default function SchedulePage() {
  const { data, loading } = useFestivalData();
  const now = useNow();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  if (loading) {
    return <p className="px-4 py-8 text-center text-slate-500">読み込み中…</p>;
  }
  if (!data || data.days.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-slate-500">
        スケジュールが登録されていません。
      </p>
    );
  }

  const days = [...data.days].sort((a, b) => a.sortOrder - b.sortOrder);
  const today = findToday(days);
  const currentDay =
    days.find((d) => d.id === selectedDayId) ?? today ?? days[0];
  const items = itemsOfDay(data, currentDay.id);
  const nextItem =
    today && currentDay.id === today.id ? findNextItem(items, now) : null;

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">スケジュール</h1>
        <RefreshIndicator />
      </div>

      {days.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setSelectedDayId(day.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                day.id === currentDay.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              {formatDateLabel(day.date)}
              {day.label ? ` ${day.label}` : ""}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          この日の予定はまだ登録されていません。
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ScheduleItemCard
              key={item.id}
              item={item}
              meetingLocation={
                item.meetingLocationId
                  ? (data.locations.find(
                      (l) => l.id === item.meetingLocationId,
                    ) ?? null)
                  : null
              }
              isNext={item.id === nextItem?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
