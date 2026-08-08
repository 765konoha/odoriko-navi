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
