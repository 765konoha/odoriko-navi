import { describe, expect, it } from "vitest";
import { countedSerials, tallyAttendances } from "./rehearsalCount";
import type { Attendance } from "../types/rehearsal";

const people = [
  { serial: "001", roleIds: ["dancer"] },
  { serial: "002", roleIds: ["leader"] },
  { serial: "003", roleIds: ["manager"] },
  { serial: "004", roleIds: ["manager", "dancer"] },
  { serial: "005", roleIds: [] },
];

describe("countedSerials", () => {
  it("集計に含める役職を1つでも持つ人だけ", () => {
    expect([...countedSerials(people, new Set(["dancer", "leader"]))]).toEqual([
      "001",
      "002",
      "004",
    ]);
  });

  it("設定を読めないときは全員", () => {
    expect(countedSerials(people, null).size).toBe(5);
  });
});

describe("tallyAttendances", () => {
  const a = (serial: string): Attendance => ({
    rehearsalId: "r1",
    serial,
    status: "present",
  });

  it("対象外の人の回答は数えず、対象の人の未回答を返す", () => {
    const result = tallyAttendances(
      [a("001"), a("003")],
      new Set(["001", "002", "004"]),
    );
    expect(result.counted.map((x) => x.serial)).toEqual(["001"]);
    expect(result.noAnswer).toEqual(["002", "004"]);
  });
});
