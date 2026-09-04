import { useEffect, useState } from "react";
import {
  listSheetSyncedAt,
  requestSheetRefresh,
  SHEET_REFRESH_INTERVAL_MS,
} from "../lib/rehearsals";

/**
 * リハの画面を開いたときに、出欠シートを読み直す。
 *
 * 定期実行を仕込まずに済ませるための仕組み。
 * 最終同期時刻を先に見て、古いときだけ Edge Function を呼ぶので、
 * 見る人が何人いても関数の呼び出しは同期の回数までしか増えない。
 *
 * 画面には複数の祭りのリハが並ぶため、祭りごとに判断する。
 * 渡すのはこれから先のリハがある祭りだけにすること
 * (終わった祭りのシートを読み直しても意味がないため)。
 *
 * 更新が走ったら done() を呼ぶ。呼び出し側はそこで読み直す。
 */
export function useSheetAutoRefresh(
  festivalIds: string[],
  done: () => void,
): { refreshing: boolean } {
  const [refreshing, setRefreshing] = useState(false);
  // 配列は毎描画で作り直されるため、中身で比べる
  const key = [...festivalIds].sort().join(",");

  useEffect(() => {
    const ids = key === "" ? [] : key.split(",");
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const syncedAt = await listSheetSyncedAt(ids);
      const stale = ids.filter((id) => {
        const at = syncedAt.get(id);
        // 設定が無ければ何もしない(貼り付け取り込みだけで運用している場合)
        if (at == null) return false;
        return Date.now() - new Date(at).getTime() >= SHEET_REFRESH_INTERVAL_MS;
      });
      if (stale.length === 0 || cancelled) return;
      setRefreshing(true);
      await Promise.all(stale.map((id) => requestSheetRefresh(id)));
      if (cancelled) return;
      setRefreshing(false);
      done();
    })();
    return () => {
      cancelled = true;
    };
    // done は毎描画で変わりうるため依存に入れない(祭りが変わったときだけ動かす)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { refreshing };
}
