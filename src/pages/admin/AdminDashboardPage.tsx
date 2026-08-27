import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import {
  listAllAnnouncements,
  listDays,
  listLocations,
  listParticipants,
  listScheduleItems,
} from "../../lib/adminApi";
import { todayString } from "../../lib/time";
import { isActiveAnnouncement } from "../../lib/announcements";
import { loadAdminCache, saveAdminCache } from "../../lib/adminCache";

interface Summary {
  todayItemCount: number | null;
  activeAnnouncementCount: number;
  emergencyCount: number;
  locationCount: number;
  dayCount: number;
  participantCount: number;
  scheduleItemCount: number;
}

/** 祭りワークスペースの「概要」 */
export default function AdminDashboardPage() {
  const { festival } = useAdminFestival();
  // 前回の集計を即表示し、裏で最新を取得する
  const [summary, setSummary] = useState<Summary | null>(() =>
    festival ? loadAdminCache<Summary>(festival.id, "dashboard") : null,
  );

  useEffect(() => {
    if (!festival) return;
    setSummary(loadAdminCache<Summary>(festival.id, "dashboard"));
    let cancelled = false;
    void (async () => {
      const [days, locations, announcements, participants] = await Promise.all([
        listDays(festival.id),
        listLocations(festival.id),
        listAllAnnouncements(festival.id),
        listParticipants(festival.id),
      ]);
      const allItems = await listScheduleItems(days.map((d) => d.id));
      const today = days.find((d) => d.date === todayString());
      const now = new Date();
      const active = announcements.filter((a) => isActiveAnnouncement(a, now));
      const fresh: Summary = {
        todayItemCount: today
          ? allItems.filter((i) => i.festivalDayId === today.id).length
          : null,
        activeAnnouncementCount: active.length,
        emergencyCount: active.filter((a) => a.priority === "emergency").length,
        locationCount: locations.length,
        dayCount: days.length,
        participantCount: participants.length,
        scheduleItemCount: allItems.length,
      };
      saveAdminCache(festival.id, "dashboard", fresh);
      if (!cancelled) setSummary(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [festival]);

  if (!festival) return null;

  const base = `/admin/f/${festival.slug}`;

  if (!summary) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  return (
    <div className="space-y-4">
      {(
        <>
          <section>
            <h2 className="mb-2 text-sm font-bold text-slate-500">当日の状況</h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="本日の予定" value={summary.todayItemCount ?? "-"} />
              <Stat
                label="公開中お知らせ"
                value={summary.activeAnnouncementCount}
              />
              <Stat
                label="緊急連絡"
                value={summary.emergencyCount}
                alert={summary.emergencyCount > 0}
              />
              <Stat label="登録場所" value={summary.locationCount} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold text-slate-500">準備状況</h2>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <Check
                to={`${base}/settings`}
                label="天気予報地点"
                done={
                  festival.weatherLat != null && festival.weatherLng != null
                }
                detail={
                  festival.weatherLat != null ? "設定済み" : "未設定"
                }
              />
              <Check
                to={`${base}/schedule`}
                label="開催日程"
                done={summary.dayCount > 0}
                detail={`${summary.dayCount}日`}
              />
              <Check
                to={`${base}/participants`}
                label="参加者"
                done={summary.participantCount > 0}
                detail={`${summary.participantCount}人`}
              />
              <Check
                to={`${base}/locations`}
                label="場所"
                done={summary.locationCount > 0}
                detail={`${summary.locationCount}件`}
              />
              <Check
                to={`${base}/schedule`}
                label="予定"
                done={summary.scheduleItemCount > 0}
                detail={`${summary.scheduleItemCount}件`}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: number | string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${alert ? "text-red-600" : ""}`}>
        {value}
        <span className="text-sm font-normal text-slate-500">件</span>
      </p>
    </div>
  );
}

function Check({
  to,
  label,
  done,
  detail,
}: {
  to: string;
  label: string;
  done: boolean;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 last:border-0"
    >
      <span className={done ? "text-emerald-600" : "text-amber-600"}>
        {done ? "✓" : "!"}
      </span>
      <span className="min-w-0 flex-1 text-sm font-bold text-slate-800">
        {label}
      </span>
      <span
        className={`shrink-0 text-sm ${
          done ? "text-slate-500" : "font-bold text-amber-700"
        }`}
      >
        {detail}
      </span>
      <span className="shrink-0 text-slate-400">›</span>
    </Link>
  );
}
