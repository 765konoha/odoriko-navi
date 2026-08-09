import { useWeather } from "../../hooks/useWeather";
import { weatherMeta } from "../../lib/weather";

/** ホーム用: 現在時刻から12時間分の毎時予報 */
export default function WeatherStrip() {
  const weather = useWeather();

  if (!weather || weather.hourly.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-700">天気予報</h2>
      <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-1">
        {weather.hourly.map((h) => {
          const meta = weatherMeta(h.weatherCode);
          return (
            <div
              key={h.time}
              className="flex w-[3.4rem] shrink-0 flex-col items-center gap-0.5 rounded-lg bg-slate-50 px-1 py-2"
            >
              <span className="text-xs text-slate-500">
                {new Date(h.time).getHours()}時
              </span>
              <span className="text-xl leading-none" title={meta.label}>
                {meta.emoji}
              </span>
              <span className="text-sm font-bold tabular-nums text-slate-900">
                {Math.round(h.temperature)}°
              </span>
              <span className="text-[10px] tabular-nums text-blue-500">
                {h.precipitationProbability != null
                  ? `💧${h.precipitationProbability}%`
                  : " "}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
