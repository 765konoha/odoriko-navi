import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFestivalData } from "../../context/FestivalDataContext";
import type { Location, LocationKind } from "../../types/domain";
import { meetingPointIcon, toiletIcon } from "../../components/map/markerIcons";
import LocationDetailCard from "../../components/map/LocationDetailCard";
import RefreshIndicator from "../../components/layout/RefreshIndicator";

/** 初期表示: 全マーカーが収まるようにフィット(選択指定がある場合はそこへ) */
function InitialView({
  locations,
  focus,
}: {
  locations: Location[];
  focus: Location | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (focus) {
      map.setView([focus.lat, focus.lng], 17);
    } else if (locations.length > 0) {
      map.fitBounds(
        L.latLngBounds(locations.map((l) => [l.lat, l.lng])),
        { padding: [40, 40], maxZoom: 16 },
      );
    }
    // 初期表示のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function MapPage() {
  const { data, loading } = useFestivalData();
  const [searchParams] = useSearchParams();
  const [showKind, setShowKind] = useState<Record<LocationKind, boolean>>({
    meeting_point: true,
    toilet: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("loc"),
  );

  const locations = useMemo(() => data?.locations ?? [], [data]);
  const visible = locations.filter((l) => showKind[l.kind]);
  const selected = locations.find((l) => l.id === selectedId) ?? null;
  const focus = useMemo(
    () => locations.find((l) => l.id === searchParams.get("loc")) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations],
  );

  if (loading) {
    return <p className="px-4 py-8 text-center text-slate-500">読み込み中…</p>;
  }
  if (!data) {
    return (
      <p className="px-4 py-8 text-center text-slate-500">
        地図情報が見つかりませんでした。
      </p>
    );
  }

  const relatedItems = selected
    ? data.scheduleItems.filter((s) => s.meetingLocationId === selected.id)
    : [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-2 px-4 py-3">
        {(
          [
            ["meeting_point", "集合場所"],
            ["toilet", "トイレ"],
          ] as const
        ).map(([kind, label]) => (
          <label
            key={kind}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
              showKind[kind]
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={showKind[kind]}
              onChange={(e) =>
                setShowKind((prev) => ({ ...prev, [kind]: e.target.checked }))
              }
              className="h-4 w-4"
            />
            {label}
          </label>
        ))}
        <div className="ml-auto self-center">
          <RefreshIndicator />
        </div>
      </div>

      <div className="relative flex-1">
        <MapContainer
          center={[33.5597, 133.5388]}
          zoom={15}
          className="absolute inset-0 z-0"
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <InitialView locations={locations} focus={focus} />
          {visible.map((loc) => (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={loc.kind === "meeting_point" ? meetingPointIcon : toiletIcon}
              eventHandlers={{ click: () => setSelectedId(loc.id) }}
            />
          ))}
        </MapContainer>

        {selected && (
          <LocationDetailCard
            location={selected}
            relatedItems={relatedItems}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
