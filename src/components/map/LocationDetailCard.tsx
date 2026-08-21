import type { Location, ScheduleItem } from "../../types/domain";
import { formatTime } from "../../lib/time";
import { googleMapsRouteUrl } from "../../lib/maps";

interface Props {
  location: Location;
  /** この集合場所に紐づく予定(トイレの場合は空) */
  relatedItems: ScheduleItem[];
  onClose: () => void;
}

export default function LocationDetailCard({
  location,
  relatedItems,
  onClose,
}: Props) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-[1000] rounded-2xl bg-white p-4 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-500">
            {location.kind === "meeting_point"
              ? "集合場所"
              : location.kind === "toilet"
                ? "トイレ"
                : "更衣室"}
          </p>
          <h2 className="text-lg font-bold text-slate-900">{location.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600"
        >
          ✕
        </button>
      </div>

      {location.address && (
        <p className="mt-1 text-sm text-slate-600">{location.address}</p>
      )}

      {relatedItems.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {relatedItems.map((item) => (
            <li key={item.id}>
              <span className="font-bold">{item.title}</span>
              {item.gatherTime && (
                <span className="ml-2 tabular-nums">
                  集合 {formatTime(item.gatherTime)}
                </span>
              )}
              {item.isCancelled && (
                <span className="ml-2 font-bold text-red-600">中止</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {location.description && (
        <p className="mt-2 text-sm text-slate-600">⚠ {location.description}</p>
      )}

      <a
        href={googleMapsRouteUrl(location.lat, location.lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block rounded-xl bg-slate-900 py-3 text-center text-base font-bold text-white"
      >
        Google Mapsで経路を見る
      </a>
    </div>
  );
}
