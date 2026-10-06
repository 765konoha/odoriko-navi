import { describe, expect, it } from "vitest";
import { buildPropUserData } from "./props";
import { holdsProp, type PropItem, type PropTransfer } from "../types/props";

function item(id: string, holder: string, coHolders: string[] = []): PropItem {
  return {
    id,
    category: "旗",
    identifier: id,
    displayName: `旗${id}`,
    condition: "normal",
    currentHolderSerial: holder,
    coHolderSerials: coHolders,
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

const items = [item("A", "615", ["402"]), item("B", "706")];
// 旗A: 615 → 216 → 108 の順に受け渡す予定
const pending = [
  transfer("t1", "A", "615", "216", "2026-10-01T00:00:00Z"),
  transfer("t2", "A", "216", "108", "2026-10-02T00:00:00Z"),
];
const names = new Map<string, string>();

describe("holdsProp", () => {
  it("保有者と共同保有者は持っている扱い", () => {
    expect(holdsProp(items[0], "615")).toBe(true);
    expect(holdsProp(items[0], "402")).toBe(true);
    expect(holdsProp(items[0], "706")).toBe(false);
  });
});

describe("buildPropUserData(共同保有)", () => {
  it("共同保有者の「保管中」に出る", () => {
    const d = buildPropUserData("402", items, pending, names);
    expect(d.holding.map((i) => i.id)).toEqual(["A"]);
  });

  it("共同保有者には、今の保有者からの受け渡しだけが「渡す予定」に出る", () => {
    const d = buildPropUserData("402", items, pending, names);
    expect(d.outgoing.map((o) => o.transfer.id)).toEqual(["t1"]);
    expect(d.outgoing[0].asCoHolder).toBe(true);
  });

  it("保有者本人の「渡す予定」は共同保有者としての扱いにならない", () => {
    const d = buildPropUserData("615", items, pending, names);
    expect(d.outgoing.map((o) => [o.transfer.id, o.asCoHolder])).toEqual([["t1", false]]);
    expect(d.holding.map((i) => i.id)).toEqual(["A"]);
  });

  it("共同保有でない人には何も出ない", () => {
    const d = buildPropUserData("706", items, pending, names);
    expect(d.holding.map((i) => i.id)).toEqual(["B"]);
    expect(d.outgoing).toEqual([]);
  });

  it("鎖の後ろの出し手(216)は、従来どおり自分の受け渡しとして出る", () => {
    const d = buildPropUserData("216", items, pending, names);
    expect(d.outgoing.map((o) => [o.transfer.id, o.asCoHolder])).toEqual([["t2", false]]);
  });
});
