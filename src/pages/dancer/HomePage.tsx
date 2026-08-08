import { useFestivalData } from "../../context/FestivalDataContext";
import { useNow } from "../../hooks/useNow";
import {
  findNextItem,
  findToday,
  itemsOfDay,
} from "../../lib/schedule";
import { formatDateLabel } from "../../lib/time";
import NextEventCard from "../../components/home/NextEventCard";
import TodayTimeline from "../../components/home/TodayTimeline";
import EmergencyBanner from "../../components/home/EmergencyBanner";
import { useReadStatus } from "../../context/ReadStatusContext";
import { activeAnnouncements } from "../../lib/announcements";

export default function HomePage() {
  const { data, loading } = useFestivalData();
  const now = useNow();
  const { ackedIds, markAcked } = useReadStatus();

  if (loading) {
    return <p className="px-4 py-8 text-center text-slate-500">読み込み中…</p>;
  }
  if (!data) {
    return (
      <p className="px-4 py-8 text-center text-slate-500">
        祭りの情報が見つかりませんでした。
      </p>
    );
  }

  const today = findToday(data.days);
  const todayItems = today ? itemsOfDay(data, today.id) : [];
  const nextItem = findNextItem(todayItems, now);
  const meetingLocation = nextItem?.meetingLocationId
    ? (data.locations.find((l) => l.id === nextItem.meetingLocationId) ?? null)
    : null;

  // 未確認の緊急連絡は「確認しました」を押すまでホームに強制表示する
  const pendingEmergencies = activeAnnouncements(data.announcements, now).filter(
    (a) => a.priority === "emergency" && !ackedIds.has(a.id),
  );

  return (
    <div className="space-y-4 px-4 py-4">
      {pendingEmergencies.map((a) => (
        <EmergencyBanner
          key={a.id}
          announcement={a}
          onAcknowledge={() => markAcked(a.id)}
        />
      ))}

      <header>
        <h1 className="text-lg font-bold text-slate-700">
          {data.festival.name}
        </h1>
        {today && (
          <p className="text-sm text-slate-500">
            {formatDateLabel(today.date)} {today.label}
          </p>
        )}
      </header>

      {today == null ? (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          本日の開催日程はありません。
        </p>
      ) : nextItem ? (
        <NextEventCard
          item={nextItem}
          meetingLocation={meetingLocation}
          now={now}
        />
      ) : (
        <p className="rounded-2xl bg-white p-5 text-lg font-medium text-slate-700">
          本日の予定はすべて終了しました。おつかれさまでした!
        </p>
      )}

      {today && (
        <section>
          <h2 className="mb-2 text-base font-bold text-slate-700">
            本日の演舞
          </h2>
          <TodayTimeline
            items={todayItems}
            nextItemId={
              nextItem?.category === "performance" ? nextItem.id : null
            }
            now={now}
          />
        </section>
      )}
    </div>
  );
}
