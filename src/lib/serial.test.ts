import { describe, expect, it } from "vitest";
import { normalizeSerial } from "./serial";

describe("normalizeSerial", () => {
  it("全角の英数字と記号を半角にする", () => {
    expect(normalizeSerial("Ｋ－０１５")).toBe("K-015");
    expect(normalizeSerial("ｓ１０３")).toBe("s103");
    expect(normalizeSerial("０１２")).toBe("012");
  });

  it("半角のものは変えない(先頭の0と大文字小文字はそのまま)", () => {
    expect(normalizeSerial("K-015")).toBe("K-015");
    expect(normalizeSerial("k-015")).toBe("k-015");
    expect(normalizeSerial("012")).toBe("012");
  });

  it("全角と半角が混ざっていてもそろう", () => {
    expect(normalizeSerial("K－015")).toBe("K-015");
    expect(normalizeSerial("Ｋ-０15")).toBe("K-015");
  });

  it("英数字にはさまれた長音符・ダッシュはハイフンにする", () => {
    expect(normalizeSerial("Kー015")).toBe("K-015");
    expect(normalizeSerial("Ｋー０１５")).toBe("K-015");
    expect(normalizeSerial("K‐015")).toBe("K-015");
    expect(normalizeSerial("K−015")).toBe("K-015");
    expect(normalizeSerial("K–015")).toBe("K-015");
    expect(normalizeSerial("Kｰ015")).toBe("K-015");
  });

  it("日本語はそのまま(長音符も残す)", () => {
    expect(normalizeSerial("カメラマン")).toBe("カメラマン");
    expect(normalizeSerial("サポーター")).toBe("サポーター");
    expect(normalizeSerial("カメラマン１")).toBe("カメラマン1");
    // 日本語と英数字の間の長音符は日本語の一部として残す
    expect(normalizeSerial("コーチーA")).toBe("コーチーA");
  });

  it("前後の空白(全角スペースを含む)を除く", () => {
    expect(normalizeSerial("  K-015\t")).toBe("K-015");
    expect(normalizeSerial("　Ｋ－０１５　")).toBe("K-015");
  });
});
