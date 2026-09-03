import { useEffect, useState } from "react";
import {
  getSheetSyncedAt,
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
 * 更新が走ったら done() を呼ぶ。呼び出し側はそこで読み直す。
 */
export function useSheetAutoRefresh(
  festivalId: string | null,
  done: () => void,
): { refreshing: boolean } {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!festivalId) return;
    let cancelled = false;
    void (async () => {
      const syncedAt = await getSheetSyncedAt(festivalId);
      // 設定が無ければ何もしない(貼り付け取り込みだけで運用している場合)
      if (syncedAt == null) return;
      const elapsed = Date.now() - new Date(syncedAt).getTime();
      if (elapsed < SHEET_REFRESH_INTERVAL_MS) return;
      if (cancelled) return;
      setRefreshing(true);
      await requestSheetRefresh(festivalId);
      if (cancelled) return;
      setRefreshing(false);
      done();
    })();
    return () => {
      cancelled = true;
    };
    // done は毎描画で変わりうるため依存に入れない(祭りが変わったときだけ動かす)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festivalId]);

  return { refreshing };
}
