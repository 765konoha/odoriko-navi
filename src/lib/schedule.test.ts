import { describe, expect, it } from "vitest";
import { sortItems } from "./schedule";
import type { ScheduleCategory, ScheduleItem } from "../types/domain";

function item(
  id: string,
  category: ScheduleCategory,
  times: { gather?: string; start?: string },
): ScheduleItem {
  return {
    id,
    festivalDayId: "d1",
    title: id,
    category,
    gatherTime: times.gather,
    startTime: times.start,
    isConfirmed: true,
    isCancelled: false,
  };
}

const at = (hhmm: string) => `2026-11-08T${hhmm}:00+09:00`;

describe("sortItems", () => {
  it("同じ時刻の集合と演舞は、集合が先", () => {
    const performance = item("演舞", "performance", { start: at("10:00") });
    const gather = item("集合", "gather", { start: at("10:00") });
    expect(sortItems([performance, gather]).map((i) => i.id)).toEqual([
      "集合",
      "演舞",
    ]);
  });

  it("演舞に開始時刻、集合に集合時刻だけがあっても同じ時刻なら集合が先", () => {
    const performance = item("演舞", "performance", { start: at("10:00") });
    const gather = item("集合", "gather", { gather: at("10:00") });
    expect(sortItems([performance, gather]).map((i) => i.id)).toEqual([
      "集合",
      "演舞",
    ]);
  });

  it("時刻が違えば時刻順のまま", () => {
    const performance = item("演舞", "performance", { start: at("09:30") });
    const gather = item("集合", "gather", { start: at("10:00") });
    expect(sortItems([gather, performance]).map((i) => i.id)).toEqual([
      "演舞",
      "集合",
    ]);
  });

  it("集合と演舞以外の組み合わせは今までどおり開始時刻で比べる", () => {
    const move = item("移動", "move", { gather: at("10:00"), start: at("10:20") });
    const performance = item("演舞", "performance", {
      gather: at("10:00"),
      start: at("10:10"),
    });
    expect(sortItems([move, performance]).map((i) => i.id)).toEqual([
      "演舞",
      "移動",
    ]);
  });
});
