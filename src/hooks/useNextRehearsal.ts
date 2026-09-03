import { useEffect, useState } from "react";
import { useFestivalData } from "../context/FestivalDataContext";
import { useUser } from "../context/UserContext";
import { useNow } from "./useNow";
import { isPastRehearsal, listMyAttendances, listRehearsals } from "../lib/rehearsals";
import type { Attendance, Rehearsal } from "../types/rehearsal";

export interface NextRehearsal {
  rehearsal: Rehearsal;
  /** シリアル未選択なら undefined。回答が無い場合も undefined */
  attendance: Attendance | undefined;
}

export interface NextRehearsalState {
  loading: boolean;
  /** 予定が無い(または全部終わっている)場合は null */
  next: NextRehearsal | null;
}

/**
 * ホームに出す「次のリハ」。
 * 中止のリハは飛ばす(行く先として案内するものではないため)。
 * 取得は祭りとシリアルが変わったときだけ行い、
 * 「次はどれか」は現在時刻から表示のたびに求める。
 */
export function useNextRehearsal(): NextRehearsalState {
  const { data } = useFestivalData();
  const { selection } = useUser();
  const now = useNow(60_000);
  const festivalId = data?.festival.id ?? null;
  const serial = selection?.serial ?? null;

  const [rehearsals, setRehearsals] = useState<Rehearsal[] | null>(null);
  const [mine, setMine] = useState<Map<string, Attendance>>(new Map());

  useEffect(() => {
    if (!festivalId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listRehearsals(festivalId);
        if (cancelled) return;
        setRehearsals(list);
        if (!serial) {
          setMine(new Map());
          return;
        }
        const map = await listMyAttendances(
          serial,
          list.map((r) => r.id),
        );
        if (!cancelled) setMine(map);
      } catch {
        // 取得失敗(オフライン等)はカードを出さない
        if (!cancelled) setRehearsals([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [festivalId, serial]);

  if (rehearsals == null) return { loading: true, next: null };

  const upcoming = rehearsals.find(
    (r) => !r.isCancelled && !isPastRehearsal(r, now),
  );
  return {
    loading: false,
    next: upcoming
      ? { rehearsal: upcoming, attendance: mine.get(upcoming.id) }
      : null,
  };
}
