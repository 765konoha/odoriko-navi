import type { ScheduleItem, VenueRoute } from "../../types/domain";
import { formatTime } from "../../lib/time";
import { googleMapsRouteUrl } from "../../lib/maps";
import { useItemDone } from "../../hooks/useItemDone";

function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(iso)}`;
}

interface Props {
  route: VenueRoute;
  /** この会場コースに紐づく演舞(中止除く) */
  relatedItems: ScheduleItem[];
  /** 紐づく演舞がすべて完了しているか */
  danced: boolean;
  onClose: () => void;
}

export default function VenueRouteCard({
  route,
  relatedItems,
  danced,
  onClose,
}: Props) {
  const doneOf = useItemDone();
  const start = route.path[0];

  return (
    <div className="absolute inset-x-3 bottom-3 z-[1000] rounded-2xl bg-white p-4 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-500">演舞会場</p>
          <h2 className="text-lg font-bold text-slate-900">{route.name}</h2>
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

      <p className="mt-1">
        {danced ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
            ✓ ここでは踊り終わりました
          </span>
        ) : (
          <span className="rounded bg-[#D3E173] px-2 py-0.5 text-xs font-bold text-[#005D4D]">
            これから演舞があります
          </span>
        )}
      </p>

      {relatedItems.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {relatedItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span className="font-bold">{item.title}</span>
              {item.startTime && (
                <span className="tabular-nums">
                  {dateTimeLabel(item.startTime)}
                </span>
              )}
              {doneOf(item) && (
                <span className="ml-auto font-bold text-emerald-600">✓</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {route.description && (
        <p className="mt-2 text-sm text-slate-600">{route.description}</p>
      )}

      {start && (
        <a
          href={googleMapsRouteUrl(start[0], start[1])}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-xl bg-slate-900 py-3 text-center text-base font-bold text-white"
        >
          Google Mapsでスタート地点を見る
        </a>
      )}
    </div>
  );
}
