import { useEffect, useState, type FormEvent } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import type { Festival } from "../../types/domain";
import {
  createFestival,
  updateFestival,
  type FestivalInput,
} from "../../lib/adminApi";
import { searchPlaces, type GeocodingResult } from "../../lib/weather";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

// 地点未指定時は日本全体を表示(祭りはどの地域でもあり得るため)
const JAPAN_CENTER: [number, number] = [36.5, 137.8];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function ClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** 地名検索の選択時に地図を選んだ地点へ移動する */
function RecenterOnPick({ point }: { point: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView(point, Math.max(map.getZoom(), 12));
  }, [map, point]);
  return null;
}

function FestivalForm({
  festival,
  onSaved,
  onCancel,
}: {
  festival: Festival | null;
  onSaved: (createdId: string | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(festival?.name ?? "");
  const [slug, setSlug] = useState(festival?.slug ?? "");
  const [lat, setLat] = useState<number | null>(festival?.weatherLat ?? null);
  const [lng, setLng] = useState<number | null>(festival?.weatherLng ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const point: [number, number] | null =
    lat != null && lng != null ? [lat, lng] : null;

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchPlaces(q));
    } catch {
      setError("地名の検索に失敗しました(通信環境を確認してください)");
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedSlug = slug.trim();
    if (!SLUG_PATTERN.test(trimmedSlug)) {
      setError(
        "IDは半角の小文字英数字とハイフンで入力してください(例: harajuku-2026)",
      );
      return;
    }
    setSaving(true);
    setError(null);
    const input: FestivalInput = {
      slug: trimmedSlug,
      name: name.trim(),
      weatherLat: lat,
      weatherLng: lng,
    };
    try {
      if (festival) {
        await updateFestival(festival.id, input);
        onSaved(null);
      } else {
        onSaved(await createFestival(input));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存に失敗しました";
      setError(
        message.includes("duplicate")
          ? `ID「${trimmedSlug}」は既に使われています`
          : message,
      );
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-bold text-slate-800">
        {festival ? "祭りを編集" : "祭りを追加"}
      </h2>

      <label className="block">
        <span className={labelClass}>祭りの名前 *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder="例: 2026年 原宿よさこい"
        />
      </label>

      <label className="block">
        <span className={labelClass}>ID(共有URLの一部)*</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className={inputClass}
          placeholder="例: harajuku-2026"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <span className="mt-1 block text-xs text-slate-500">
          半角の小文字英数字とハイフン。踊り子に共有するURLが
          「…/#/{slug.trim() || "harajuku-2026"}」になります。
          {festival && "変更すると共有済みのURLが無効になるので注意。"}
        </span>
      </label>

      <div>
        <span className={labelClass}>
          天気予報の取得地点
          {point && (
            <span className="ml-2 tabular-nums text-slate-400">
              {point[0].toFixed(4)}, {point[1].toFixed(4)}
            </span>
          )}
        </span>
        <p className="mt-0.5 text-xs text-slate-500">
          地名で検索するか、地図をタップして指定します。ホーム画面の天気は
          この地点の予報を表示します(未指定なら登録場所の中心で代替)。
        </p>

        <div className="mt-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // フォーム送信(保存)ではなく検索を実行する
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSearch();
              }
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
            placeholder="例: 渋谷区"
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={searching || !query.trim()}
            className="shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {searching ? "検索中…" : "検索"}
          </button>
        </div>

        {results && (
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
            {results.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-500">
                見つかりませんでした。市区町村名などで試してください。
              </p>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.latitude}-${r.longitude}-${i}`}
                type="button"
                onClick={() => {
                  setLat(r.latitude);
                  setLng(r.longitude);
                  setResults(null);
                }}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 active:bg-slate-50"
              >
                <span className="font-bold text-slate-800">{r.name}</span>
                {r.admin1 && (
                  <span className="ml-2 text-slate-500">{r.admin1}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 h-56 overflow-hidden rounded-xl">
          <MapContainer
            center={point ?? JAPAN_CENTER}
            zoom={point ? 13 : 5}
            className="h-full w-full"
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ClickPicker
              onPick={(la, ln) => {
                setLat(la);
                setLng(ln);
              }}
            />
            <RecenterOnPick point={point} />
            {point && (
              <CircleMarker
                center={point}
                radius={9}
                pathOptions={{
                  color: "#1d4ed8",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.6,
                  weight: 2,
                }}
              />
            )}
          </MapContainer>
        </div>
      </div>

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

export default function FestivalAdminPage() {
  const { festivals, loading, reload, selectFestival } = useAdminFestival();
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; festival: Festival } | null
  >(null);

  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  if (editing) {
    return (
      <FestivalForm
        festival={editing.mode === "edit" ? editing.festival : null}
        onSaved={(createdId) => {
          setEditing(null);
          void reload().then(() => {
            // 追加した祭りをそのまま操作対象にする
            if (createdId) selectFestival(createdId);
          });
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">祭り管理</h1>

      <button
        type="button"
        onClick={() => setEditing({ mode: "new" })}
        className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
      >
        + 祭りを追加
      </button>

      <div className="space-y-2">
        {festivals.map((festival) => (
          <div key={festival.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-base font-bold text-slate-900">
              {festival.name}
            </p>
            <p className="text-sm text-slate-600">
              ID: {festival.slug}・天気予報地点:{" "}
              {festival.weatherLat != null && festival.weatherLng != null ? (
                <span className="font-bold text-emerald-700">設定済み</span>
              ) : (
                <span className="font-bold text-amber-700">未設定</span>
              )}
            </p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setEditing({ mode: "edit", festival })}
                className="text-sm font-bold text-blue-700"
              >
                編集
              </button>
            </div>
          </div>
        ))}
        {festivals.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            祭りが未登録です。「+ 祭りを追加」から登録してください。
          </p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        ※ 開催日・予定・場所・お知らせは、画面上部のプルダウンで祭りを
        切り替えてから各タブで登録します。
      </p>
    </div>
  );
}
