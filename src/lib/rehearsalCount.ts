// リハの出欠集計に入れる人を決める。
//
// 名簿の全員で数えると、リハに出ないマネージャーなどが「未回答」に入る。
// 役職ごとの「リハ集計に含める」(festival_roles.counts_in_rehearsal)が
// 付いた役職を1つでも持つ人だけを数える。
// 設定を読めない(列がまだ無い等)ときは、今までどおり名簿の全員を数える。

import type { Attendance } from "../types/rehearsal";

/** 集計に入れる人のシリアル。countedRoleIds が null なら全員 */
export function countedSerials(
  people: { serial: string; roleIds: string[] }[],
  countedRoleIds: Set<string> | null,
): Set<string> {
  return new Set(
    people
      .filter(
        (p) =>
          countedRoleIds == null ||
          p.roleIds.some((id) => countedRoleIds.has(id)),
      )
      .map((p) => p.serial),
  );
}

/** 集計に入れる人の回答と、未回答の人(シリアル) */
export function tallyAttendances(
  attendances: Attendance[],
  counted: Set<string>,
): { counted: Attendance[]; noAnswer: string[] } {
  const rows = attendances.filter((a) => counted.has(a.serial));
  const answered = new Set(rows.map((a) => a.serial));
  return {
    counted: rows,
    noAnswer: [...counted].filter((s) => !answered.has(s)),
  };
}
