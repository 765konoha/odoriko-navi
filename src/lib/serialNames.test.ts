import { describe, expect, it } from "vitest";
import { nicknamesBySerial, serialOptionLabel } from "./serialNames";

describe("nicknamesBySerial", () => {
  it("祭りごとのニックネームを、新しい祭りから順に並べる", () => {
    const map = nicknamesBySerial([
      { serial: "615", nickname: "みやもと" }, // 新潟(新しい)
      { serial: "615", nickname: "みや" }, // 原宿
    ]);
    expect(map.get("615")).toEqual(["みやもと", "みや"]);
  });

  it("同じニックネームは1回だけ", () => {
    const map = nicknamesBySerial([
      { serial: "216", nickname: "ふっちー" },
      { serial: "216", nickname: "ふっちー" },
    ]);
    expect(map.get("216")).toEqual(["ふっちー"]);
  });

  it("空のニックネームは数えない", () => {
    const map = nicknamesBySerial([
      { serial: "108", nickname: " " },
      { serial: "108", nickname: "りく" },
    ]);
    expect(map.get("108")).toEqual(["りく"]);
  });
});

describe("serialOptionLabel", () => {
  const names = new Map([
    ["615", ["みやもと", "みや"]],
    ["216", ["ふっちー"]],
  ]);
  it("複数あれば「・」で並記する", () => {
    expect(serialOptionLabel("615", names)).toBe("615 / みやもと・みや");
  });
  it("1つならそのまま", () => {
    expect(serialOptionLabel("216", names)).toBe("216 / ふっちー");
  });
  it("どの祭りの名簿にもいなければシリアルだけ", () => {
    expect(serialOptionLabel("406", names)).toBe("406");
  });
});
