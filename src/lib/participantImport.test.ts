import { describe, expect, it } from "vitest";
import { parseParticipantPaste } from "./participantImport";

describe("parseParticipantPaste", () => {
  it("シリアルの全角英数字・記号を半角にそろえる", () => {
    const r = parseParticipantPaste("Ｋ－０１５\t木村\tきむ\nｓ１０３\t佐藤\tさと");
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.serial)).toEqual(["K-015", "s103"]);
  });

  it("名前・ニックネームの全角はそのまま", () => {
    const r = parseParticipantPaste("K-015\tＫｉｍｕｒａ\tきむ");
    expect(r.rows[0]).toEqual({ serial: "K-015", name: "Ｋｉｍｕｒａ", nickname: "きむ" });
  });

  it("日本語のシリアルはそのまま", () => {
    const r = parseParticipantPaste("カメラマン\t山田\tやま");
    expect(r.rows[0].serial).toBe("カメラマン");
  });

  it("全角と半角で同じシリアルが2行あれば重複として止める", () => {
    const r = parseParticipantPaste("K-015\t木村\tきむ\nＫ－０１５\t木村\tきむ");
    expect(r.errors).toEqual(["2行目: シリアル「K-015」が重複しています"]);
  });
});
