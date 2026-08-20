import { useEffect, useState } from "react";
import { useFestivalData } from "../context/FestivalDataContext";
import { festivalCenter } from "../lib/maps";
import { loadWeather, type WeatherData } from "../lib/weather";

/**
 * 祭りの天気予報。
 * 地点は「祭りに登録された予報地点(festivals.weather_lat/lng)→ 登録場所の重心」
 * の順で決める。どちらも無ければ取得せず null(天気は表示しない)。
 */
export function useWeather(): WeatherData | null {
  const { data } = useFestivalData();
  const festivalId = data?.festival.id ?? null;
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!festivalId || !data) return;
    const point = festivalCenter(data.festival, data.locations);
    if (!point) return;

    let cancelled = false;
    void loadWeather(festivalId, point[0], point[1]).then((w) => {
      if (!cancelled) setWeather(w);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festivalId]);

  return weather;
}
