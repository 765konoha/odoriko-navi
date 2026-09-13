import { describe, expect, it } from "vitest";
import { createRequestTracker } from "./requestTracker";

describe("createRequestTracker", () => {
  it("同じ祭りの取得が動いている間は二重に始めない", () => {
    const tracker = createRequestTracker();
    expect(tracker.begin("kochi")).toBe(1);
    expect(tracker.begin("kochi")).toBeNull();
    expect(tracker.begin("kochi")).toBeNull();
  });

  it("終わったあとは同じ祭りでも始められる", () => {
    const tracker = createRequestTracker();
    const first = tracker.begin("kochi")!;
    expect(tracker.finish(first)).toBe(true);
    expect(tracker.begin("kochi")).toBe(2);
  });

  it("別の祭りに切り替えたら、古い取得を待たずに始められる", () => {
    const tracker = createRequestTracker();
    const kochi = tracker.begin("kochi")!;
    const harajuku = tracker.begin("harajuku");
    expect(harajuku).not.toBeNull();
    expect(harajuku).not.toBe(kochi);
  });

  it("古い取得の結果は反映しない(あとから届いても)", () => {
    const tracker = createRequestTracker();
    const kochi = tracker.begin("kochi")!;
    const harajuku = tracker.begin("harajuku")!;

    // 先に新しい方(harajuku)が返ってきた場合
    expect(tracker.isCurrent(harajuku)).toBe(true);
    // そのあとに古い方(kochi)が返ってきても反映しない
    expect(tracker.isCurrent(kochi)).toBe(false);
  });

  it("古い取得の終了で、新しい取得の状態を解除しない", () => {
    const tracker = createRequestTracker();
    const kochi = tracker.begin("kochi")!;
    const harajuku = tracker.begin("harajuku")!;

    // 古い kochi が finally に入っても、harajuku の状態は触らせない
    expect(tracker.finish(kochi)).toBe(false);
    // harajuku はまだ動いているので、二重取得も始まらない
    expect(tracker.begin("harajuku")).toBeNull();
    // harajuku 自身の終了だけが状態を解除できる
    expect(tracker.finish(harajuku)).toBe(true);
  });

  it("切り替えて戻ってきた場合、最後の取得だけが有効になる", () => {
    const tracker = createRequestTracker();
    const first = tracker.begin("kochi")!;
    tracker.begin("harajuku");
    const back = tracker.begin("kochi")!;

    expect(tracker.isCurrent(first)).toBe(false);
    expect(tracker.isCurrent(back)).toBe(true);
  });
});
