import { Link } from "react-router-dom";
import { useFestivalData } from "../../context/FestivalDataContext";
import { formatTime, toDateString, todayString } from "../../lib/time";
import PriorityBadge from "../../components/announcements/PriorityBadge";

function publishedLabel(iso: string): string {
  const time = formatTime(iso);
  if (toDateString(iso) === todayString()) return time;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export default function AnnouncementsPage() {
  const { data, loading } = useFestivalData();

  if (loading) {
    return <p className="px-4 py-8 text-center text-slate-500">読み込み中…</p>;
  }

  const announcements = [...(data?.announcements ?? [])].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-xl font-bold">お知らせ</h1>

      {announcements.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          お知らせはまだありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li key={a.id}>
              <Link
                to={a.id}
                className={`block rounded-2xl bg-white p-4 shadow-sm ${
                  a.priority === "emergency" ? "border-l-4 border-red-600" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={a.priority} />
                  <span className="ml-auto text-sm tabular-nums text-slate-500">
                    {publishedLabel(a.publishedAt)}
                  </span>
                </div>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {a.title}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
