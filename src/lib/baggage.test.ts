import { describe, expect, it } from "vitest";
import {
  MAX_BAGGAGE_GROUPS,
  baggageGroupMembers,
  missingBaggageGroupCodes,
} from "./baggage";
import type { FestivalParticipant } from "../types/domain";

function p(
  serial: string,
  baggageGroupId?: string,
): FestivalParticipant {
  return {
    id: `p-${serial}`,
    festivalId: "f1",
    serial,
    name: `名前${serial}`,
    nickname: `ニック${serial}`,
    roleIds: [],
    baggageGroupId,
  };
}

describe("baggageGroupMembers", () => {
  it("同じグループの人だけを返す", () => {
    const list = [p("101", "g1"), p("102", "g2"), p("103", "g1"), p("104")];
    const members = baggageGroupMembers(list, "g1");
    expect(members.map((m) => m.serial)).toEqual(["101", "103"]);
  });

  it("リーダーを先頭にし、残りはシリアル順", () => {
    const list = [p("706", "g1"), p("402", "g1"), p("615", "g1")];
    const members = baggageGroupMembers(list, "g1", "p-615");
    expect(members.map((m) => m.serial)).toEqual(["615", "402", "706"]);
  });

  it("リーダー未設定ならシリアル順だけ", () => {
    const list = [p("706", "g1"), p("402", "g1"), p("615", "g1")];
    const members = baggageGroupMembers(list, "g1");
    expect(members.map((m) => m.serial)).toEqual(["402", "615", "706"]);
  });

  it("桁数が違っても数値として並ぶ", () => {
    const list = [p("1000", "g1"), p("99", "g1"), p("101", "g1")];
    const members = baggageGroupMembers(list, "g1");
    expect(members.map((m) => m.serial)).toEqual(["99", "101", "1000"]);
  });

  it("リーダーが別グループに移っていても落ちない", () => {
    const list = [p("706", "g1"), p("402", "g1")];
    const members = baggageGroupMembers(list, "g1", "p-999");
    expect(members.map((m) => m.serial)).toEqual(["402", "706"]);
  });

  it("所属者がいなければ空", () => {
    expect(baggageGroupMembers([p("101", "g2")], "g1")).toEqual([]);
  });

  it("元の配列を書き換えない", () => {
    const list = [p("706", "g1"), p("402", "g1")];
    baggageGroupMembers(list, "g1");
    expect(list.map((m) => m.serial)).toEqual(["706", "402"]);
  });
});

describe("missingBaggageGroupCodes", () => {
  it("グループが無ければ 1〜count を返す", () => {
    expect(missingBaggageGroupCodes([], 3)).toEqual(["1", "2", "3"]);
  });

  it("既にある番号は飛ばす", () => {
    expect(missingBaggageGroupCodes(["1", "3"], 5)).toEqual(["2", "4", "5"]);
  });

  it("既に count 以上あれば何も足さない", () => {
    expect(missingBaggageGroupCodes(["1", "2", "3"], 2)).toEqual([]);
  });

  it("番号以外のグループは数に入れない", () => {
    expect(missingBaggageGroupCodes(["A", "地方車1"], 2)).toEqual(["1", "2"]);
  });

  it("0・小数・空は何も返さない", () => {
    expect(missingBaggageGroupCodes([], 0)).toEqual([]);
    expect(missingBaggageGroupCodes([], 2.5)).toEqual([]);
    expect(missingBaggageGroupCodes([], Number.NaN)).toEqual([]);
  });

  it("上限を超えては作らない", () => {
    expect(missingBaggageGroupCodes([], 999)).toHaveLength(MAX_BAGGAGE_GROUPS);
  });
});
