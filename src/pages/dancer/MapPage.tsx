import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFestivalData } from "../../context/FestivalDataContext";
import type { Location, LocationKind } from "../../types/domain";
import {
  currentLocationIcon,
  meetingPointIcon,
  toiletIcon,
} from "../../components/map/markerIcons";
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

interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
}

/** 現在地ボタンが押されたとき(seq更新時)に地図を移動する */
function RecenterOnGeo({
  target,
}: {
  target: (GeoFix & { seq: number }) | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.setView([target.lat, target.lng], Math.max(map.getZoom(), 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.seq]);
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

  // 現在地
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [centerTarget, setCenterTarget] = useState<
    (GeoFix & { seq: number }) | null
  >(null);
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredRef = useRef(false);
  const seqRef = useRef(0);

  // 画面を離れたら追跡を停止(バッテリー節約)
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function centerOn(fix: GeoFix) {
    seqRef.current += 1;
    setCenterTarget({ ...fix, seq: seqRef.current });
  }

  function handleLocateTap() {
    // 追跡中の再タップ → 現在地へ戻る
    if (tracking && geo) {
      centerOn(geo);
      return;
    }
    if (!("geolocation" in navigator)) {
      setGeoError("この端末では位置情報を利用できません。");
      return;
    }
    setGeoError(null);
    setTracking(true);
    hasCenteredRef.current = false;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGeo(fix);
        setGeoError(null);
        if (!hasCenteredRef.current) {
          hasCenteredRef.current = true;
          centerOn(fix);
        }
      },
      (err) => {
        setTracking(false);
        setGeo(null);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "位置情報が許可されていません。端末の設定から許可してください。"
            : "現在地を取得できませんでした。電波状況を確認してください。",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
  }

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
          <RecenterOnGeo target={centerTarget} />
          {visible.map((loc) => (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={loc.kind === "meeting_point" ? meetingPointIcon : toiletIcon}
              eventHandlers={{ click: () => setSelectedId(loc.id) }}
            />
          ))}
          {geo && (
            <>
              <Circle
                center={[geo.lat, geo.lng]}
                radius={geo.accuracy}
                pathOptions={{
                  color: "#2563eb",
                  weight: 1,
                  opacity: 0.4,
                  fillColor: "#2563eb",
                  fillOpacity: 0.08,
                }}
              />
              <Marker
                position={[geo.lat, geo.lng]}
                icon={currentLocationIcon}
                interactive={false}
              />
            </>
          )}
        </MapContainer>

        {/* 現在地ボタン */}
        <button
          type="button"
          onClick={handleLocateTap}
          aria-label="現在地を表示"
          className={`absolute top-3 right-3 z-[1000] flex h-11 w-11 items-center justify-center rounded-full shadow-md ${
            tracking ? "bg-blue-600 text-white" : "bg-white text-slate-600"
          }`}
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="7" />
          </svg>
        </button>

        {geoError && (
          <div className="absolute top-3 left-3 right-16 z-[1000] rounded-xl bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-md">
            {geoError}
          </div>
        )}

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
