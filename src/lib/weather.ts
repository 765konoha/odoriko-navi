import { supabase } from "./supabase";

// 天気予報(Open-Meteo・無料/APIキー不要)。
// API呼び出しを抑えるため、取得結果はSupabaseのテーブルに書き込み全端末で共有する。
// 「最後の取得から1時間経過後、最初にアプリを開いた端末」が更新を代行する。

export interface WeatherHour {
  /** ISO時刻(正時) */
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationProbability: number | null;
}

export interface WeatherDay {
  /** YYYY-MM-DD */
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

export interface WeatherData {
  hourly: WeatherHour[];
  daily: WeatherDay[];
}

/** WMO weather code → 表示用の絵文字とラベル */
export function weatherMeta(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "快晴" };
  if (code === 1) return { emoji: "🌤️", label: "晴れ" };
  if (code === 2) return { emoji: "⛅", label: "晴れ時々曇り" };
  if (code === 3) return { emoji: "☁️", label: "曇り" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "霧" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "霧雨" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "雨" };
  if (code >= 71 && code <= 77) return { emoji: "❄️", label: "雪" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", label: "にわか雨" };
  if (code >= 85 && code <= 86) return { emoji: "❄️", label: "雪" };
  if (code >= 95) return { emoji: "⛈️", label: "雷雨" };
  return { emoji: "🌡️", label: "—" };
}

const FRESH_MS = 60 * 60 * 1000; // 1時間

// ---------- 地名検索(管理画面の天気予報地点の指定に使う) ----------

export interface GeocodingResult {
  /** 地名(例: 渋谷区) */
  name: string;
  /** 都道府県など上位の行政区分 */
  admin1?: string;
  latitude: number;
  longitude: number;
}

/**
 * Open-Meteo のジオコーディングAPIで地名から緯度・経度を検索する。
 * 予報API(latitude/longitude 指定)と同じ Open-Meteo の仕様に合わせた指定方法。
 */
export async function searchPlaces(query: string): Promise<GeocodingResult[]> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(query)}&count=8&language=ja&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const json = (await res.json()) as {
    results?: {
      name: string;
      admin1?: string;
      latitude: number;
      longitude: number;
    }[];
  };
  return (json.results ?? []).map((r) => ({
    name: r.name,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

interface FetchedWeather {
  hourly: WeatherHour[];
  daily: WeatherDay[];
}

async function fetchOpenMeteo(lat: number, lon: number): Promise<FetchedWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=Asia%2FTokyo&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const json = (await res.json()) as {
    hourly: {
      time: string[];
      temperature_2m: number[];
      weather_code: number[];
      precipitation_probability: (number | null)[];
    };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
    };
  };

  const hourly: WeatherHour[] = json.hourly.time.map((t, i) => ({
    // Open-MeteoはJSTのローカル時刻文字列を返すのでオフセットを付与
    time: new Date(`${t}:00+09:00`).toISOString(),
    temperature: json.hourly.temperature_2m[i],
    weatherCode: json.hourly.weather_code[i],
    precipitationProbability: json.hourly.precipitation_probability[i] ?? null,
  }));
  const daily: WeatherDay[] = json.daily.time.map((d, i) => ({
    date: d,
    weatherCode: json.daily.weather_code[i],
    tempMax: json.daily.temperature_2m_max[i],
    tempMin: json.daily.temperature_2m_min[i],
  }));
  return { hourly, daily };
}

/** 現在時刻の正時(この時刻以降の12時間分を表示する) */
function currentHourIso(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

// 同時アクセスで多重更新しないための進行中プロミス
let inflightRefresh: Promise<void> | null = null;

async function ensureFreshCache(
  festivalId: string,
  lat: number,
  lon: number,
): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase
    .from("weather_daily")
    .select("fetched_at")
    .eq("festival_id", festivalId)
    .order("fetched_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.fetched_at as string | undefined;
  if (last && Date.now() - new Date(last).getTime() < FRESH_MS) return;

  const fetched = await fetchOpenMeteo(lat, lon);
  const fetchedAt = new Date().toISOString();
  const from = Date.now() - 2 * 60 * 60 * 1000;
  const to = Date.now() + 48 * 60 * 60 * 1000;
  const hourlyRows = fetched.hourly
    .filter((h) => {
      const t = new Date(h.time).getTime();
      return t >= from && t <= to;
    })
    .map((h) => ({
      festival_id: festivalId,
      time: h.time,
      temperature: h.temperature,
      weather_code: h.weatherCode,
      precipitation_probability: h.precipitationProbability,
      fetched_at: fetchedAt,
    }));
  const dailyRows = fetched.daily.map((d) => ({
    festival_id: festivalId,
    date: d.date,
    weather_code: d.weatherCode,
    temp_max: d.tempMax,
    temp_min: d.tempMin,
    fetched_at: fetchedAt,
  }));

  await supabase
    .from("weather_hourly")
    .upsert(hourlyRows, { onConflict: "festival_id,time" });
  await supabase
    .from("weather_daily")
    .upsert(dailyRows, { onConflict: "festival_id,date" });
  // 24時間より前の毎時データは掃除
  await supabase
    .from("weather_hourly")
    .delete()
    .eq("festival_id", festivalId)
    .lt("time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
}

/**
 * 天気を取得する。
 * Supabase接続時: DBキャッシュ(1時間毎更新)経由。未接続(mock)時: 直接取得。
 * 失敗時は null(画面には何も出さない)。
 */
export async function loadWeather(
  festivalId: string,
  lat: number,
  lon: number,
): Promise<WeatherData | null> {
  try {
    if (!supabase) {
      const fetched = await fetchOpenMeteo(lat, lon);
      const fromIso = currentHourIso();
      return {
        hourly: fetched.hourly.filter((h) => h.time >= fromIso).slice(0, 12),
        daily: fetched.daily,
      };
    }

    if (!inflightRefresh) {
      inflightRefresh = ensureFreshCache(festivalId, lat, lon).finally(() => {
        inflightRefresh = null;
      });
    }
    await inflightRefresh;

    const [hourlyRes, dailyRes] = await Promise.all([
      supabase
        .from("weather_hourly")
        .select("time, temperature, weather_code, precipitation_probability")
        .eq("festival_id", festivalId)
        .gte("time", currentHourIso())
        .order("time")
        .limit(12),
      supabase
        .from("weather_daily")
        .select("date, weather_code, temp_max, temp_min")
        .eq("festival_id", festivalId)
        .order("date"),
    ]);
    if (hourlyRes.error || dailyRes.error) return null;

    return {
      hourly: (hourlyRes.data ?? []).map((r) => ({
        time: r.time as string,
        temperature: Number(r.temperature),
        weatherCode: r.weather_code as number,
        precipitationProbability:
          r.precipitation_probability == null
            ? null
            : Number(r.precipitation_probability),
      })),
      daily: (dailyRes.data ?? []).map((r) => ({
        date: r.date as string,
        weatherCode: r.weather_code as number,
        tempMax: Number(r.temp_max),
        tempMin: Number(r.temp_min),
      })),
    };
  } catch {
    return null;
  }
}
