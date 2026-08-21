import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import {
  listAllAnnouncements,
  listDays,
  listLocations,
  listScheduleItems,
} from "../../lib/adminApi";
import { todayString } from "../../lib/time";
import { isActiveAnnouncement } from "../../lib/announcements";

interface Summary {
  todayItemCount: number | null;
  activeAnnouncementCount: number;
  emergencyCount: number;
  locationCount: number;
}

export default function AdminDashboardPage() {
  const { festival, loading: festivalLoading } = useAdminFestival();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!festival) return;
    let cancelled = false;
    void (async () => {
      const [days, locations, announcements] = await Promise.all([
        listDays(festival.id),
        listLocations(festival.id),
        listAllAnnouncements(festival.id),
      ]);
      const today = days.find((d) => d.date === todayString());
      const todayItems = today ? await listScheduleItems([today.id]) : null;
      const now = new Date();
      const active = announcements.filter((a) => isActiveAnnouncement(a, now));
      if (!cancelled) {
        setSummary({
          todayItemCount: todayItems ? todayItems.length : null,
          activeAnnouncementCount: active.length,
          emergencyCount: active.filter((a) => a.priority === "emergency")
            .length,
          locationCount: locations.length,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [festival]);

  if (festivalLoading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }
  if (!festival) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-white p-4 text-slate-600">
          祭りが登録されていません。まずは祭りを登録してください。
        </p>
        <Link
          to="/admin/festivals"
          className="block rounded-xl bg-slate-900 p-4 text-center font-bold text-white"
        >
          + 祭りを追加
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">{festival.name}</h1>

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">本日の予定</p>
            <p className="text-2xl font-bold">
              {summary.todayItemCount ?? "-"}
              <span className="text-sm font-normal text-slate-500">件</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">公開中お知らせ</p>
            <p className="text-2xl font-bold">
              {summary.activeAnnouncementCount}
              <span className="text-sm font-normal text-slate-500">件</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">緊急連絡</p>
            <p
              className={`text-2xl font-bold ${
                summary.emergencyCount > 0 ? "text-red-600" : ""
              }`}
            >
              {summary.emergencyCount}
              <span className="text-sm font-normal text-slate-500">件</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">登録場所</p>
            <p className="text-2xl font-bold">
              {summary.locationCount}
              <span className="text-sm font-normal text-slate-500">件</span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Link
          to="/admin/schedule"
          className="block rounded-xl bg-white p-4 font-bold text-slate-800 shadow-sm"
        >
          スケジュール管理 →
        </Link>
        <Link
          to="/admin/locations"
          className="block rounded-xl bg-white p-4 font-bold text-slate-800 shadow-sm"
        >
          場所管理 →
        </Link>
        <Link
          to="/admin/announcements"
          className="block rounded-xl bg-white p-4 font-bold text-slate-800 shadow-sm"
        >
          お知らせ管理 →
        </Link>
        <Link
          to="/admin/participants"
          className="block rounded-xl bg-white p-4 font-bold text-slate-800 shadow-sm"
        >
          参加者管理(一括登録・役職)→
        </Link>
        <Link
          to="/admin/festivals"
          className="block rounded-xl bg-white p-4 font-bold text-slate-800 shadow-sm"
        >
          祭り管理(追加・天気予報地点)→
        </Link>
        <Link
          to={`/${festival.slug}`}
          className="block rounded-xl border border-slate-300 p-4 text-center font-bold text-slate-600"
        >
          踊り子画面を確認する
        </Link>
      </div>
    </div>
  );
}
