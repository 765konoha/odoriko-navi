import { useEffect, useState } from "react";
import { loadDisplayNames } from "../lib/props";

// 呼び名は画面をまたいで同じものを使う。
// 通常モードの外枠とホームの両方で必要になるため、一度読んだら使い回す。
let cached: Map<string, string> | null = null;
let inFlight: Promise<Map<string, string>> | null = null;

function fetchOnce(): Promise<Map<string, string>> {
  if (cached) return Promise.resolve(cached);
  inFlight ??= loadDisplayNames()
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

/**
 * シリアル → 呼び名(祭りに依存しない)。
 * 通常モードの画面は祭りを選ばないため、祭りごとの名簿ではなく
 * participant_display(全祭りを通した最新のニックネーム)から引く。
 */
export function useDisplayNames(): {
  names: Map<string, string>;
  loading: boolean;
} {
  const [names, setNames] = useState<Map<string, string>>(
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

/** 「615 / みや」形式。呼び名が分からなければシリアルだけ */
export function displayLabel(
  serial: string | null,
  names: Map<string, string>,
): string {
  if (serial == null) return "番号指定なし";
  const nickname = names.get(serial);
  return nickname ? `${serial} / ${nickname}` : serial;
}
