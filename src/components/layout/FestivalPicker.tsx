import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Festival } from "../../types/domain";
import { repository } from "../../repositories";
import {
  loadFestivalListCache,
  saveFestivalListCache,
} from "../../lib/storage";
import { useFestivalData } from "../../context/FestivalDataContext";

// 同じ画面で複数の場所(ヘッダーの祭り名とモード切替のカード)が使うため、
// 同時に走った取得はひとつにまとめる
let inFlight: Promise<Festival[]> | null = null;

function fetchList(): Promise<Festival[]> {
  inFlight ??= repository.listFestivals().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** 祭りの一覧。まずキャッシュを返し、裏で最新を取りに行く(オフラインでも選べる) */
export function useFestivalList(): Festival[] {
  const [festivals, setFestivals] = useState<Festival[]>(() =>
    loadFestivalListCache(),
  );

  useEffect(() => {
    let cancelled = false;
    void fetchList()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setFestivals(list);
        saveFestivalListCache(list);
      })
      .catch(() => {
        // 取得失敗(オフライン等)はキャッシュのまま
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return festivals;
}

/**
 * 祭りを選ぶプルダウン。
 * 祭りを選ぶのはモードを切り替えるときだけなので、
 * ヘッダーではなくモード切替のカードに置く。
 * 終了した祭りも見返せるように「過去の祭り」として残す。
 */
export function FestivalSelect({
  festivals,
  value,
  onChange,
  fallbackName = "",
}: {
  festivals: Festival[];
  value: string;
  onChange: (slug: string) => void;
  /** 一覧に無い祭りを開いている場合に出す名前 */
  fallbackName?: string;
}) {
  const active = festivals.filter((f) => f.isActive);
  const past = festivals.filter((f) => !f.isActive);
  const currentName =
    festivals.find((f) => f.slug === value)?.name || fallbackName;
  const unlisted = value !== "" && !festivals.some((f) => f.slug === value);

  // 選べる先が無いなら祭り名の表示だけにする
  if (festivals.length <= 1 && !unlisted) {
    return currentName ? (
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">
        {currentName}
      </span>
    ) : null;
  }

  return (
    <label className="relative flex min-w-0 flex-1 items-center">
      <span className="sr-only">祭りを選ぶ</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none truncate rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-2 pr-7 text-sm font-bold text-slate-700"
      >
        {active.map((f) => (
          <option key={f.id} value={f.slug}>
            {f.name}
          </option>
        ))}
        {past.length > 0 && (
          <optgroup label="過去の祭り">
            {past.map((f) => (
              <option key={f.id} value={f.slug}>
                {f.name}
              </option>
            ))}
          </optgroup>
        )}
        {unlisted && <option value={value}>{currentName || value}</option>}
      </select>
      <svg
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}

/**
 * ヘッダーに出す祭り名(切替はしない)。
 * 予定・マップ・お知らせを見ているときに、どの祭りのものかを見失わないようにする。
 */
export function FestivalHeaderName() {
  const { festivalSlug } = useParams();
  const { data } = useFestivalData();
  const festivals = useFestivalList();
  const name =
    data?.festival.name ??
    festivals.find((f) => f.slug === festivalSlug)?.name ??
    "";
  if (!name) return null;
  return (
    <span className="max-w-44 shrink-0 truncate text-sm font-bold text-slate-700">
      {name}
    </span>
  );
}
