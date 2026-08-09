import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFestivalData } from "../../context/FestivalDataContext";
import type {
  Location,
  LocationKind,
  ScheduleItem,
  VenueRoute,
} from "../../types/domain";
import {
  currentLocationIcon,
  meetingPointIcon,
  toiletIcon,
} from "../../components/map/markerIcons";
import LocationDetailCard from "../../components/map/LocationDetailCard";
import VenueRouteCard from "../../components/map/VenueRouteCard";
import RefreshIndicator from "../../components/layout/RefreshIndicator";

/** 予定カードからの遷移・現在地表示で使う拡大率 */
const FOCUS_ZOOM = 18;

interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
}

/** 予定カードから遷移してきた場合: その集合場所を中心に表示 */
function FocusView({ focus }: { focus: Location | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], FOCUS_ZOOM);
    // 初期表示のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** 予定カードの「演舞会場」から遷移してきた場合: コース全体が収まる表示 */
function FocusRouteView({ route }: { route: VenueRoute | null }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.path.length > 0) {
      map.fitBounds(L.latLngBounds(route.path), {
        padding: [50, 50],
        maxZoom: 17,
      });
    }
    // 初期表示のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** 現在地取得に失敗した場合のフォールバック: 全ピンが収まる表示 */
function FitAllView({
  locations,
  trigger,
}: {
  locations: Location[];
  trigger: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0 && locations.length > 0) {
      map.fitBounds(
        L.latLngBounds(locations.map((l) => [l.lat, l.lng])),
        { padding: [40, 40], maxZoom: 16 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

/** 現在地ボタン・自動測位で地図を移動する */
function RecenterOnGeo({
  target,
}: {
  target: (GeoFix & { seq: number }) | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], FOCUS_ZOOM);
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
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("loc"),
  );
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(
    searchParams.get("route"),
  );

  // 現在地
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [centerTarget, setCenterTarget] = useState<
    (GeoFix & { seq: number }) | null
  >(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredRef = useRef(false);
  const seqRef = useRef(0);
  const autoStartedRef = useRef(false);

  const locations = useMemo(() => data?.locations ?? [], [data]);
  const focus = useMemo(
    () => locations.find((l) => l.id === searchParams.get("loc")) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations],
  );
  const focusRoute = useMemo(
    () =>
      (data?.venueRoutes ?? []).find(
        (r) => r.id === searchParams.get("route"),
      ) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  function centerOn(fix: GeoFix) {
    seqRef.current += 1;
    setCenterTarget({ ...fix, seq: seqRef.current });
  }

  /**
   * 現在地の追跡を開始する。
   * silent=true(タブを開いた時の自動測位)では、拒否・失敗時にエラーを
   * 表示せず全ピン表示にフォールバックする。
   */
  function startTracking(silent: boolean) {
    if (!("geolocation" in navigator)) {
      if (silent) setFitTrigger((n) => n + 1);
      else setGeoError("この端末では位置情報を利用できません。");
      return;
    }
    if (!silent) setGeoError(null);
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
        if (silent) {
          setFitTrigger((n) => n + 1);
        } else {
          setGeoError(
            err.code === err.PERMISSION_DENIED
              ? "位置情報が許可されていません。端末の設定から許可してください。"
              : "現在地を取得できませんでした。電波状況を確認してください。",
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
  }

  // マップタブを直接開いた場合(予定カード経由でない場合)は現在地を中心に表示
  useEffect(() => {
    if (loading || autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (!searchParams.get("loc") && !searchParams.get("route")) {
      startTracking(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // 画面を離れたら追跡を停止(バッテリー節約)
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function handleLocateTap() {
    // 追跡中の再タップ → 現在地へ戻る
    if (tracking && geo) {
      centerOn(geo);
      return;
    }
    startTracking(false);
  }

  const visible = locations.filter((l) => showKind[l.kind]);
  const selected = locations.find((l) => l.id === selectedId) ?? null;
  const venueRoutes = data?.venueRoutes ?? [];
  const selectedRoute =
    venueRoutes.find((r) => r.id === selectedRouteId) ?? null;

  /** コースに紐づく演舞(中止除く)。全完了なら「踊り済み」色にする */
  function routeStatus(routeId: string): {
    items: ScheduleItem[];
    danced: boolean;
  } {
    const items = (data?.scheduleItems ?? []).filter(
      (s) => s.venueRouteId === routeId && !s.isCancelled,
    );
    return {
      items,
      danced: items.length > 0 && items.every((i) => i.isCompleted),
    };
  }

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
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {(
          [
            ["meeting_point", "集合場所"],
            ["toilet", "トイレ"],
          ] as const
        ).map(([kind, label]) => (
          <label
            key={kind}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${
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
        <label
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${
            showRoutes ? "bg-slate-900 text-white" : "bg-white text-slate-500"
          }`}
        >
          <input
            type="checkbox"
            checked={showRoutes}
            onChange={(e) => setShowRoutes(e.target.checked)}
            className="h-4 w-4"
          />
          演舞会場
        </label>
        <div className="ml-auto shrink-0 self-center">
          <RefreshIndicator />
        </div>
      </div>

      <div className="relative flex-1">
        <MapContainer
          center={[33.5597, 133.5388]}
          zoom={FOCUS_ZOOM}
          className="absolute inset-0 z-0"
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <FocusView focus={focus} />
          <FocusRouteView route={focusRoute} />
          <FitAllView locations={locations} trigger={fitTrigger} />
          <RecenterOnGeo target={centerTarget} />
          {/* 演舞会場コース(帯状ライン)。全演舞完了でグレーに変わる */}
          {showRoutes &&
            venueRoutes.map((route) => {
              const { danced } = routeStatus(route.id);
              const select = () => {
                setSelectedRouteId(route.id);
                setSelectedId(null);
              };
              return (
                <Fragment key={route.id}>
                  <Polyline
                    positions={route.path}
                    pathOptions={{
                      color: danced ? "#64748b" : "#005D4D",
                      weight: 14,
                      opacity: 0.9,
                      lineCap: "square",
                      lineJoin: "miter",
                    }}
                    eventHandlers={{ click: select }}
                  />
                  <Polyline
                    positions={route.path}
                    pathOptions={{
                      color: danced ? "#cbd5e1" : "#D3E173",
                      weight: 10,
                      opacity: 1,
                      lineCap: "square",
                      lineJoin: "miter",
                    }}
                    eventHandlers={{ click: select }}
                  />
                </Fragment>
              );
            })}
          {visible.map((loc) => (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={loc.kind === "meeting_point" ? meetingPointIcon : toiletIcon}
              eventHandlers={{
                click: () => {
                  setSelectedId(loc.id);
                  setSelectedRouteId(null);
                },
              }}
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

        {!selected && selectedRoute && (
          <VenueRouteCard
            route={selectedRoute}
            relatedItems={routeStatus(selectedRoute.id).items}
            danced={routeStatus(selectedRoute.id).danced}
            onClose={() => setSelectedRouteId(null)}
          />
        )}
      </div>
    </div>
  );
}
