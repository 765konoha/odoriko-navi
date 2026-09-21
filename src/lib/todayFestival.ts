// 祭り当日かどうかの判定。
//
// 当日はホームを開いたら祭りモードへ入るので、
// 「今日が開催日の祭り」がどれかを決める必要がある。
//
// 祭りデータ一式を読むと重いので、開催日と名簿だけを小さく引く。
// 取得に失敗したときは何もしない(通常モードのまま)。
// 自動で切り替わらないだけで、手で切り替えれば使えるため。

import type { Festival } from "../types/domain";
import { supabase } from "./supabase";
import { mockRepository } from "../repositories/mockRepository";
import { todayString } from "./time";

/** その日に開催している祭りのID */
async function festivalIdsOn(date: string): Promise<string[]> {
  if (!supabase) {
    const ids: string[] = [];
    for (const f of await mockRepository.listFestivals()) {
      const data = await mockRepository.loadFestivalData(f.slug);
      if (data?.days.some((d) => d.date === date)) ids.push(f.id);
    }
    return ids;
  }
  const { data, error } = await supabase
    .from("festival_days")
    .select("festival_id")
    .eq("date", date);
  if (error) throw new Error(error.message);
  return [
    ...new Set(((data ?? []) as { festival_id: string }[]).map((r) => r.festival_id)),
  ];
}

/** そのシリアルが名簿に載っている祭りのID */
async function participatingIds(
  serial: string,
  festivalIds: string[],
): Promise<Set<string>> {
  if (festivalIds.length === 0) return new Set();
  if (!supabase) {
    const ids = new Set<string>();
    for (const f of await mockRepository.listFestivals()) {
      if (!festivalIds.includes(f.id)) continue;
      const data = await mockRepository.loadFestivalData(f.slug);
      if (data?.participants.some((p) => p.serial === serial)) ids.add(f.id);
    }
    return ids;
  }
  const { data, error } = await supabase
    .from("festival_participants")
    .select("festival_id")
    .eq("serial", serial)
    .in("festival_id", festivalIds);
  if (error) throw new Error(error.message);
  return new Set(
    ((data ?? []) as { festival_id: string }[]).map((r) => r.festival_id),
  );
}

/**
 * 今日が開催日で、自動で入ってよい祭りの slug。無ければ null。
 *
 * - 開催中(isActive)の祭りだけを見る
 * - シリアルを選んでいれば、自分が名簿に載っている祭りだけに絞る
 *   (出ていない祭りへ勝手に入れられても使い道が無いため)
 * - 候補が2つ以上残るときは決められないので何もしない。
 *   勝手にどちらかへ入れるより、自分で選んでもらうほうが確か
 *
 * @param festivals 祭り一覧(キャッシュ済みのものを渡す)
 * @param serial 選択中のシリアル。番号指定なしは null
 */
export async function findTodayFestivalSlug(
  festivals: Festival[],
  serial: string | null,
  today: string = todayString(),
): Promise<string | null> {
  const active = festivals.filter((f) => f.isActive);
  if (active.length === 0) return null;

  const activeIds = new Set(active.map((f) => f.id));
  const todayIds = (await festivalIdsOn(today)).filter((id) =>
    activeIds.has(id),
  );
  if (todayIds.length === 0) return null;

  let candidates = todayIds;
  if (serial != null) {
    const mine = await participatingIds(serial, todayIds);
    candidates = todayIds.filter((id) => mine.has(id));
  }
  if (candidates.length !== 1) return null;

  return active.find((f) => f.id === candidates[0])?.slug ?? null;
}
