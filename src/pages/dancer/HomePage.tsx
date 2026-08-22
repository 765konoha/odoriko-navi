import { Link } from "react-router-dom";
import { useFestivalData } from "../../context/FestivalDataContext";
import { useNow } from "../../hooks/useNow";
import {
  findNextItem,
  findToday,
  itemsOfDay,
} from "../../lib/schedule";
import { formatDateLabel } from "../../lib/time";
import NextEventCard from "../../components/home/NextEventCard";
import BaggageGroupCard from "../../components/home/BaggageGroupCard";
import TodayTimeline from "../../components/home/TodayTimeline";
import DanceCountCard from "../../components/home/DanceCountCard";
import WeatherStrip from "../../components/home/WeatherStrip";
import EmergencyBanner from "../../components/home/EmergencyBanner";
import RefreshIndicator from "../../components/layout/RefreshIndicator";
import { useReadStatus } from "../../context/ReadStatusContext";
import { useUser } from "../../context/UserContext";
import { useViewer } from "../../hooks/useViewer";
import { activeAnnouncements } from "../../lib/announcements";
import {
  viewerLabel,
  visibleAnnouncements,
  visibleScheduleItems,
} from "../../lib/audience";

export default function HomePage() {
  const { data, loading } = useFestivalData();
  const now = useNow();
  const { ackedIds, markAcked, readIds } = useReadStatus();
  const { requestChange } = useUser();
  const viewer = useViewer();

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
  const todayItems = today
    ? visibleScheduleItems(itemsOfDay(data, today.id), viewer)
    : [];
  const nextItem = findNextItem(todayItems);
  const meetingLocation = nextItem?.meetingLocationId
    ? (data.locations.find((l) => l.id === nextItem.meetingLocationId) ?? null)
    : null;

  // 未確認の緊急連絡は「確認しました」を押すまでホームに強制表示する
  // (配信対象のお知らせのみ。個人向けは本人だけに出る)
  const currentAnnouncements = activeAnnouncements(
    visibleAnnouncements(data.announcements, viewer),
    now,
  );
  const pendingEmergencies = currentAnnouncements.filter(
    (a) => a.priority === "emergency" && !ackedIds.has(a.id),
  );
  const unreadCount = currentAnnouncements.filter(
    (a) => !readIds.has(a.id),
  ).length;

  return (
    <div className="space-y-4 px-4 py-4">
      {pendingEmergencies.map((a) => (
        <EmergencyBanner
          key={a.id}
          announcement={a}
          onAcknowledge={() => markAcked(a.id)}
        />
      ))}

      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-700">
            {data.festival.name}
          </h1>
          {today && (
            <p className="text-sm text-slate-500">
              {formatDateLabel(today.date)} {today.label}
            </p>
          )}
        </div>
        <RefreshIndicator />
      </header>

      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5">
        <span className="text-sm text-slate-500">利用者</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
          {viewerLabel(viewer)}
        </span>
        <button
          type="button"
          onClick={requestChange}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-600"
        >
          変更
        </button>
      </div>

      <BaggageGroupCard data={data} viewer={viewer} />

      {unreadCount > 0 && (
        <Link
          to="announcements"
          className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
        >
          <span className="text-xl">🔔</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-blue-900">
              新しい通知が{unreadCount}件あります。
            </span>
            <span className="block text-xs text-blue-700">
              タップするとお知らせ画面を開きます
            </span>
          </span>
          <span className="text-blue-400">›</span>
        </Link>
      )}

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

      <WeatherStrip />

      {today && (
        <section>
          <h2 className="mb-2 text-base font-bold text-slate-700">
            本日の演舞
          </h2>
          <TodayTimeline
            items={todayItems}
            locations={data.locations}
            nextItemId={
              nextItem?.category === "performance" ? nextItem.id : null
            }
          />
        </section>
      )}

      {data.festival.danceCountEnabled && (
        <DanceCountCard
          days={data.days}
          items={visibleScheduleItems(data.scheduleItems, viewer)}
        />
      )}

      <footer className="pt-6 pb-2 text-center">
        <Link to="/admin" className="text-xs text-slate-400 underline">
          運営の方はこちら
        </Link>
      </footer>
    </div>
  );
}
