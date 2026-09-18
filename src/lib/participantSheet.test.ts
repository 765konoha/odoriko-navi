import { describe, expect, it } from "vitest";
import {
  buildParticipantRows,
  findParticipantColumns,
  missingColumnLabels,
  parseSheet,
} from "./participantSheet";

const csv = (text: string) => parseSheet(text, ",")!;

describe("findParticipantColumns", () => {
  it("見出しから3列を探す", () => {
    expect(
      findParticipantColumns(["シリアル", "名前", "ニックネーム"]),
    ).toEqual({ serial: 0, name: 1, nickname: 2 });
  });

  it("列の並びが違っても読める", () => {
    expect(
      findParticipantColumns(["タイムスタンプ", "ニックネーム", "氏名", "シリアルナンバー"]),
    ).toEqual({ serial: 3, name: 2, nickname: 1 });
  });

  it("「ニックネーム」を名前の列として拾わない", () => {
    // 「ニックネーム」は「名前」を含むので、先に呼び名を決めて候補から外す
    expect(findParticipantColumns(["シリアル", "ニックネーム", "名前"])).toEqual(
      { serial: 0, name: 2, nickname: 1 },
    );
  });

  it("ペアのシリアル列は避ける", () => {
    expect(
      findParticipantColumns([
        "ペアメンバー(相手のシリアルナンバー)",
        "シリアル",
        "本名",
        "呼び名",
      ]),
    ).toEqual({ serial: 1, name: 2, nickname: 3 });
  });

  it("全角の見出しでも読める", () => {
    expect(findParticipantColumns(["シリアル", "名前", "あだ名"])).toEqual({
      serial: 0,
      name: 1,
      nickname: 2,
    });
  });

  it("足りない見出しがあれば null", () => {
    expect(findParticipantColumns(["シリアル", "名前"])).toBeNull();
    expect(findParticipantColumns(["名前", "ニックネーム"])).toBeNull();
  });
});

describe("missingColumnLabels", () => {
  it("足りない見出しを並べる", () => {
    expect(missingColumnLabels(["シリアル", "名前"])).toEqual(["ニックネーム"]);
    expect(missingColumnLabels(["日付"])).toEqual([
      "シリアル",
      "名前",
      "ニックネーム",
    ]);
    expect(missingColumnLabels(["シリアル", "氏名", "呼び名"])).toEqual([]);
  });
});

describe("buildParticipantRows", () => {
  const cols = { serial: 0, name: 1, nickname: 2 };

  it("行を組み立てる", () => {
    const sheet = csv("シリアル,名前,ニックネーム\n615,宮本祥平,みや\n706,松本望,のぞみ");
    const result = buildParticipantRows(sheet, cols);
    expect(result.rows).toEqual([
      { serial: "615", name: "宮本祥平", nickname: "みや" },
      { serial: "706", name: "松本望", nickname: "のぞみ" },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("先頭のゼロを落とさない", () => {
    const sheet = csv("シリアル,名前,ニックネーム\n001,全 太郎,ZEN");
    expect(buildParticipantRows(sheet, cols).rows[0].serial).toBe("001");
  });

  it("全部空の行は黙って飛ばす", () => {
    const sheet = csv("シリアル,名前,ニックネーム\n615,宮本祥平,みや\n,,\n706,松本望,のぞみ");
    const result = buildParticipantRows(sheet, cols);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it("欠けた行は理由を添えて飛ばし、全体は止めない", () => {
    const sheet = csv(
      "シリアル,名前,ニックネーム\n615,宮本祥平,みや\n706,松本望,\n,大渕由貴,ふっちー",
    );
    const result = buildParticipantRows(sheet, cols);
    expect(result.rows.map((r) => r.serial)).toEqual(["615"]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain("3行目");
    expect(result.errors[0]).toContain("706");
    expect(result.errors[1]).toContain("4行目");
  });

  it("重複したシリアルは最初の行を採る", () => {
    const sheet = csv("シリアル,名前,ニックネーム\n615,宮本祥平,みや\n615,別人,べつ");
    const result = buildParticipantRows(sheet, cols);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("宮本祥平");
    expect(result.errors[0]).toContain("重複");
  });

  it("行番号はシート上の番号(見出しが1行目)", () => {
    const sheet = csv("シリアル,名前,ニックネーム\n,,\n,松本望,のぞみ");
    expect(buildParticipantRows(sheet, cols).errors[0]).toContain("3行目");
  });

  it("前後の空白は落とす", () => {
    const sheet = csv('シリアル,名前,ニックネーム\n" 615 "," 宮本祥平 "," みや "');
    expect(buildParticipantRows(sheet, cols).rows[0]).toEqual({
      serial: "615",
      name: "宮本祥平",
      nickname: "みや",
    });
  });
});
