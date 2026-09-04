import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import { useNow } from "./useNow";
import {
  isPastRehearsal,
  loadRehearsalBoard,
  type RehearsalBoard,
} from "../lib/rehearsals";
import type { Attendance, Rehearsal } from "../types/rehearsal";

export interface NextRehearsal {
  rehearsal: Rehearsal;
  /** シリアル未選択なら undefined。回答が無い場合も undefined */
  attendance: Attendance | undefined;
  /** どの祭りのリハか。祭りが分からなければ null */
  festivalName: string | null;
}

export interface NextRehearsalState {
  loading: boolean;
  /** 予定が無い(または全部終わっている)場合は null */
  next: NextRehearsal | null;
}

/**
 * ホームに出す「次のリハ」。
 * リハは祭りをまたいで続くので、選んでいる祭りで絞らずに一番近いものを出す。
 * 中止のリハは飛ばす(行く先として案内するものではないため)。
 * 取得はシリアルが変わったときだけ行い、
 * 「次はどれか」は現在時刻から表示のたびに求める。
 */
export function useNextRehearsal(): NextRehearsalState {
  const { selection } = useUser();
  const now = useNow(60_000);
  const serial = selection?.serial ?? null;

  const [board, setBoard] = useState<RehearsalBoard | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadRehearsalBoard(serial);
        if (!cancelled) setBoard(loaded);
      } catch {
        // 取得失敗(オフライン等)はカードを出さない
        if (!cancelled) {
          setBoard({
            rehearsals: [],
            festivalNameById: new Map(),
            rosterByFestival: new Map(),
            mine: new Map(),
            all: [],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serial]);

  if (board == null) return { loading: true, next: null };

  const upcoming = board.rehearsals.find(
    (r) => !r.isCancelled && !isPastRehearsal(r, now),
  );
  return {
    loading: false,
    next: upcoming
      ? {
          rehearsal: upcoming,
          attendance: board.mine.get(upcoming.id),
          festivalName: board.festivalNameById.get(upcoming.festivalId) ?? null,
        }
      : null,
  };
}
