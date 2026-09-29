// シリアルを選んだあとに開く画面。
//
// 選んだ人にとって今日が祭りの当日ならその祭りモード、そうでなければ
// 通常モードで開く。どの祭りが「今日の祭り」かは findTodayFestivalSlug
// (ホームから祭りモードへ自動で入るときと同じ判定)で決める。

/**
 * 移る先のパス。今いる画面のままでよければ null。
 *
 * @param currentSlug 今いる祭りモードの祭り(通常モードなら null)
 * @param todaySlug 選んだ人にとって今日開催中の祭り(無ければ null)
 * @param stayNormalToday 今日は自分で通常モードへ戻している
 */
export function destinationAfterSelect({
  currentSlug,
  todaySlug,
  stayNormalToday,
}: {
  currentSlug: string | null;
  todaySlug: string | null;
  stayNormalToday: boolean;
}): string | null {
  if (todaySlug) {
    if (currentSlug === todaySlug) return null;
    // 今日は通常モードにとどまると自分で決めているので、引き戻さない
    if (currentSlug == null && stayNormalToday) return null;
    return `/f/${todaySlug}`;
  }
  // 当日の祭りが無い(通常の日程)なら通常モード
  return currentSlug == null ? null : "/";
}
