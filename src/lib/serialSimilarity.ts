// 打ち間違いで増えたシリアルを見つけるための、ゆるい比較。
//
// 「K-15」「K015」「k-015」は同じ人のはずなので、踊り子マスタの一覧で
// 「似たシリアルがある」と知らせる。あくまで目安で、統合するかは人が決める。

import { normalizeSerial } from "./serial";

/**
 * 比較用のキー。表記をそろえたうえで、大文字にそろえ、区切り記号を除き、
 * 数字の先頭の0を除く。日本語(「カメラマン」など)はそのまま残る。
 */
export function looseSerialKey(serial: string): string {
  return normalizeSerial(serial)
    .toUpperCase()
    .replace(/[\s\-_./・]/g, "")
    .replace(/\d+/g, (digits) => digits.replace(/^0+(?=\d)/, ""));
}

/** シリアル → 似ている他のシリアル(似ているものが無いシリアルは入らない) */
export function findSimilarSerials(serials: string[]): Map<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const s of serials) {
    const key = looseSerialKey(s);
    byKey.set(key, [...(byKey.get(key) ?? []), s]);
  }
  const result = new Map<string, string[]>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (const s of group) {
      result.set(
        s,
        group.filter((other) => other !== s),
      );
    }
  }
  return result;
}
