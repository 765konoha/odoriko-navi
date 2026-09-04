import { Link, useParams } from "react-router-dom";
import type { Location, ScheduleItem } from "../../types/domain";
import { formatDuration, formatTime, minutesUntil } from "../../lib/time";
import { googleMapsRouteUrl } from "../../lib/maps";
import { CATEGORY_META, effectiveTime } from "../../lib/schedule";

interface Props {
  item: ScheduleItem;
  meetingLocation: Location | null;
  now: Date;
}

export default function NextEventCard({ item, meetingLocation, now }: Props) {
  const { festivalSlug } = useParams();
  const t = effectiveTime(item);
  const remaining = t ? minutesUntil(t, now) : null;
  const isGather = item.gatherTime != null;

  return (
    <section className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg">
      <p className="text-sm font-medium text-slate-300">次の予定</p>

      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-4xl font-bold tabular-nums">
          {t ? formatTime(t) : "--:--"}
        </span>
        <span className="text-2xl font-bold">
          {isGather ? "集合" : CATEGORY_META[item.category].label}
        </span>
      </div>

      <p className="mt-1 text-lg font-medium">
        {meetingLocation?.name ?? item.venueName ?? item.title}
      </p>

      <div className="mt-3 space-y-1 text-sm text-slate-200">
        {item.venueName && item.venueName !== item.title && (
          <p>会場:{item.venueName}</p>
        )}
        {isGather && item.venueName && <p>演舞:{item.title}</p>}
        {item.startTime && item.gatherTime && (
          <p>演舞時間:{formatTime(item.startTime)}</p>
        )}
        {!item.isConfirmed && item.tbdNote && (
          <p className="font-medium text-amber-300">未確定:{item.tbdNote}</p>
        )}
        {item.notes && <p>⚠ {item.notes}</p>}
      </div>

      {remaining != null && remaining >= 0 && (
        <p className="mt-4 text-xl font-bold text-amber-300">
          {isGather ? "集合まで" : "開始まで"} {formatDuration(remaining)}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2">
        {meetingLocation && (
          <>
            <Link
              to={`/f/${festivalSlug}/map?loc=${meetingLocation.id}`}
              className="rounded-xl bg-white py-3 text-center text-base font-bold text-slate-900"
            >
              地図を見る
            </Link>
            <a
              href={googleMapsRouteUrl(meetingLocation.lat, meetingLocation.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-500 py-3 text-center text-base font-bold text-white"
            >
              Google Mapsで経路を見る
            </a>
          </>
        )}
      </div>
    </section>
  );
}
