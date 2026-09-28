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
