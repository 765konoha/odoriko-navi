import { describe, expect, it } from "vitest";
import type { FestivalParticipant } from "../types/domain";
import { diffParticipants, hasParticipantChanges } from "./participantDiff";

function p(
  id: string,
  serial: string,
  name: string,
  nickname: string,
): FestivalParticipant {
  return { id, festivalId: "f", serial, name, nickname, roleIds: ["r"] };
}
const row = (serial: string, name: string, nickname: string) => ({
  serial,
  name,
  nickname,
});

const roster = [
  p("a", "012", "青木", "あお"),
  p("b", "1103", "井上", "いの"),
  p("c", "s205", "上田", "うえ"),
];

describe("diffParticipants", () => {
  it("同じ内容を貼り直しても何も反映しない", () => {
    const d = diffParticipants(roster, [
      row("012", "青木", "あお"),
      row("1103", "井上", "いの"),
      row("s205", "上田", "うえ"),
    ]);
    expect(d.unchanged).toBe(3);
    expect(d.added).toEqual([]);
    expect(d.changed).toEqual([]);
    expect(d.missing).toEqual([]);
    expect(hasParticipantChanges(d)).toBe(false);
  });

  it("名簿にいない人は追加に入る", () => {
    const d = diffParticipants(roster, [
      row("012", "青木", "あお"),
      row("1104", "江口", "えぐ"),
    ]);
    expect(d.added).toEqual([row("1104", "江口", "えぐ")]);
    expect(hasParticipantChanges(d)).toBe(true);
  });

  it("名前やニックネームが変わった人は変更に入り、名簿のIDで更新する", () => {
    const d = diffParticipants(roster, [
      row("012", "青木", "あおちゃん"),
      row("1103", "井上(旧姓)", "いの"),
    ]);
    expect(d.changed).toEqual([
      {
        id: "a",
        serial: "012",
        before: { name: "青木", nickname: "あお" },
        after: { name: "青木", nickname: "あおちゃん" },
      },
      {
        id: "b",
        serial: "1103",
        before: { name: "井上", nickname: "いの" },
        after: { name: "井上(旧姓)", nickname: "いの" },
      },
    ]);
  });

  it("シートにいない人は消さずに一覧に出すだけ", () => {
    const d = diffParticipants(roster, [row("012", "青木", "あお")]);
    expect(d.missing.map((m) => m.serial)).toEqual(["1103", "s205"]);
    expect(hasParticipantChanges(d)).toBe(false);
  });

  it("先頭の0が落ちたシリアルは名簿の人に読み替え、別人として追加しない", () => {
    const d = diffParticipants(roster, [row("12", "青木", "あお")]);
    expect(d.added).toEqual([]);
    expect(d.unchanged).toBe(1);
    expect(d.normalized).toEqual([{ sheet: "12", roster: "012" }]);
    expect(d.missing.map((m) => m.serial)).toEqual(["1103", "s205"]);
  });

  it("読み替えた人の名前が変わっていれば、名簿のシリアルのまま変更に入る", () => {
    const d = diffParticipants(roster, [row("12", "青木", "あおちゃん")]);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0].serial).toBe("012");
    expect(d.changed[0].id).toBe("a");
  });

  it("大文字小文字の違いも読み替える", () => {
    const d = diffParticipants(roster, [row("S205", "上田", "うえ")]);
    expect(d.normalized).toEqual([{ sheet: "S205", roster: "s205" }]);
    expect(d.added).toEqual([]);
  });

  it("完全一致を優先する(読み替えの行が先にあっても本人の行を奪わない)", () => {
    const d = diffParticipants(roster, [
      row("12", "別の人", "べつ"),
      row("012", "青木", "あお"),
    ]);
    // 12 は 012 に読み替えず、新しい人として扱う
    expect(d.added).toEqual([row("12", "別の人", "べつ")]);
    expect(d.unchanged).toBe(1);
    expect(d.normalized).toEqual([]);
    expect(d.errors).toEqual([]);
  });

  it("名簿に先頭の0だけ違う人が2人いれば、どちらにも読み替えない", () => {
    const twins = [p("x", "012", "甲", "こう"), p("y", "0012", "乙", "おつ")];
    const d = diffParticipants(twins, [row("12", "丙", "へい")]);
    expect(d.normalized).toEqual([]);
    expect(d.added).toEqual([row("12", "丙", "へい")]);
  });

  it("二つの行が読み替えで同じ人を指したら、反映を止める", () => {
    const d = diffParticipants(roster, [
      row("12", "青木", "あお"),
      row("0012", "青木", "あお"),
    ]);
    expect(d.errors).toHaveLength(1);
    expect(d.errors[0]).toContain("0012");
  });

  it("名簿が空なら全員が追加になる(初回の一括登録と同じ)", () => {
    const rows = [row("012", "青木", "あお"), row("1103", "井上", "いの")];
    const d = diffParticipants([], rows);
    expect(d.added).toEqual(rows);
    expect(d.missing).toEqual([]);
  });
});
