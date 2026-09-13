// 管理画面のデータキャッシュ(localStorage)。
// タブを開いた瞬間は前回取得分を即表示し、裏で最新を取得して置き換える。
// (踊り子側の dataCache と同じ考え方。キャッシュ破損時は無視して通常取得)

import type { Festival } from "../types/domain";

/** 管理画面のキャッシュにだけ付く接頭辞 */
const ADMIN_PREFIX = "odoriko:admin:";

function cacheKey(festivalId: string, key: string): string {
  return `${ADMIN_PREFIX}${festivalId}:${key}`;
}

export function loadAdminCache<T>(festivalId: string, key: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(festivalId, key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveAdminCache<T>(
  festivalId: string,
  key: string,
  value: T,
): void {
  try {
    localStorage.setItem(cacheKey(festivalId, key), JSON.stringify(value));
  } catch {
    // 容量超過等は無視(次回はサーバー取得のみになるだけ)
  }
}

const FESTIVALS_KEY = `${ADMIN_PREFIX}festivalsCache`;

export function loadAdminFestivalsCache(): Festival[] {
  try {
    const value = JSON.parse(localStorage.getItem(FESTIVALS_KEY) ?? "[]");
    return Array.isArray(value) ? (value as Festival[]) : [];
  } catch {
    return [];
  }
}

export function saveAdminFestivalsCache(festivals: Festival[]): void {
  try {
    localStorage.setItem(FESTIVALS_KEY, JSON.stringify(festivals));
  } catch {
    // 無視
  }
}

// ---------- 最後に開いた祭り(旧URLからのリダイレクト先に使う) ----------

const LAST_SLUG_KEY = `${ADMIN_PREFIX}festivalSlug`;

export function saveAdminFestivalSlug(slug: string): void {
  try {
    localStorage.setItem(LAST_SLUG_KEY, slug);
  } catch {
    // ストレージ不可でも管理画面は動作させる
  }
}

export function loadAdminFestivalSlug(): string | null {
  try {
    return localStorage.getItem(LAST_SLUG_KEY);
  } catch {
    return null;
  }
}

// ---------- ログアウト時の後始末 ----------

/**
 * 管理画面だけのキーか。
 * 踊り子側のキー(odoriko:{祭りのslug}:… / odoriko:userSelection など)は
 * 消してはいけないので、接頭辞が完全に一致するものだけを対象にする。
 */
export function isAdminCacheKey(key: string): boolean {
  return key.startsWith(ADMIN_PREFIX);
}

/**
 * 管理画面のキャッシュだけを消す(ログアウトが成功したときに呼ぶ)。
 *
 * localStorage.clear() は使わない。踊り子側の既読・確認済み・利用者選択・
 * 祭りのスナップショット・プッシュ購読が同じ端末に同居しているため。
 * Supabase のセッションキーもここでは触らない(signOut に任せる)。
 *
 * 走査しながら消すと添字がずれて取りこぼすので、先に集めてから消す。
 */
export function clearAdminCache(
  storage: Pick<Storage, "length" | "key" | "removeItem"> = localStorage,
): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key != null && isAdminCacheKey(key)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // ストレージを触れない環境でもログアウト自体は成功させる
  }
}
