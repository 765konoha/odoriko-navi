import { describe, expect, it } from "vitest";
import { festivalHandoverPhase, handoversOn } from "./propHandover";
import type { ScheduleItem } from "../types/domain";
import type { PropItem, PropTransfer } from "../types/props";

const item: PropItem = {
  id: "i1",
  category: "旗",
  identifier: "A",
  displayName: "旗A",
  condition: "normal",
  isArchived: false,
};

function entry(id: string, scheduledAt?: string) {
  const transfer: PropTransfer = {
    id,
    propItemId: "i1",
    toSerial: "615",
    status: "pending",
    scheduledAt,
    createdAt: "2026-09-01T00:00:00.000Z",
  };
  return { transfer, item };
}

function sched(id: string, over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    festivalDayId: "d1",
    category: "performance",
    title: id,
    isConfirmed: true,
    isCompleted: false,
    isCancelled: false,
    ...over,
  };
}

describe("handoversOn", () => {
  it("その日に予定されているものだけを残す", () => {
    // 2026-09-13 09:00 JST = 2026-09-13T00:00:00Z
    const list = [
      entry("a", "2026-09-13T00:00:00.000Z"),
      entry("b", "2026-09-14T00:00:00.000Z"),
    ];
    expect(handoversOn(list, "2026-09-13").map((e) => e.transfer.id)).toEqual([
      "a",
    ]);
  });

  it("JSTで日付を見る(UTCでは前日の深夜でも当日扱い)", () => {
    // 2026-09-13T22:00:00Z = 2026-09-14 07:00 JST
    const list = [entry("a", "2026-09-13T22:00:00.000Z")];
    expect(handoversOn(list, "2026-09-14")).toHaveLength(1);
    expect(handoversOn(list, "2026-09-13")).toHaveLength(0);
  });

  it("予定日が未設定のものは出さない", () => {
    expect(handoversOn([entry("a")], "2026-09-13")).toEqual([]);
  });
});

describe("festivalHandoverPhase", () => {
  const done = (ids: string[]) => (i: ScheduleItem) => ids.includes(i.id);

  it("開始前は渡す側だけに出す", () => {
    const items = [sched("first"), sched("last")];
    expect(festivalHandoverPhase(items, done([]))).toEqual({
      showOutgoing: true,
      showIncoming: false,
    });
  });

  it("最初の予定が終わったら渡す側には出さない", () => {
    const items = [sched("first"), sched("last")];
    expect(festivalHandoverPhase(items, done(["first"]))).toEqual({
      showOutgoing: false,
      showIncoming: false,
    });
  });

  it("最後の予定が終わったら受け取る側に出す", () => {
    const items = [sched("first"), sched("last")];
    expect(festivalHandoverPhase(items, done(["first", "last"]))).toEqual({
      showOutgoing: false,
      showIncoming: true,
    });
  });

  it("中止の予定は最初・最後の判定から外す", () => {
    const items = [
      sched("cancelledFirst", { isCancelled: true }),
      sched("first"),
      sched("last"),
      sched("cancelledLast", { isCancelled: true }),
    ];
    // 中止を数えると「最後」が永久に完了しないため、受け取る側に出なくなる
    expect(festivalHandoverPhase(items, done(["first", "last"]))).toEqual({
      showOutgoing: false,
      showIncoming: true,
    });
  });

  it("予定が1件だけなら、完了で渡す側から受け取る側へ切り替わる", () => {
    const items = [sched("only")];
    expect(festivalHandoverPhase(items, done([]))).toEqual({
      showOutgoing: true,
      showIncoming: false,
    });
    expect(festivalHandoverPhase(items, done(["only"]))).toEqual({
      showOutgoing: false,
      showIncoming: true,
    });
  });

  it("予定が無い日は区切りが無いので両方出す", () => {
    expect(festivalHandoverPhase([], done([]))).toEqual({
      showOutgoing: true,
      showIncoming: true,
    });
    expect(
      festivalHandoverPhase([sched("x", { isCancelled: true })], done([])),
    ).toEqual({ showOutgoing: true, showIncoming: true });
  });
});
