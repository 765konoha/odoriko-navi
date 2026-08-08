import { NavLink, useParams } from "react-router-dom";
import { useFestivalData } from "../../context/FestivalDataContext";
import { useReadStatus } from "../../context/ReadStatusContext";
import { activeAnnouncements } from "../../lib/announcements";

const iconClass = "h-6 w-6";

const items = [
  {
    to: "",
    end: true,
    label: "ホーム",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
      </svg>
    ),
  },
  {
    to: "schedule",
    end: false,
    label: "予定",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    ),
  },
  {
    to: "map",
    end: false,
    label: "マップ",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    to: "announcements",
    end: false,
    label: "お知らせ",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M10.3 21a2 2 0 0 0 3.4 0" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const { festivalSlug } = useParams();
  const base = `/${festivalSlug}`;
  const { data } = useFestivalData();
  const { readIds } = useReadStatus();

  // 未読件数: 現在公開中のお知らせのうち未読のもの
  const unreadCount = data
    ? activeAnnouncements(data.announcements, new Date()).filter(
        (a) => !readIds.has(a.id),
      ).length
    : 0;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to === "" ? base : `${base}/${item.to}`}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                isActive ? "text-blue-700" : "text-slate-500"
              }`
            }
          >
            <span className="relative">
              {item.icon}
              {item.to === "announcements" && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
