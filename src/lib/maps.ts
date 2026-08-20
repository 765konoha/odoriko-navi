import type { Festival, Location } from "../types/domain";

/** Google Maps の経路検索を開く外部リンク(APIキー不要) */
export function googleMapsRouteUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

/** 基準地点が決められないときのフォールバック(日本全体が収まる表示) */
export const JAPAN_VIEW = {
  center: [36.5, 137.8] as [number, number],
  zoom: 5,
};

/**
 * 祭りの地図の基準地点。
 * festivals の天気予報地点(weather_lat/lng)→ 登録場所の重心 の順で決める。
 * どちらも無ければ null(呼び出し側で JAPAN_VIEW にフォールバックする)。
 */
export function festivalCenter(
  festival: Pick<Festival, "weatherLat" | "weatherLng"> | null | undefined,
  locations: Pick<Location, "lat" | "lng">[],
): [number, number] | null {
  if (festival?.weatherLat != null && festival?.weatherLng != null) {
    return [festival.weatherLat, festival.weatherLng];
  }
  if (locations.length > 0) {
    return [
      locations.reduce((s, p) => s + p.lat, 0) / locations.length,
      locations.reduce((s, p) => s + p.lng, 0) / locations.length,
    ];
  }
  return null;
}
