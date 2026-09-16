import { describe, expect, it } from "vitest";
import { cohortLabelOf, cohortOf, groupByCohort } from "./cohort";

describe("cohortOf", () => {
  it("3桁は上1桁が期", () => {
    expect(cohortOf("001")).toEqual({ kind: "number", value: 0 });
    expect(cohortOf("012")).toEqual({ kind: "number", value: 0 });
    expect(cohortOf("615")).toEqual({ kind: "number", value: 6 });
    expect(cohortOf("706")).toEqual({ kind: "number", value: 7 });
  });

  it("4桁は上2桁が期", () => {
    expect(cohortOf("1103")).toEqual({ kind: "number", value: 11 });
    expect(cohortOf("1000")).toEqual({ kind: "number", value: 10 });
    expect(cohortOf("9999")).toEqual({ kind: "number", value: 99 });
  });

  it("スポットナンバーは s を外した残りで期を決める", () => {
    expect(cohortOf("s1321")).toEqual({ kind: "number", value: 13 });
    expect(cohortOf("s012")).toEqual({ kind: "number", value: 0 });
    expect(cohortOf("S615")).toEqual({ kind: "number", value: 6 });
  });

  it("キッズ枠は番号で分けない", () => {
    expect(cohortOf("K-010")).toEqual({ kind: "kids" });
    expect(cohortOf("k010")).toEqual({ kind: "kids" });
    expect(cohortOf("K-1103")).toEqual({ kind: "kids" });
  });

  it("前後の空白は無視する", () => {
    expect(cohortOf(" 615 ")).toEqual({ kind: "number", value: 6 });
    expect(cohortOf(" s1321 ")).toEqual({ kind: "number", value: 13 });
  });

  it("形が違うシリアルは判定しない", () => {
    expect(cohortOf("01")).toEqual({ kind: "unknown" }); // 2桁は期の桁が無い
    expect(cohortOf("12345")).toEqual({ kind: "unknown" }); // 5桁は上1〜2桁に収まらない
    expect(cohortOf("s12")).toEqual({ kind: "unknown" }); // s を外しても桁が足りない
    expect(cohortOf("x615")).toEqual({ kind: "unknown" }); // 知らない記号
    expect(cohortOf("")).toEqual({ kind: "unknown" });
    expect(cohortOf("１０１")).toEqual({ kind: "unknown" }); // 全角は別物として扱う
  });
});

describe("cohortLabelOf", () => {
  it("期の表示名", () => {
    expect(cohortLabelOf("001")).toBe("0期");
    expect(cohortLabelOf("1103")).toBe("11期");
    expect(cohortLabelOf("s1321")).toBe("13期");
    expect(cohortLabelOf("K-010")).toBe("k期");
    expect(cohortLabelOf("x615")).toBe("その他");
  });
});

describe("groupByCohort", () => {
  const serials = ["1103", "001", "K-010", "615", "012", "1110", "s1321", "x9"];
  const group = () => groupByCohort(serials, (s) => s);

  it("期の小さい順、そのあと k期、末尾がその他", () => {
    expect(group().map((g) => g.label)).toEqual([
      "0期",
      "6期",
      "11期",
      "13期",
      "k期",
      "その他",
    ]);
  });

  it("同じ期のものをまとめる", () => {
    const g = group();
    expect(g[0].items).toEqual(["001", "012"]);
    expect(g[2].items).toEqual(["1103", "1110"]);
  });

  it("スポットナンバーは同じ期の人と同じまとまりに入る", () => {
    const g = groupByCohort(["1321", "s1322"], (s) => s);
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe("13期");
    expect(g[0].items).toEqual(["1321", "s1322"]);
  });

  it("キッズ枠はまとめて1つ", () => {
    const g = groupByCohort(["K-010", "k020"], (s) => s);
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe("k期");
  });

  it("各期の中では渡された順を保つ", () => {
    expect(groupByCohort(["012", "001"], (s) => s)[0].items).toEqual([
      "012",
      "001",
    ]);
  });

  it("空なら空", () => {
    expect(groupByCohort([], (s: string) => s)).toEqual([]);
  });
});
