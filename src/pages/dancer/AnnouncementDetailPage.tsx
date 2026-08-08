import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useFestivalData } from "../../context/FestivalDataContext";
import { useReadStatus } from "../../context/ReadStatusContext";
import { formatTime, toDateString, todayString } from "../../lib/time";
import PriorityBadge from "../../components/announcements/PriorityBadge";

export default function AnnouncementDetailPage() {
  const { festivalSlug, announcementId } = useParams();
  const { data, loading } = useFestivalData();
  const { markRead } = useReadStatus();

  // 詳細を開いたら既読にする
  const exists =
    data?.announcements.some((a) => a.id === announcementId) ?? false;
  useEffect(() => {
    if (exists && announcementId) markRead(announcementId);
  }, [exists, announcementId, markRead]);

  if (loading) {
    return <p className="px-4 py-8 text-center text-slate-500">読み込み中…</p>;
  }

  const announcement = data?.announcements.find(
    (a) => a.id === announcementId,
  );

  if (!announcement) {
    return (
      <div className="space-y-4 px-4 py-4">
        <p className="rounded-xl bg-white p-4 text-slate-600">
          このお知らせは見つかりませんでした。
        </p>
        <Link
          to={`/${festivalSlug}/announcements`}
          className="block text-center font-bold text-blue-700"
        >
          お知らせ一覧へ戻る
        </Link>
      </div>
    );
  }

  const published = announcement.publishedAt;
  const dateLabel =
    toDateString(published) === todayString()
      ? formatTime(published)
      : `${new Date(published).getMonth() + 1}/${new Date(published).getDate()} ${formatTime(published)}`;

  return (
    <div className="space-y-4 px-4 py-4">
      <Link
        to={`/${festivalSlug}/announcements`}
        className="inline-block text-sm font-bold text-blue-700"
      >
        ← お知らせ一覧
      </Link>

      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={announcement.priority} />
          <span className="ml-auto text-sm tabular-nums text-slate-500">
            {dateLabel}
          </span>
        </div>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          {announcement.title}
        </h1>
        <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
          {announcement.body}
        </p>
      </article>
    </div>
  );
}
