import { describe, expect, it } from "vitest";
import { buildPropUserData, fromSideOf, giversOf, leavingOf, nextGivers } from "./props";
import { holdersOf, holdsProp, type PropItem, type PropTransfer } from "../types/props";

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
function handover(
  id: string,
  propItemId: string,
  from: string,
  receivers: string[],
  createdAt: string,
): PropTransfer {
  return {
    id,
    propItemId,
    fromSerial: from,
    toSerial: receivers[0],
    receivers,
    status: "pending",
    createdAt,
  };
}
const names = new Map<string, string>();
const view = (serial: string, items: PropItem[], pending: PropTransfer[]) => {
  const d = buildPropUserData(serial, items, pending, names);
  return {
    holding: d.holding.map((i) => i.id),
    outgoing: d.outgoing.map((o) => o.transfer.id),
    incoming: d.incoming.map((o) => o.transfer.id),
  };
};

describe("持っている人どうしに主・副の区別がない", () => {
  it("どちらが代表として保存されていても、持っている人は同じに見える", () => {
    expect(holdersOf(item("A", "615", ["402"]))).toEqual(["402", "615"]);
    expect(holdersOf(item("A", "402", ["615"]))).toEqual(["402", "615"]);
  });
  it("全員が持っている扱い", () => {
    const a = item("A", "615", ["402"]);
    expect(holdsProp(a, "615") && holdsProp(a, "402")).toBe(true);
    expect(holdsProp(a, "706")).toBe(false);
  });
});

describe("片方が抜ける受け渡し(402・615 → 402)", () => {
  const items = [item("A", "615", ["402"])];
  const pending = [handover("t1", "A", "615", ["402"], "2026-10-01T00:00:00Z")];

  it("渡す側は2人、外れるのは 615", () => {
    expect(giversOf(pending[0], items[0], pending)).toEqual(["402", "615"]);
    expect(leavingOf(["402", "615"], ["402"])).toEqual(["615"]);
  });
  it("抜ける 615 には「渡す予定」に出る", () => {
    expect(view("615", items, pending)).toEqual({ holding: ["A"], outgoing: ["t1"], incoming: [] });
  });
  it("残る 402 には「あなたへの受け渡し」に出て、渡す予定には出ない", () => {
    expect(view("402", items, pending)).toEqual({ holding: ["A"], outgoing: [], incoming: ["t1"] });
  });
  it("402 から見た「どこから」は 615", () => {
    expect(fromSideOf(["402", "615"], ["402"])).toEqual(["615"]);
  });
});

describe("2人で受け取る受け渡し(706 → 108・216)", () => {
  const items = [item("B", "706")];
  const pending = [handover("t1", "B", "706", ["108", "216"], "2026-10-01T00:00:00Z")];
  it("受け取る2人の両方に出る(誰か1人が押せば完了)", () => {
    expect(view("108", items, pending).incoming).toEqual(["t1"]);
    expect(view("216", items, pending).incoming).toEqual(["t1"]);
  });
  it("706 には渡す予定に出る", () => {
    expect(view("706", items, pending)).toEqual({ holding: ["B"], outgoing: ["t1"], incoming: [] });
  });
});

describe("1人加わる受け渡し(706 → 706・108)", () => {
  const items = [item("B", "706")];
  const pending = [handover("t1", "B", "706", ["706", "108"], "2026-10-01T00:00:00Z")];
  it("外れる人はいないので、108 から見た「どこから」は 706", () => {
    expect(fromSideOf(["706"], ["706", "108"])).toEqual(["706"]);
  });
  it("706 も受け取る側(押せる)。渡す予定には出ない", () => {
    expect(view("706", items, pending)).toEqual({ holding: ["B"], outgoing: [], incoming: ["t1"] });
  });
});

describe("複数日の鎖(1日目 615・402 → 108・216、2日目 108・216 → 216)", () => {
  const items = [item("A", "615", ["402"])];
  const pending = [
    handover("t1", "A", "615", ["108", "216"], "2026-10-01T00:00:00Z"),
    handover("t2", "A", "108", ["216"], "2026-10-02T00:00:00Z"),
  ];
  it("2日目の渡す側は、1日目の受け取る人全員", () => {
    expect(giversOf(pending[1], items[0], pending)).toEqual(["108", "216"]);
  });
  it("108 は1日目に受け取り、2日目に渡す(抜ける)", () => {
    expect(view("108", items, pending)).toEqual({ holding: [], outgoing: ["t2"], incoming: ["t1"] });
  });
  it("次に作る受け渡しの渡す側は、最後の受け取る人全員", () => {
    expect(nextGivers(items[0], pending)).toEqual(["216"]);
    expect(nextGivers(items[0], [])).toEqual(["402", "615"]);
  });
});
