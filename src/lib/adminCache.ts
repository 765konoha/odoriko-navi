// 管理画面のデータキャッシュ(localStorage)。
// タブを開いた瞬間は前回取得分を即表示し、裏で最新を取得して置き換える。
// (踊り子側の dataCache と同じ考え方。キャッシュ破損時は無視して通常取得)

import type { Festival } from "../types/domain";

function cacheKey(festivalId: string, key: string): string {
  return `odoriko:admin:${festivalId}:${key}`;
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

const FESTIVALS_KEY = "odoriko:admin:festivalsCache";

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
