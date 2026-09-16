// シリアルから期(入団年次)を読む。
//
// シリアルは「下2桁が通し番号、上1〜2桁が期」でできている。
//   001 → 0期の1番 / 012 → 0期の12番 / 615 → 6期の15番 / 1103 → 11期の3番
//
// この形に当てはまらないシリアル(K-010 のように記号を含むもの、
// 桁数が違うもの)は期を決められないので「その他」にまとめる。
// 勝手に推測すると別の期に混ぜてしまうため、判定できないことを明示する。

/** 期として扱うシリアルの形(数字3〜4桁) */
const COHORT_SERIAL_RE = /^\d{3,4}$/;

/** シリアルの期。判定できないときは null */
export function cohortOf(serial: string): number | null {
  const s = serial.trim();
  if (!COHORT_SERIAL_RE.test(s)) return null;
  return Number(s.slice(0, -2));
}

/** 期の表示名。判定できないシリアルは「その他」 */
export function cohortLabel(cohort: number | null): string {
  return cohort == null ? "その他" : `${cohort}期`;
}

/** シリアルから直接、期の表示名を得る */
export function cohortLabelOf(serial: string): string {
  return cohortLabel(cohortOf(serial));
}

export interface CohortGroup<T> {
  /** 期(判定できないものは null) */
  cohort: number | null;
  label: string;
  items: T[];
}

/**
 * 期ごとにまとめる。期の小さい順で、判定できないものは末尾。
 * 各期の中の並びは渡された順のまま(呼び出し側でシリアル順に揃えてから渡す)。
 */
export function groupByCohort<T>(
  items: T[],
  serialOf: (item: T) => string,
): CohortGroup<T>[] {
  const byCohort = new Map<number | null, T[]>();
  for (const item of items) {
    const cohort = cohortOf(serialOf(item));
    const list = byCohort.get(cohort);
    if (list) list.push(item);
    else byCohort.set(cohort, [item]);
  }
  return [...byCohort.entries()]
    .sort(([a], [b]) => {
      if (a === b) return 0;
      if (a == null) return 1; // その他は末尾
      if (b == null) return -1;
      return a - b;
    })
    .map(([cohort, list]) => ({
      cohort,
      label: cohortLabel(cohort),
      items: list,
    }));
}
