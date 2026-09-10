import { describe, expect, it } from "vitest";
import { clearAdminCache, isAdminCacheKey } from "./adminCache";

/** localStorage の代わり(テスト用) */
function fakeStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    keys() {
      return [...map.keys()];
    },
  };
}

/** 踊り子側と Supabase のキー(消してはいけないもの) */
const DANCER_KEYS = {
  "odoriko:kochi-2026:dataCache": "{}",
  "odoriko:kochi-2026:615:readAnnouncements": "[]",
  "odoriko:kochi-2026:615:ackedEmergencies": "[]",
  "odoriko:festivalList": "[]",
  "odoriko:lastFestivalSlug": "kochi-2026",
  "odoriko:userSelection": '{"serial":"615"}',
  "odoriko:participantSerials": "[]",
  "odoriko:appMode": "normal",
  "odoriko:accessRecorded": "{}",
  "sb-abcdefg-auth-token": "{}",
};

const ADMIN_KEYS = {
  "odoriko:admin:festivalsCache": "[]",
  "odoriko:admin:festivalSlug": "kochi-2026",
  "odoriko:admin:f-kochi-2026:schedule": "{}",
  "odoriko:admin:f-kochi-2026:participants": "{}",
};

describe("isAdminCacheKey", () => {
  it("管理画面のキーだけを true にする", () => {
    for (const key of Object.keys(ADMIN_KEYS)) {
      expect(isAdminCacheKey(key)).toBe(true);
    }
  });

  it("踊り子側と Supabase のキーは false にする", () => {
    for (const key of Object.keys(DANCER_KEYS)) {
      expect(isAdminCacheKey(key)).toBe(false);
    }
  });

  it("接頭辞が途中から一致するだけのキーは対象にしない", () => {
    expect(isAdminCacheKey("odoriko:adminX:foo")).toBe(false);
    expect(isAdminCacheKey("other:odoriko:admin:foo")).toBe(false);
    expect(isAdminCacheKey("odoriko:admin")).toBe(false);
  });
});

describe("clearAdminCache", () => {
  it("管理画面のキーだけを消し、踊り子側は残す", () => {
    const storage = fakeStorage({ ...DANCER_KEYS, ...ADMIN_KEYS });
    clearAdminCache(storage);
    expect(storage.keys().sort()).toEqual(Object.keys(DANCER_KEYS).sort());
  });

  it("連続する管理キーを取りこぼさない(走査中の削除で添字がずれない)", () => {
    const storage = fakeStorage({
      "odoriko:admin:a": "1",
      "odoriko:admin:b": "1",
      "odoriko:admin:c": "1",
      "odoriko:admin:d": "1",
      "odoriko:userSelection": "1",
    });
    clearAdminCache(storage);
    expect(storage.keys()).toEqual(["odoriko:userSelection"]);
  });

  it("ストレージが例外を投げても落ちない", () => {
    const broken = {
      get length(): number {
        throw new Error("storage disabled");
      },
      key: () => null,
      removeItem: () => {},
    };
    expect(() => clearAdminCache(broken)).not.toThrow();
  });

  it("消すものが無くても落ちない", () => {
    const storage = fakeStorage(DANCER_KEYS);
    clearAdminCache(storage);
    expect(storage.keys().sort()).toEqual(Object.keys(DANCER_KEYS).sort());
  });
});
