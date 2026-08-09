import { useEffect, useState } from "react";
import { useFestivalData } from "../context/FestivalDataContext";
import { loadWeather, type WeatherData } from "../lib/weather";

// 予報地点が未登録でも動くようにするフォールバック(高知市中心部)
const FALLBACK: [number, number] = [33.5597, 133.5388];

/** 祭りの開催エリア(登録場所の重心)の天気予報 */
export function useWeather(): WeatherData | null {
  const { data } = useFestivalData();
  const festivalId = data?.festival.id ?? null;
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!festivalId || !data) return;
    const points = data.locations;
    const lat =
      points.length > 0
        ? points.reduce((s, p) => s + p.lat, 0) / points.length
        : FALLBACK[0];
    const lon =
      points.length > 0
        ? points.reduce((s, p) => s + p.lng, 0) / points.length
        : FALLBACK[1];

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
