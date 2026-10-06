import { describe, expect, it } from "vitest";
import { buildPropUserData, nextGivers } from "./props";
import {
  giversOf,
  holdersOf,
  holdsProp,
  type PropItem,
  type PropTransfer,
} from "../types/props";

function item(id: string, stored: string | undefined, others: string[] = []): PropItem {
  return {
    id,
    category: "旗",
    identifier: id,
    displayName: `旗${id}`,
    condition: "normal",
    currentHolderSerial: stored,
    coHolderSerials: others,
    isArchived: false,
  };
}
function transfer(
  id: string,
  propItemId: string,
  from: string,
  to: string,
  createdAt: string,
): PropTransfer {
  return { id, propItemId, fromSerial: from, toSerial: to, status: "pending", createdAt };
}

// 旗A は 615 と 402 が一緒に持っている。615→216→108 の順に受け渡す予定
const items = [item("A", "615", ["402"]), item("B", "706")];
const pending = [
  transfer("t1", "A", "615", "216", "2026-10-01T00:00:00Z"),
  transfer("t2", "A", "216", "108", "2026-10-02T00:00:00Z"),
];
const names = new Map<string, string>();

describe("持っている人どうしに主・副の区別がない", () => {
  it("どちらが代表として保存されていても、持っている人は同じに見える", () => {
    expect(holdersOf(item("A", "615", ["402"]))).toEqual(["402", "615"]);
    expect(holdersOf(item("A", "402", ["615"]))).toEqual(["402", "615"]);
  });

  it("全員が持っている扱い", () => {
    expect(holdsProp(items[0], "615")).toBe(true);
    expect(holdsProp(items[0], "402")).toBe(true);
    expect(holdsProp(items[0], "706")).toBe(false);
  });

  it("今の持ち主からの受け渡しは、全員が渡す側", () => {
    expect(giversOf(pending[0], items[0])).toEqual(["402", "615"]);
  });

  it("その先の受け渡し(216→108)は、その1人が渡す側", () => {
    expect(giversOf(pending[1], items[0])).toEqual(["216"]);
  });

  it("402 と 615 には同じものが見える(保管中・渡す予定)", () => {
    const a = buildPropUserData("402", items, pending, names);
    const b = buildPropUserData("615", items, pending, names);
    expect(a.holding.map((i) => i.id)).toEqual(["A"]);
    expect(b.holding.map((i) => i.id)).toEqual(["A"]);
    expect(a.outgoing.map((o) => o.transfer.id)).toEqual(["t1"]);
    expect(b.outgoing.map((o) => o.transfer.id)).toEqual(["t1"]);
  });

  it("持っていない人には出ない。鎖の後ろの出し手には従来どおり出る", () => {
    expect(buildPropUserData("706", items, pending, names).outgoing).toEqual([]);
    expect(
      buildPropUserData("216", items, pending, names).outgoing.map((o) => o.transfer.id),
    ).toEqual(["t2"]);
  });
});

describe("nextGivers", () => {
  it("予定が無ければ、持っている人全員", () => {
    expect(nextGivers(items[0], [])).toEqual(["402", "615"]);
  });
  it("予定があれば、最後の受取者", () => {
    expect(nextGivers(items[0], pending)).toEqual(["108"]);
  });
  it("誰も持っていなければ空", () => {
    expect(nextGivers(item("C", undefined), [])).toEqual([]);
  });
});
