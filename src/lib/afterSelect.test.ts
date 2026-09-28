import { describe, expect, it } from "vitest";
import { destinationAfterSelect } from "./afterSelect";

const go = (currentSlug: string | null, todaySlug: string | null, stayNormalToday = false) =>
  destinationAfterSelect({ currentSlug, todaySlug, stayNormalToday });

describe("destinationAfterSelect", () => {
  it("当日の祭りがあり、通常モードにいれば、その祭りモードへ", () => {
    expect(go(null, "niigata")).toBe("/f/niigata");
  });
  it("当日の祭りがあり、別の祭りモードにいれば、当日の祭りへ", () => {
    expect(go("harajuku", "niigata")).toBe("/f/niigata");
  });
  it("当日の祭りモードに既にいれば、そのまま", () => {
    expect(go("niigata", "niigata")).toBeNull();
  });
  it("当日の祭りが無く、祭りモードにいれば、通常モードへ", () => {
    expect(go("harajuku", null)).toBe("/");
  });
  it("当日の祭りが無く、通常モードにいれば、そのまま", () => {
    expect(go(null, null)).toBeNull();
  });
  it("今日は自分で通常モードへ戻しているなら、通常モードのまま", () => {
    expect(go(null, "niigata", true)).toBeNull();
  });
  it("自分で通常モードへ戻した日でも、祭りモードにいるなら当日の祭りへ", () => {
    expect(go("harajuku", "niigata", true)).toBe("/f/niigata");
  });
});
