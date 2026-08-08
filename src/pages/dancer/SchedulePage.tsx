import { useState } from "react";
import { useFestivalData } from "../../context/FestivalDataContext";
import {
  findNextItem,
  findToday,
  itemsOfDay,
  totalDanceCount,
} from "../../lib/schedule";
import { formatDateLabel } from "../../lib/time";
import ScheduleItemCard from "../../components/schedule/ScheduleItemCard";
import RefreshIndicator from "../../components/layout/RefreshIndicator";

export default function SchedulePage() {
  const { data, loading } = useFestivalData();
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

  // 開催日は常に日付順(管理画面で後から追加しても順序が崩れないように)
  const days = [...data.days].sort((a, b) => a.date.localeCompare(b.date));
  const today = findToday(days);
  const currentDay =
    days.find((d) => d.id === selectedDayId) ?? today ?? days[0];
  const items = itemsOfDay(data, currentDay.id);
  const nextItem =
    today && currentDay.id === today.id ? findNextItem(items) : null;
  const dayDanceCount = totalDanceCount(items);
  const activeItems = items.filter((i) => !i.isCancelled);
  const allDone =
    activeItems.length > 0 && activeItems.every((i) => i.isCompleted);

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

      {allDone && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-base font-bold text-emerald-800">
          🎉 この日の予定はすべて完了!
          <br />
          お疲れさまでした!
        </p>
      )}

      {dayDanceCount > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
          🥁 この日の踊った回数:{" "}
          <span className="font-bold tabular-nums">
            {Number.isInteger(dayDanceCount)
              ? dayDanceCount
              : dayDanceCount.toFixed(1)}
            回
          </span>
        </p>
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
