import { describe, expect, it } from "vitest";
import { findSimilarSerials, looseSerialKey } from "./serialSimilarity";

describe("looseSerialKey", () => {
  it("区切り・大文字小文字・数字の先頭の0を無視する", () => {
    expect(looseSerialKey("K-015")).toBe("K15");
    expect(looseSerialKey("K-15")).toBe("K15");
    expect(looseSerialKey("k015")).toBe("K15");
    expect(looseSerialKey("Ｋ－０１５")).toBe("K15");
  });

  it("0だけの数字は残す", () => {
    expect(looseSerialKey("K-000")).toBe("K0");
  });

  it("日本語はそのまま", () => {
    expect(looseSerialKey("カメラマン")).toBe("カメラマン");
  });
});

describe("findSimilarSerials", () => {
  it("似ているものどうしを返す", () => {
    const result = findSimilarSerials(["K-015", "K-15", "K-016", "s1321", "S-1321"]);
    expect(result.get("K-015")).toEqual(["K-15"]);
    expect(result.get("K-15")).toEqual(["K-015"]);
    expect(result.get("s1321")).toEqual(["S-1321"]);
    expect(result.has("K-016")).toBe(false);
  });

  it("番号が違えば似ていない", () => {
    expect(findSimilarSerials(["001", "010", "100"]).size).toBe(0);
  });
});
