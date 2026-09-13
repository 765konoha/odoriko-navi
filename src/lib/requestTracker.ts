// 「いま有効な取得はどれか」を追うための小さな道具。
//
// 祭りAの取得中に祭りBへ切り替えると、あとから届いたAの結果がBの画面に
// 入ってしまう。取得ごとに番号(token)を振り、最後に始めた取得の番号と
// 一致するときだけ結果を反映することで、古い取得を捨てる。
//
// 同じ祭りの取得が動いている間は二重に走らせない(タブ切替・復帰・手動更新が
// 重なっても、実際に取りに行くのは1回)。祭りが変わったときは、古い取得の
// 終了を待たずに新しい取得を始める。

export interface RequestTracker {
  /**
   * 取得を始める。取得の番号を返す。
   * 同じ key の取得が動いている場合は null(二重取得しない)。
   */
  begin(key: string): number | null;
  /** その取得の結果を、いまの画面へ反映してよいか */
  isCurrent(token: number): boolean;
  /**
   * 取得の終了を伝える。最後に始めた取得なら true。
   * 古い取得なら false を返すので、呼び出し側は
   * loading/refreshing のような共有の状態を触らずに済む。
   */
  finish(token: number): boolean;
}

export function createRequestTracker(): RequestTracker {
  let latest = 0;
  let running: { key: string; token: number } | null = null;

  return {
    begin(key) {
      if (running?.key === key) return null;
      latest += 1;
      running = { key, token: latest };
      return latest;
    },
    isCurrent(token) {
      return token === latest;
    },
    finish(token) {
      if (token !== latest) return false;
      running = null;
      return true;
    },
  };
}
