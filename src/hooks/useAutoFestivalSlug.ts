import { useEffect, useState } from "react";
import { useFestivalList } from "../components/layout/FestivalPicker";
import { useUser } from "../context/UserContext";
import { loadStayNormalDate } from "../lib/storage";
import { findTodayFestivalSlug } from "../lib/todayFestival";
import { todayString } from "../lib/time";

/**
 * 祭り当日に自動で入る祭りの slug。入らないときは null。
 *
 * 判定が終わるまでは null を返すので、呼び出し側は
 * 通常モードの画面を出したまま待てばよい(一瞬の白画面を作らない)。
 */
export function useAutoFestivalSlug(): string | null {
  const { festivals } = useFestivalList();
  const { selection } = useUser();
  const serial = selection?.serial ?? null;
  const [slug, setSlug] = useState<string | null>(null);

  // 利用者を選ぶ前は、誰として入るか決まらないので判定しない
  const ready = selection != null && festivals.length > 0;

  useEffect(() => {
    if (!ready) return;
    // 自分で通常モードへ戻した日は、その日のあいだ引き戻さない
    if (loadStayNormalDate() === todayString()) return;
    let cancelled = false;
    void findTodayFestivalSlug(festivals, serial)
      .then((found) => {
        if (!cancelled) setSlug(found);
      })
      .catch(() => {
        // 取得できないときは自動で切り替えない(手で切り替えれば使える)
      });
    return () => {
      cancelled = true;
    };
  }, [ready, festivals, serial]);

  return slug;
}
