import type { Festival, FestivalData } from "../types/domain";

// 端末内(localStorage)の既読・確認済み管理。
// 踊り子はログインしないため、既読状態は端末単位で保持する。
// キーは祭りスラッグでスコープする(複数祭り対応)。

function readKey(slug: string): string {
  return `odoriko:${slug}:readAnnouncements`;
}

function ackKey(slug: string): string {
  return `odoriko:${slug}:ackedEmergencies`;
}

function loadIds(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // ストレージ不可(プライベートモード等)でもアプリは動作させる
  }
}

export function loadReadIds(slug: string): string[] {
  return loadIds(readKey(slug));
}

export function saveReadIds(slug: string, ids: string[]): void {
  saveIds(readKey(slug), ids);
}

export function loadAckedIds(slug: string): string[] {
  return loadIds(ackKey(slug));
}

export function saveAckedIds(slug: string, ids: string[]): void {
  saveIds(ackKey(slug), ids);
}

// ---------- オフライン用データスナップショット ----------

interface CachedFestivalData {
  data: FestivalData;
  /** 取得成功時刻(ISO) */
  fetchedAt: string;
}

function cacheKey(slug: string): string {
  return `odoriko:${slug}:dataCache`;
}

export function loadDataCache(slug: string): CachedFestivalData | null {
  try {
    const raw = localStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    const value = JSON.parse(raw) as CachedFestivalData;
    if (!value?.data?.festival || !value.fetchedAt) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveDataCache(slug: string, data: FestivalData): void {
  try {
    localStorage.setItem(
      cacheKey(slug),
      JSON.stringify({ data, fetchedAt: new Date().toISOString() }),
    );
  } catch {
    // 容量超過等は無視(オンライン時は通常動作に影響しない)
  }
}

// ---------- 祭り切替(ヘッダーのプルダウン) ----------

const FESTIVAL_LIST_KEY = "odoriko:festivalList";
const LAST_FESTIVAL_KEY = "odoriko:lastFestivalSlug";

/** オフライン時もプルダウンを出せるよう祭り一覧をキャッシュする */
export function loadFestivalListCache(): Festival[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(FESTIVAL_LIST_KEY) ?? "[]",
    ) as Festival[];
    return Array.isArray(value)
      ? value.filter((f) => f && typeof f.slug === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveFestivalListCache(festivals: Festival[]): void {
  try {
    localStorage.setItem(FESTIVAL_LIST_KEY, JSON.stringify(festivals));
  } catch {
    // ストレージ不可でも動作継続
  }
}

/** 最後に表示した祭り(ルート直下アクセス時のリダイレクト先に使う) */
export function loadLastFestivalSlug(): string | null {
  try {
    return localStorage.getItem(LAST_FESTIVAL_KEY);
  } catch {
    return null;
  }
}

export function saveLastFestivalSlug(slug: string): void {
  try {
    localStorage.setItem(LAST_FESTIVAL_KEY, slug);
  } catch {
    // ストレージ不可でも動作継続
  }
}
