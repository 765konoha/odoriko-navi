import { useEffect, useState } from "react";
import { useFestivalData } from "../context/FestivalDataContext";
import { loadWeather, type WeatherData } from "../lib/weather";

// 予報地点が未登録でも動くようにするフォールバック(高知市中心部)
const FALLBACK: [number, number] = [33.5597, 133.5388];

/**
 * 祭りの天気予報。
 * 地点は「祭りに登録された予報地点 → 登録場所の重心 → 高知市中心部」の順で決める。
 */
export function useWeather(): WeatherData | null {
  const { data } = useFestivalData();
  const festivalId = data?.festival.id ?? null;
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!festivalId || !data) return;
    const { weatherLat, weatherLng } = data.festival;
    const points = data.locations;
    let lat: number;
    let lon: number;
    if (weatherLat != null && weatherLng != null) {
      lat = weatherLat;
      lon = weatherLng;
    } else if (points.length > 0) {
      lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      lon = points.reduce((s, p) => s + p.lng, 0) / points.length;
    } else {
      [lat, lon] = FALLBACK;
    }

    let cancelled = false;
    void loadWeather(festivalId, lat, lon).then((w) => {
      if (!cancelled) setWeather(w);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festivalId]);

  return weather;
}
