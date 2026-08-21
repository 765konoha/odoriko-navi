import { useState, type FormEvent } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Location, LocationKind } from "../../types/domain";
import {
  createLocation,
  updateLocation,
  type LocationInput,
} from "../../lib/adminApi";
import { meetingPointIcon, toiletIcon } from "../map/markerIcons";
import { JAPAN_VIEW } from "../../lib/maps";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

function ClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * 場所(集合場所・トイレ)の追加・編集フォーム。
 * 場所管理と予定フォーム(集合場所の新規追加)の両方から使う。
 */
export default function LocationForm({
  festivalId,
  location,
  defaultCenter,
  fixedKind,
  onSaved,
  onCancel,
}: {
  festivalId: string;
  location: Location | null;
  /** 未入力時の地図初期位置(祭りの基準地点)。null なら日本全体表示 */
  defaultCenter: [number, number] | null;
  /** 種別を固定する(予定フォームからは集合場所のみ追加させる) */
  fixedKind?: LocationKind;
  onSaved: (saved: Location) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(location?.name ?? "");
  const [kind, setKind] = useState<LocationKind>(
    location?.kind ?? fixedKind ?? "meeting_point",
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
        onSaved({
          ...location,
          kind,
          name: input.name,
          lat,
          lng,
          address: input.address ?? undefined,
          description: input.description ?? undefined,
        });
      } else {
        onSaved(await createLocation(input));
      }
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

      {fixedKind == null && (
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
      )}

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
            center={
              lat != null && lng != null
                ? [lat, lng]
                : (defaultCenter ?? JAPAN_VIEW.center)
            }
            zoom={
              (lat != null && lng != null) || defaultCenter
                ? 15
                : JAPAN_VIEW.zoom
            }
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
