import { useEffect, useState } from "react";
import { loadNicknamesBySerial } from "../lib/serialNames";

// シリアル選択画面の呼び名(祭りごとの名簿のニックネームを並記したもの)。
// 祭りモードと通常モードで同じものを使う。一度読んだら使い回す。
let cached: Map<string, string[]> | null = null;
let inFlight: Promise<Map<string, string[]>> | null = null;

function fetchOnce(): Promise<Map<string, string[]>> {
  if (cached) return Promise.resolve(cached);
  inFlight ??= loadNicknamesBySerial()
    .then((map) => {
      // 取得できなかったとき(オフライン等)は空が返る。
      // それを覚えてしまうと復帰しないので、覚えるのは中身があるときだけ
      if (map.size > 0) cached = map;
      return map;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** シリアル → 祭りごとのニックネーム(新しい祭りから順) */
export function useSerialNicknames(): {
  names: Map<string, string[]>;
  loading: boolean;
} {
  const [names, setNames] = useState<Map<string, string[]>>(
    () => cached ?? new Map(),
  );
  const [loading, setLoading] = useState(cached == null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void fetchOnce()
      .then((map) => {
        if (!cancelled) setNames(map);
      })
      .catch(() => {
        // 取得できなければシリアルだけで表示する
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { names, loading };
}
