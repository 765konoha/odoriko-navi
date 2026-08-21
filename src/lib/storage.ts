import type { Festival, FestivalData } from "../types/domain";

// 端末内(localStorage)の既読・確認済み管理。
// 踊り子はログインしないため、既読状態は端末単位で保持する。
// キーは祭りスラッグ+利用者(シリアル or anonymous)でスコープする。

/** 利用者(シリアル選択)の localStorage キー用識別子 */
export type UserKey = string; // シリアル or "anonymous"

function readKey(slug: string, userKey: UserKey): string {
  return `odoriko:${slug}:${userKey}:readAnnouncements`;
}

function ackKey(slug: string, userKey: UserKey): string {
  return `odoriko:${slug}:${userKey}:ackedEmergencies`;
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

export function loadReadIds(slug: string, userKey: UserKey): string[] {
  return loadIds(readKey(slug, userKey));
}

export function saveReadIds(
  slug: string,
  userKey: UserKey,
  ids: string[],
): void {
  saveIds(readKey(slug, userKey), ids);
}

export function loadAckedIds(slug: string, userKey: UserKey): string[] {
  return loadIds(ackKey(slug, userKey));
}

export function saveAckedIds(
  slug: string,
  userKey: UserKey,
  ids: string[],
): void {
  saveIds(ackKey(slug, userKey), ids);
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
    // 旧バージョンで保存されたスナップショットとの互換
    value.data.roles = value.data.roles ?? [];
    value.data.participants = value.data.participants ?? [];
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

// ---------- 利用者(シリアル)選択 ----------

const USER_SELECTION_KEY = "odoriko:userSelection";
const SERIAL_LIST_KEY = "odoriko:participantSerials";

/** serial=null は「番号指定なし」。未選択(初回)は null を返す。 */
export interface UserSelection {
  serial: string | null;
}

export function loadUserSelection(): UserSelection | null {
  try {
    const raw = localStorage.getItem(USER_SELECTION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as UserSelection;
    if (typeof value !== "object" || value === null) return null;
    return { serial: typeof value.serial === "string" ? value.serial : null };
  } catch {
    return null;
  }
}

export function saveUserSelection(selection: UserSelection): void {
  try {
    localStorage.setItem(USER_SELECTION_KEY, JSON.stringify(selection));
  } catch {
    // ストレージ不可でも動作継続
  }
}

/** オフラインでも選択画面を出せるようマスターのシリアル一覧をキャッシュする */
export function loadSerialListCache(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(SERIAL_LIST_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveSerialListCache(serials: string[]): void {
  try {
    localStorage.setItem(SERIAL_LIST_KEY, JSON.stringify(serials));
  } catch {
    // ストレージ不可でも動作継続
  }
}
