import { useCallback } from "react";
import type { ScheduleItem } from "../types/domain";
import { useFestivalData } from "../context/FestivalDataContext";
import { useNow } from "./useNow";
import { autoCompleteEnabled, isItemDone } from "../lib/schedule";

/**
 * 予定が完了扱いかを返す判定関数。
 * 自動完了の祭りでは時刻の経過でも完了になるため、一定間隔で再評価される。
 */
export function useItemDone(): (item: ScheduleItem) => boolean {
  const { data } = useFestivalData();
  const now = useNow();
  const auto = data ? autoCompleteEnabled(data.festival) : false;
  return useCallback(
    (item: ScheduleItem) => isItemDone(item, now, auto),
    [now, auto],
  );
}
