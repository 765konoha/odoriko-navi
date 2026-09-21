import { describe, expect, it } from "vitest";
import { findTodayFestivalSlug } from "./todayFestival";
import { harajuku2026 } from "../data/mock/harajuku2026";
import { kochi2026 } from "../data/mock/kochi2026";
import type { Festival } from "../types/domain";

// Supabase 未設定で動くため、判定は mock の祭りデータを見る。
// mock はどちらも「今日」を開催日に持ち、開催中は原宿だけ。
// 日付は引数で渡す(todayString は window を見るため、ここでは使わない)。

const today = harajuku2026.days[0].date;
const tomorrow = kochi2026.days[1].date;

const harajuku = harajuku2026.festival;
const kochi = kochi2026.festival;
const both: Festival[] = [kochi, harajuku];

describe("findTodayFestivalSlug", () => {
  it("今日が開催日で開催中の祭りが1つなら、その slug を返す", async () => {
    expect(await findTodayFestivalSlug(both, null, today)).toBe(
      "harajuku-2026",
    );
  });

  it("自分が名簿に載っている祭りなら入る", async () => {
    // 615 は原宿の名簿にいる
    expect(await findTodayFestivalSlug(both, "615", today)).toBe(
      "harajuku-2026",
    );
  });

  it("名簿に載っていない祭りには入らない", async () => {
    // 001 は高知だけ。原宿の名簿にはいない
    expect(await findTodayFestivalSlug(both, "001", today)).toBeNull();
  });

  it("終了した祭り(isActive=false)には入らない", async () => {
    // 高知は今日も開催日だが isActive=false
    expect(await findTodayFestivalSlug([kochi], null, today)).toBeNull();
  });

  it("開催日でない日は何もしない", async () => {
    // 明日は高知の2日目だけ。高知は開催中ではない
    expect(await findTodayFestivalSlug(both, null, tomorrow)).toBeNull();
  });

  it("候補が2つ以上なら決めない", async () => {
    // 高知も開催中だとすると、今日が開催日の祭りが2つになる
    const activeKochi: Festival[] = [{ ...kochi, isActive: true }, harajuku];
    expect(await findTodayFestivalSlug(activeKochi, null, today)).toBeNull();
  });

  it("2つあっても名簿で1つに絞れれば入る", async () => {
    const activeKochi: Festival[] = [{ ...kochi, isActive: true }, harajuku];
    // 001 は高知だけの名簿にいる
    expect(await findTodayFestivalSlug(activeKochi, "001", today)).toBe(
      "kochi-2026",
    );
  });

  it("祭りが1つも無ければ何もしない", async () => {
    expect(await findTodayFestivalSlug([], null, today)).toBeNull();
  });
});
