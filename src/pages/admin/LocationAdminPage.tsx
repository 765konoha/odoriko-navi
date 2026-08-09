import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import type { Location, LocationKind, VenueRoute } from "../../types/domain";
import {
  createLocation,
  createVenueRoute,
  deleteLocation,
  deleteVenueRoute,
  listLocations,
  listVenueRoutes,
  updateLocation,
  updateVenueRoute,
  type LocationInput,
  type VenueRouteInput,
} from "../../lib/adminApi";
import { meetingPointIcon, toiletIcon } from "../../components/map/markerIcons";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

// 高知市中心部(場所が未登録のときの地図初期位置)
const DEFAULT_CENTER: [number, number] = [33.5597, 133.5388];

function ClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** 演舞会場コースの作成・編集(地図タップで点を追加して折れ線を描く) */
function RouteForm({
  festivalId,
  route,
  onSaved,
  onCancel,
}: {
  festivalId: string;
  route: VenueRoute | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(route?.name ?? "");
  const [description, setDescription] = useState(route?.description ?? "");
  const [path, setPath] = useState<[number, number][]>(route?.path ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (path.length < 2) {
      setError("地図を2回以上タップしてコースの線を描いてください");
      return;
    }
    setSaving(true);
    setError(null);
    const input: VenueRouteInput = {
      festivalId,
      name: name.trim(),
      path,
      description: description.trim() || null,
    };
    try {
      if (route) {
        await updateVenueRoute(route.id, input);
      } else {
        await createVenueRoute(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-bold text-slate-800">
        {route ? "コースを編集" : "演舞会場コースを追加"}
      </h2>

      <label className="block">
        <span className={labelClass}>会場名 *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder="例: 追手筋本部競演場"
        />
      </label>

      <div>
        <div className="flex items-center">
          <span className={labelClass}>
            コース(地図をタップして順に点を追加・{path.length}点)
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setPath((p) => p.slice(0, -1))}
              disabled={path.length === 0}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 disabled:opacity-40"
            >
              1点戻す
            </button>
            <button
              type="button"
              onClick={() => setPath([])}
              disabled={path.length === 0}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-red-600 disabled:opacity-40"
            >
              全部消す
            </button>
          </div>
        </div>
        <div className="mt-1 h-64 overflow-hidden rounded-xl">
          <MapContainer
            center={path[0] ?? DEFAULT_CENTER}
            zoom={16}
            className="h-full w-full"
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ClickPicker
              onPick={(la, ln) => setPath((p) => [...p, [la, ln]])}
            />
            {path.length > 1 && (
              <Polyline
                positions={path}
                pathOptions={{
                  color: "#005D4D",
                  weight: 8,
                  opacity: 0.85,
                  lineCap: "butt",
                  lineJoin: "miter",
                }}
              />
            )}
            {path.map((pt, i) => (
              <CircleMarker
                key={`${i}-${pt[0]}-${pt[1]}`}
                center={pt}
                radius={5}
                pathOptions={{
                  color: "#5b21b6",
                  fillColor: "#ffffff",
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            ))}
          </MapContainer>
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>補足説明</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
          placeholder="例: 流し350m"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-600"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

function LocationForm({
  festivalId,
  location,
  onSaved,
  onCancel,
}: {
  festivalId: string;
  location: Location | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(location?.name ?? "");
  const [kind, setKind] = useState<LocationKind>(
    location?.kind ?? "meeting_point",
  );
  const [lat, setLat] = useState<number | null>(location?.lat ?? null);
  const [lng, setLng] = useState<number | null>(location?.lng ?? null);
  const [address, setAddress] = useState(location?.address ?? "");
  const [description, setDescription] = useState(location?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lat == null || lng == null) {
      setError("地図をタップして位置を指定してください");
      return;
    }
    setSaving(true);
    setError(null);
    const input: LocationInput = {
      festivalId,
      kind,
      name: name.trim(),
      lat,
      lng,
      address: address.trim() || null,
      description: description.trim() || null,
    };
    try {
      if (location) {
        await updateLocation(location.id, input);
      } else {
        await createLocation(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">
        {location ? "場所を編集" : "場所を追加"}
      </h2>

      <label className="block">
        <span className={labelClass}>名前 *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder="例: 追手筋 仮設トイレ"
        />
      </label>

      <label className="block">
        <span className={labelClass}>種別</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as LocationKind)}
          className={inputClass}
        >
          <option value="meeting_point">集合場所</option>
          <option value="toilet">トイレ</option>
        </select>
      </label>

      <div>
        <span className={labelClass}>
          位置(地図をタップして指定)
          {lat != null && lng != null && (
            <span className="ml-2 tabular-nums text-slate-400">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
          )}
        </span>
        <div className="mt-1 h-56 overflow-hidden rounded-xl">
          <MapContainer
            center={lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER}
            zoom={15}
            className="h-full w-full"
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ClickPicker
              onPick={(la, ln) => {
                setLat(la);
                setLng(ln);
              }}
            />
            {lat != null && lng != null && (
              <Marker
                position={[lat, lng]}
                icon={kind === "meeting_point" ? meetingPointIcon : toiletIcon}
              />
            )}
          </MapContainer>
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>住所・場所の説明</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>補足・注意事項</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-600"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

export default function LocationAdminPage() {
  const { festival } = useAdminFestival();
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<VenueRoute[]>([]);
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; location: Location } | null
  >(null);
  const [editingRoute, setEditingRoute] = useState<
    { mode: "new" } | { mode: "edit"; route: VenueRoute } | null
  >(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!festival) return;
    setLoading(true);
    const [locationList, routeList] = await Promise.all([
      listLocations(festival.id),
      listVenueRoutes(festival.id),
    ]);
    setLocations(locationList);
    setRoutes(routeList);
    setLoading(false);
  }, [festival]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!festival) return null;
  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  if (editing) {
    return (
      <LocationForm
        festivalId={festival.id}
        location={editing.mode === "edit" ? editing.location : null}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (editingRoute) {
    return (
      <RouteForm
        festivalId={festival.id}
        route={editingRoute.mode === "edit" ? editingRoute.route : null}
        onSaved={() => {
          setEditingRoute(null);
          void load();
        }}
        onCancel={() => setEditingRoute(null)}
      />
    );
  }

  async function handleDelete(location: Location) {
    if (
      !window.confirm(
        `「${location.name}」を削除しますか?(紐づく予定の集合場所は「なし」になります)`,
      )
    )
      return;
    await deleteLocation(location.id);
    await load();
  }

  async function handleDeleteRoute(route: VenueRoute) {
    if (
      !window.confirm(
        `コース「${route.name}」を削除しますか?(紐づく予定の会場コースは「なし」になります)`,
      )
    )
      return;
    await deleteVenueRoute(route.id);
    await load();
  }

  const meetingPoints = locations.filter((l) => l.kind === "meeting_point");
  const toilets = locations.filter((l) => l.kind === "toilet");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">場所管理</h1>

      <button
        type="button"
        onClick={() => setEditing({ mode: "new" })}
        className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
      >
        + 場所を追加
      </button>

      {(
        [
          ["集合場所", meetingPoints],
          ["トイレ", toilets],
        ] as const
      ).map(([title, list]) => (
        <section key={title}>
          <h2 className="mb-2 text-base font-bold text-slate-700">
            {title}({list.length})
          </h2>
          <div className="space-y-2">
            {list.map((location) => (
              <div
                key={location.id}
                className="rounded-2xl bg-white p-4 shadow-sm"
              >
                <p className="text-base font-bold text-slate-900">
                  {location.name}
                </p>
                {location.address && (
                  <p className="text-sm text-slate-600">{location.address}</p>
                )}
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", location })}
                    className="text-sm font-bold text-blue-700"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(location)}
                    className="text-sm font-bold text-red-600"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
            {list.length === 0 && (
              <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
                未登録です。
              </p>
            )}
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-2 text-base font-bold text-slate-700">
          演舞会場コース({routes.length})
        </h2>
        <button
          type="button"
          onClick={() => setEditingRoute({ mode: "new" })}
          className="mb-2 w-full rounded-xl border-2 border-violet-600 py-2.5 font-bold text-violet-700"
        >
          + コースを追加(地図に線を描く)
        </button>
        <div className="space-y-2">
          {routes.map((route) => (
            <div key={route.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-base font-bold text-slate-900">{route.name}</p>
              <p className="text-sm text-slate-600">
                {route.path.length}点の線
                {route.description ? `・${route.description}` : ""}
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRoute({ mode: "edit", route })}
                  className="text-sm font-bold text-blue-700"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteRoute(route)}
                  className="text-sm font-bold text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
          {routes.length === 0 && (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
              未登録です。スケジュールと紐づけると、踊り子のマップに帯状のラインで表示されます。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
