import { describe, expect, it } from "vitest";
import { buildImportRows } from "./attendanceImport";

describe("buildImportRows(シリアルの表記)", () => {
  it("出欠シートの全角シリアルを半角にそろえる", () => {
    const sheet = {
      header: ["シリアル", "9/6"],
      rows: [
        ["Ｋ－０１５", "①"],
        ["615", "⑤"],
      ],
    };
    const r = buildImportRows(sheet, 0, 1, null);
    expect(r.rows.map((x) => x.serial)).toEqual(["K-015", "615"]);
  });
});

describe("buildImportRows(同じシリアルの回答が複数ある)", () => {
  it("下の行(後の回答)を採用し、1シリアル1行にする", () => {
    const sheet = {
      header: ["シリアル", "9/6", "9/6 時刻"],
      rows: [
        ["K-015", "⑤", ""],
        ["615", "①", ""],
        ["K-015", "②", "19:30in"],
      ],
    };
    const r = buildImportRows(sheet, 0, 1, 2);
    expect(r.rows).toEqual([
      { serial: "K-015", status: "late", timeNote: "19:30in" },
      { serial: "615", status: "present", timeNote: undefined },
    ]);
    expect(r.duplicates).toEqual(["K-015"]);
  });

  it("全角と半角で2行あっても1行にまとまる", () => {
    const sheet = {
      header: ["シリアル", "9/6"],
      rows: [
        ["Ｋ－０１５", "①"],
        ["K-015", "⑤"],
      ],
    };
    const r = buildImportRows(sheet, 0, 1, null);
    expect(r.rows).toEqual([{ serial: "K-015", status: "absent", timeNote: undefined }]);
    expect(r.duplicates).toEqual(["K-015"]);
  });

  it("後の行が空欄なら、前の回答を残す(空欄は既存の回答を消さない)", () => {
    const sheet = {
      header: ["シリアル", "9/6"],
      rows: [
        ["K-015", "①"],
        ["K-015", ""],
      ],
    };
    const r = buildImportRows(sheet, 0, 1, null);
    expect(r.rows).toEqual([{ serial: "K-015", status: "present", timeNote: undefined }]);
    expect(r.duplicates).toEqual([]);
    expect(r.blankCount).toBe(1);
  });

  it("重複が無ければ duplicates は空", () => {
    const sheet = { header: ["シリアル", "9/6"], rows: [["615", "①"], ["216", "⑤"]] };
    expect(buildImportRows(sheet, 0, 1, null).duplicates).toEqual([]);
  });
});
