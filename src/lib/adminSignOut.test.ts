import { describe, expect, it, vi } from "vitest";
import { runSignOut } from "./adminSignOut";

describe("runSignOut", () => {
  it("成功したときだけ管理キャッシュを消す", async () => {
    const clearCache = vi.fn();
    const result = await runSignOut({
      signOut: async () => ({ error: null }),
      clearCache,
    });
    expect(result).toEqual({ error: null });
    expect(clearCache).toHaveBeenCalledTimes(1);
  });

  it("error が返ったらキャッシュを消さず、理由を返す", async () => {
    const clearCache = vi.fn();
    const result = await runSignOut({
      signOut: async () => ({ error: { message: "network error" } }),
      clearCache,
    });
    expect(result).toEqual({ error: "network error" });
    expect(clearCache).not.toHaveBeenCalled();
  });

  it("例外が飛んでもキャッシュを消さず、投げ返さない", async () => {
    const clearCache = vi.fn();
    const result = await runSignOut({
      signOut: async () => {
        throw new Error("Failed to fetch");
      },
      clearCache,
    });
    expect(result).toEqual({ error: "Failed to fetch" });
    expect(clearCache).not.toHaveBeenCalled();
  });

  it("Error 以外が投げられても落ちない", async () => {
    const clearCache = vi.fn();
    const result = await runSignOut({
      signOut: async () => {
        throw "boom";
      },
      clearCache,
    });
    expect(result).toEqual({ error: "ログアウトに失敗しました" });
    expect(clearCache).not.toHaveBeenCalled();
  });
});
