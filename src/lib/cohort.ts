// シリアルから期(入団年次)を読む。
//
// シリアルは「下2桁が通し番号、上1〜2桁が期」でできている。
//   001 → 0期の1番 / 012 → 0期の12番 / 615 → 6期の15番 / 1103 → 11期の3番
//
// 頭に記号が付くものが2種類ある。
//   s… スポットナンバー。s を外した残りを同じ規則で読む(s1321 → 13期)
//   k… キッズ枠。期に分けず「k期」としてまとめる(K-010 → k期)
//
// どれにも当てはまらないシリアルは期を決められないので「その他」にまとめる。
// 勝手に推測すると別の期に混ぜてしまうため、判定できないことを明示する。

/** 期として扱う数字の形(下2桁が番号、上1〜2桁が期) */
const COHORT_DIGITS_RE = /^\d{3,4}$/;

export type Cohort =
  /** 0期・11期など。スポットナンバーも期が読めればここに入る */
  | { kind: "number"; value: number }
  /** キッズ枠(k期) */
  | { kind: "kids" }
  /** 期を判定できない */
  | { kind: "unknown" };

const KIDS: Cohort = { kind: "kids" };
const UNKNOWN: Cohort = { kind: "unknown" };

/** シリアルの期 */
export function cohortOf(serial: string): Cohort {
  const s = serial.trim();
  // キッズ枠は番号で分けない(K-010 / k010 のどちらの書き方も拾う)
  if (/^k/i.test(s)) return KIDS;
  // スポットナンバーは s を外して同じ規則で読む
  const digits = /^s/i.test(s) ? s.slice(1) : s;
  if (!COHORT_DIGITS_RE.test(digits)) return UNKNOWN;
  return { kind: "number", value: Number(digits.slice(0, -2)) };
}

/** 期の表示名 */
export function cohortLabel(cohort: Cohort): string {
  if (cohort.kind === "kids") return "k期";
  if (cohort.kind === "unknown") return "その他";
  return `${cohort.value}期`;
}

/** シリアルから直接、期の表示名を得る */
export function cohortLabelOf(serial: string): string {
  return cohortLabel(cohortOf(serial));
}

/** 並び順の重み。数字の期 → k期 → その他 */
function order(cohort: Cohort): [number, number] {
  if (cohort.kind === "number") return [0, cohort.value];
  if (cohort.kind === "kids") return [1, 0];
  return [2, 0];
}

export interface CohortGroup<T> {
  cohort: Cohort;
  label: string;
  items: T[];
}

/**
 * 期ごとにまとめる。期の小さい順、そのあとに k期、末尾がその他。
 * 各期の中の並びは渡された順のまま(呼び出し側でシリアル順に揃えてから渡す)。
 */
export function groupByCohort<T>(
  items: T[],
  serialOf: (item: T) => string,
): CohortGroup<T>[] {
  const groups = new Map<string, CohortGroup<T>>();
  for (const item of items) {
    const cohort = cohortOf(serialOf(item));
    const label = cohortLabel(cohort);
    const found = groups.get(label);
    if (found) found.items.push(item);
    else groups.set(label, { cohort, label, items: [item] });
  }
  return [...groups.values()].sort((a, b) => {
    const [ak, av] = order(a.cohort);
    const [bk, bv] = order(b.cohort);
    return ak - bk || av - bv;
  });
}
