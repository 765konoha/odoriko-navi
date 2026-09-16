import { describe, expect, it } from "vitest";
import { cohortLabelOf, cohortOf, groupByCohort } from "./cohort";

describe("cohortOf", () => {
  it("3桁は上1桁が期", () => {
    expect(cohortOf("001")).toBe(0);
    expect(cohortOf("012")).toBe(0);
    expect(cohortOf("615")).toBe(6);
    expect(cohortOf("706")).toBe(7);
  });

  it("4桁は上2桁が期", () => {
    expect(cohortOf("1103")).toBe(11);
    expect(cohortOf("1000")).toBe(10);
    expect(cohortOf("9999")).toBe(99);
  });

  it("前後の空白は無視する", () => {
    expect(cohortOf(" 615 ")).toBe(6);
  });

  it("形が違うシリアルは判定しない", () => {
    expect(cohortOf("K-010")).toBeNull();
    expect(cohortOf("s1321")).toBeNull();
    expect(cohortOf("01")).toBeNull(); // 2桁は期の桁が無い
    expect(cohortOf("12345")).toBeNull(); // 5桁は上1〜2桁に収まらない
    expect(cohortOf("")).toBeNull();
    expect(cohortOf("１０１")).toBeNull(); // 全角は別物として扱う
  });
});

describe("cohortLabelOf", () => {
  it("期の表示名", () => {
    expect(cohortLabelOf("001")).toBe("0期");
    expect(cohortLabelOf("1103")).toBe("11期");
    expect(cohortLabelOf("K-010")).toBe("その他");
  });
});

describe("groupByCohort", () => {
  const serials = ["1103", "001", "K-010", "615", "012", "1110"];
  const group = () => groupByCohort(serials, (s) => s);

  it("期の小さい順に並べ、その他は末尾", () => {
    expect(group().map((g) => g.label)).toEqual([
      "0期",
      "6期",
      "11期",
      "その他",
    ]);
  });

  it("同じ期のものをまとめる", () => {
    const g = group();
    expect(g[0].items).toEqual(["001", "012"]);
    expect(g[2].items).toEqual(["1103", "1110"]);
    expect(g[3].items).toEqual(["K-010"]);
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

  it("その他しか無くても落ちない", () => {
    const g = groupByCohort(["K-010", "s1321"], (s) => s);
    expect(g).toHaveLength(1);
    expect(g[0].cohort).toBeNull();
    expect(g[0].label).toBe("その他");
  });
});
