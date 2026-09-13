import { useCallback, useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import { loadPropUserData, type PropUserData } from "../lib/props";

/**
 * ホームで使う自分の小道具の状況(保管中・渡す予定・受け取る予定)。
 *
 * リレーカードと受け渡しの案内が同じものを見るため、ホームで一度だけ読んで
 * 配る。シリアル未選択(番号指定なし)や Supabase 未設定のときは null。
 */
export function usePropUserData(): PropUserData | null {
  const { selection } = useUser();
  const serial = selection?.serial ?? null;
  const [data, setData] = useState<PropUserData | null>(null);

  const load = useCallback(async () => {
    if (!serial) return null;
    return await loadPropUserData(serial);
  }, [serial]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    void load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        // 取得失敗(オフライン等)は何も出さない
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return data;
}
