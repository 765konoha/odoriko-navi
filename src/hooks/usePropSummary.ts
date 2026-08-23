import { useCallback, useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import { listPendingTransfers, listPropItems } from "../lib/props";

export interface PropSummary {
  /** 自分が保管中の件数 */
  holding: number;
  /** 自分が渡す予定の件数 */
  outgoing: number;
  /** 自分が受け取る予定の件数 */
  incoming: number;
}

/**
 * ホームの小道具リレーカード用の件数。
 * シリアル未選択(番号指定なし)や Supabase 未設定のときは null。
 */
export function usePropSummary(): PropSummary | null {
  const { selection } = useUser();
  const serial = selection?.serial ?? null;
  const [summary, setSummary] = useState<PropSummary | null>(null);

  const load = useCallback(async () => {
    if (!serial) return null;
    const [items, pending] = await Promise.all([
      listPropItems(),
      listPendingTransfers(),
    ]);
    return {
      holding: items.filter((i) => i.currentHolderSerial === serial).length,
      outgoing: pending.filter((t) => t.fromSerial === serial).length,
      incoming: pending.filter((t) => t.toSerial === serial).length,
    };
  }, [serial]);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    void load()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        // 取得失敗(オフライン等)は件数を出さない
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return summary;
}
