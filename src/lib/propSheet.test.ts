import { describe, expect, it } from "vitest";
import {
  analyzeSheet,
  buildHandoverSync,
  buildHolderSync,
  formatReport,
  columnIndex,
  columnLetter,
  createResolver,
  duplicateItemErrors,
  findEventGroups,
  normalizeName,
  parseCondition,
  parseEventDates,
  parseNames,
  planHandovers,
  planHolders,
  resolutionError,
  type DbSnapshot,
  type SheetLayout,
} from "./propSheet";

describe("normalizeName", () => {
  it("全角/半角・ひらがな/カタカナ・大小文字・伸ばし棒・空白をそろえる", () => {
    expect(normalizeName("ＺＥＮ")).toBe(normalizeName("zen"));
    expect(normalizeName("アスカ")).toBe(normalizeName("あすか"));
    expect(normalizeName("ｱｽｶ")).toBe(normalizeName("あすか"));
    expect(normalizeName("アミ―ラ")).toBe(normalizeName("アミーラ"));
    expect(normalizeName("ナカ ちゃん")).toBe(normalizeName("なかちゃん"));
  });

  it("文字が違えば別", () => {
    expect(normalizeName("けいすけ")).not.toBe(normalizeName("けーすけ"));
  });
});

describe("parseNames", () => {
  it("A→B は保有者なら B、持ち帰りなら A、使う人なら両方", () => {
    expect(parseNames("はっち→なお", "holder").names).toEqual(["なお"]);
    expect(parseNames("はっち→なお", "takeHome").names).toEqual(["はっち"]);
    expect(parseNames("はっち→なお", "users").names).toEqual(["はっち", "なお"]);
  });

  it("・ / 、は複数人", () => {
    expect(parseNames("みどり・なり", "holder").names).toEqual(["みどり", "なり"]);
    expect(parseNames("たかゆき/なお", "users").names).toEqual(["たかゆき", "なお"]);
  });

  it("記号・括弧・※ を除く", () => {
    expect(parseNames("●あすか", "holder").names).toEqual(["あすか"]);
    expect(parseNames("あかね→ちえこ◯", "holder").names).toEqual(["ちえこ"]);
    expect(parseNames("たま/よーすけ★（男）", "users").names).toEqual(["たま", "よーすけ"]);
    expect(parseNames("ちえこ(10/18)", "holder").names).toEqual(["ちえこ"]);
    expect(parseNames("なつこ※故障", "holder").names).toEqual(["なつこ"]);
    expect(parseNames("もぎ(故障→補強)", "holder").names).toEqual(["もぎ"]);
  });

  it("ＮＥＷ（ちえこ）は ちえこ", () => {
    expect(parseNames("ＮＥＷ（ちえこ）", "holder").names).toEqual(["ちえこ"]);
  });

  it("行:A 帰:B は帰り", () => {
    expect(parseNames("行:たくみ　帰:なり", "holder").names).toEqual(["なり"]);
    expect(parseNames("行:たくみ　帰:なり", "users").names).toEqual(["たくみ", "なり"]);
  });

  it("空欄・#N/A・✖ は名前なし、貸出はスキップ", () => {
    expect(parseNames("", "holder")).toEqual({ names: [] });
    expect(parseNames("#N/A", "holder")).toEqual({ names: [] });
    expect(parseNames("✖️         /めが　/✖️", "users").names).toEqual(["めが"]);
    expect(parseNames("※故障（処分）", "holder").names).toEqual([]);
    expect(parseNames("カナダチームへ貸出", "holder")).toEqual({
      names: [],
      skip: "貸出",
    });
  });

  it("同じ人は1回", () => {
    expect(parseNames("ZEN・すぐる/やまり/すぐる", "users").names).toEqual([
      "ZEN",
      "すぐる",
      "やまり",
    ]);
  });
});

describe("parseCondition", () => {
  it("空欄は正常、読めないものは null", () => {
    expect(parseCondition("")).toBe("normal");
    expect(parseCondition("故障")).toBe("broken");
    expect(parseCondition("修理中")).toBe("repairing");
    expect(parseCondition("こわれた")).toBeNull();
  });
});

describe("parseEventDates", () => {
  it("いろいろな書き方", () => {
    expect(parseEventDates("2026-03-22", 2026)).toEqual(["2026-03-22"]);
    expect(parseEventDates("2026/3/22", 2026)).toEqual(["2026-03-22"]);
    expect(parseEventDates("8/29・30", 2026)).toEqual(["2026-08-29", "2026-08-30"]);
    expect(parseEventDates("10/10-11", 2026)).toEqual(["2026-10-10", "2026-10-11"]);
    expect(parseEventDates("8/9-12", 2026)).toEqual([
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
    expect(parseEventDates("5/15,17", 2026)).toEqual(["2026-05-15", "2026-05-17"]);
    expect(parseEventDates("2.22", 2026)).toEqual(["2026-02-22"]);
    expect(parseEventDates("光が丘", 2026)).toEqual([]);
  });
});

describe("columnLetter / columnIndex", () => {
  it("相互に変換できる", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(79)).toBe("CB");
    expect(columnIndex("CB")).toBe(79);
    expect(columnIndex("ｄ")).toBe(3);
    expect(columnIndex("1")).toBe(-1);
  });
});

// 実際のシートを縮めたもの。上に操作欄の行があり、見出しは C 列の文字で探す
//            A      B     C         D          E        F        G          H         I       J              K              L
const grid: string[][] = [
  ["踊り子ナビ連携"],
  ["", "", "■保有者・状態を更新", "F列 原宿"],
  [],
  ["", "", "現在の保管"],
  ["", "", "お祭り・イベント", "2025年からの保管者", "原宿", "リレー", "高知", "リレー\n行き", "リレー\n帰り", "現在の保管者", "備考", "状態"],
  ["", "", "日付", "", "8/29・30", "", "8/9-12", "", "", "", "", ""],
  ["", "", "演舞作品"],
  ["", "", "ステージ/流し"],
  ["提\n灯", "白①", "", "ちえこ", "ももか・あかね", "ちえこ", "", "", "", "", "", ""],
  ["", "白②", "", "ちえこ", "たくみ", "", "", "", "", "", "", "故障"],
  ["", "赤①", "", "ちえこ", "", "", "みや", "はむ", "", "", "", ""],
  ["", "赤②", "", "ちえこ", "", "", "", "", "", "", "", ""],
  ["", "予備", "", "カナダチームへ貸出", "", "", "", "", "", "", "", ""],
  ["", "予備", "", "", "", "", "", "", "", "", "", ""],
  ["太\n鼓", "１", "", "ちえこ", "", "", "みや/ねお", "", "ねお→ちえこ", "", "", "こわれた"],
];

function layoutOf(): SheetLayout {
  const result = analyzeSheet(grid, 2026);
  if ("error" in result) throw new Error(result.error);
  return result.layout;
}

describe("analyzeSheet", () => {
  it("見出しの行を C 列の文字で見つけ、小道具とお祭りを読む", () => {
    const layout = layoutOf();
    expect(layout.headerRow).toBe(4);
    expect(layout.items.map((i) => `${i.category} ${i.identifier} ${i.row}`)).toEqual([
      "提灯 白① 9",
      "提灯 白② 10",
      "提灯 赤① 11",
      "提灯 赤② 12",
      "提灯 予備 13",
      "提灯 予備 14",
      "太鼓 1 15",
    ]);
    expect(layout.groups.map((g) => [g.name, g.relays.map((r) => r.kind)])).toEqual([
      ["2025年からの保管者", []],
      ["原宿", ["plain"]],
      ["高知", ["go", "back"]],
    ]);
    expect(layout.timelineEnd).toBe(9);
    expect(layout.statusCol).toBe(11);
  });

  it("見出しが無ければエラー", () => {
    expect(analyzeSheet([["a"], ["b"]], 2026)).toHaveProperty("error");
  });

  it("番号の重複を知らせる", () => {
    expect(duplicateItemErrors(layoutOf().items)).toEqual([
      "提灯「予備」が2行あります（13・14行目）。番号を区別してください。",
    ]);
  });
});

describe("planHolders", () => {
  it("基準の列までで一番右のセルを読む", () => {
    const layout = layoutOf();
    const byId = (col: number) =>
      Object.fromEntries(
        planHolders(layout, col).map((p) => [
          `${p.item.category}${p.item.identifier}${p.item.row}`,
          p.parsed.skip ?? p.parsed.names.join("・"),
        ]),
      );
    // 原宿のリレー(F列)まで: 高知の予定(G〜I列)は見ない
    expect(byId(columnIndex("F"))).toMatchObject({
      "提灯白①9": "ちえこ",
      "提灯白②10": "たくみ",
      "提灯赤①11": "ちえこ",
      "提灯予備13": "貸出",
      "提灯予備14": "",
      "太鼓115": "ちえこ",
    });
    // 高知の帰り(I列)まで
    expect(byId(columnIndex("I"))).toMatchObject({
      "提灯赤①11": "はむ",
      "太鼓115": "ちえこ",
    });
  });

  it("状態列を読む", () => {
    const plans = planHolders(layoutOf(), columnIndex("F"));
    expect(plans[1].condition).toBe("broken");
    expect(plans[0].condition).toBe("normal");
    expect(plans[6].condition).toBeNull();
  });
});

describe("planHandovers", () => {
  it("リレー列に名前があればその人、空欄なら使った人が持ち帰る", () => {
    const layout = layoutOf();
    const [harajuku] = findEventGroups(layout, "2026-08-30");
    expect(harajuku.name).toBe("原宿");
    const plans = planHandovers(layout, harajuku);
    expect(
      plans.map((p) => [p.item.identifier, p.receivers, p.givers]),
    ).toEqual([
      ["白①", ["ちえこ"], ["ももか", "あかね"]],
      ["白②", ["たくみ"], null],
    ]);
  });

  it("行き/帰りがあるお祭りは帰りが持ち帰り。A→B なら A", () => {
    const layout = layoutOf();
    const [kochi] = findEventGroups(layout, "2026-08-11");
    const plans = planHandovers(layout, kochi);
    expect(
      plans.map((p) => [p.item.identifier, p.receivers, p.givers]),
    ).toEqual([
      // 帰りが空欄 → 使った人(みや)が持ち帰る。渡す人は行きの人(はむ)
      ["赤①", ["みや"], ["はむ"]],
      // 帰りが「ねお→ちえこ」→ 当日はねおが持ち帰る。渡す人は使った人のうちねお以外
      ["1", ["ねお"], ["みや"]],
    ]);
  });

  it("対象日にお祭りが無ければ空", () => {
    expect(findEventGroups(layoutOf(), "2026-12-01")).toEqual([]);
  });
});

describe("createResolver", () => {
  const resolve = createResolver({
    aliases: [["けーすけ", "K-015"], ["まみっこ", "999"]],
    roster: [
      { serial: "615", nickname: "みや" },
      { serial: "101", nickname: "なお" },
      { serial: "205", nickname: "ナオ" },
      { serial: "K-015", nickname: "けいすけ" },
      { serial: "001", nickname: "ZEN" },
    ],
    serials: new Set(["615", "101", "205", "K-015", "001"]),
  });

  it("名前対応表 → 名簿 → シリアルの順に探す", () => {
    expect(resolve("けーすけ")).toEqual({ serial: "K-015" });
    expect(resolve("ミヤ")).toEqual({ serial: "615" });
    expect(resolve("ＺＥＮ")).toEqual({ serial: "001" });
    expect(resolve("Ｋ－０１５")).toEqual({ serial: "K-015" });
  });

  it("複数・見つからない・対応表の誤り", () => {
    expect(resolve("なお")).toEqual({ error: "ambiguous", candidates: ["101", "205"] });
    expect(resolve("あすこ")).toEqual({ error: "notFound" });
    expect(resolve("まみっこ")).toEqual({ error: "badAlias", serial: "999" });
  });

  it("エラー文", () => {
    const item = { category: "提灯", identifier: "白①", row: 12 };
    expect(resolutionError(item, "あすこ", { error: "notFound" })).toBe(
      "提灯 白①（12行目）の行の「あすこ」について、特定ができませんでした。表記をアプリ上の名簿と一致させるようにしてください。",
    );
  });
});

describe("buildHolderSync / buildHandoverSync", () => {
  const resolve = createResolver({
    aliases: [],
    roster: [
      { serial: "200", nickname: "ちえこ" },
      { serial: "301", nickname: "ももか" },
      { serial: "302", nickname: "あかね" },
      { serial: "303", nickname: "たくみ" },
      { serial: "615", nickname: "みや" },
      { serial: "304", nickname: "はむ" },
      { serial: "305", nickname: "ねお" },
    ],
    serials: new Set(["200", "301", "302", "303", "615", "304", "305"]),
  });
  const names = new Map([
    ["200", "ちえこ"],
    ["303", "たくみ"],
    ["305", "ねお"],
    ["615", "みや"],
    ["304", "はむ"],
  ]);

  it("保有者: 新規登録・変更・状態・エラーを分ける", () => {
    const db: DbSnapshot = {
      items: [
        { id: "i1", category: "提灯", identifier: "白①", condition: "normal", holders: ["200"], isArchived: false },
        { id: "i2", category: "提灯", identifier: "白②", condition: "normal", holders: ["200"], isArchived: false },
      ],
      transfers: [],
      names,
    };
    const result = buildHolderSync(layoutOf(), columnIndex("F"), resolve, db);
    // 白① はちえこのまま(変更なし)、白② はたくみに・状態は故障に
    expect(result.payload.find((p) => p.item_id === "i1")).toBeUndefined();
    expect(result.payload.find((p) => p.item_id === "i2")).toEqual({
      item_id: "i2",
      category: "提灯",
      identifier: "白②",
      holders: ["303"],
      condition: "broken",
    });
    // 赤①・赤②・太鼓1 は新しく登録(太鼓1 は状態だけが読めない)
    expect(result.payload.filter((p) => !p.item_id).map((p) => p.identifier)).toEqual([
      "赤①",
      "赤②",
      "1",
    ]);
    // 予備は重複のため反映しない。太鼓1 は状態が読めない
    expect(result.errors).toEqual([
      "提灯「予備」が2行あります（13・14行目）。番号を区別してください。",
      "太鼓 1（15行目）の状態「こわれた」が読み取れません。正常・破損・故障・紛失・修理中・使用停止のどれかにしてください。",
    ]);
    expect(result.changes).toContain("提灯 白②: ちえこ → たくみ");
    expect(formatReport("【確認】", result)).toContain("エラー 2 件");
  });

  it("受け渡し: 名前が特定できなければエラー、アプリに無い小道具もエラー", () => {
    const db: DbSnapshot = {
      items: [
        { id: "i1", category: "提灯", identifier: "白①", condition: "normal", holders: ["303"], isArchived: false },
        { id: "i3", category: "太鼓", identifier: "1", condition: "normal", holders: ["200"], isArchived: false },
      ],
      transfers: [
        { id: "t9", itemId: "i3", status: "pending", sheetDate: "2026-08-30", receivers: ["304"] },
      ],
      names,
    };
    const layout = layoutOf();
    const [harajuku] = findEventGroups(layout, "2026-08-29");
    const result = buildHandoverSync(layout, harajuku, resolve, db);
    expect(result.date).toBe("2026-08-30");
    expect(result.payload).toEqual([
      { item_id: "i1", receivers: ["200"], givers: ["301", "302"] },
    ]);
    // 白① はちえこが持ち帰る(今の保有者はたくみ)。渡す人は使ったももか・あかね
    expect(result.errors).toEqual([
      "提灯 白②（10行目）はアプリに登録されていません。先に「保有者・状態を更新」を押してください。",
    ]);
    // 太鼓1 のこの日の予定はスプシから外れたので取り消し
    expect(result.changes).toContain("取り消し: 太鼓 1（スプレッドシートの予定から外れたため）");
  });
});

describe("buildHandoverSync(持ち帰る人が今の保有者と同じ)", () => {
  it("受け渡しは作らず、お知らせにまとめる", () => {
    const resolve = createResolver({
      aliases: [],
      roster: [
        { serial: "200", nickname: "ちえこ" },
        { serial: "301", nickname: "ももか" },
        { serial: "302", nickname: "あかね" },
      ],
      serials: new Set(["200", "301", "302"]),
    });
    const db: DbSnapshot = {
      items: [
        { id: "i1", category: "提灯", identifier: "白①", condition: "normal", holders: ["200"], isArchived: false },
      ],
      transfers: [],
      names: new Map(),
    };
    const layout = layoutOf();
    const [harajuku] = findEventGroups(layout, "2026-08-29");
    const result = buildHandoverSync(layout, harajuku, resolve, db);
    expect(result.payload).toEqual([]);
    expect(result.notices).toContain(
      "持ち帰る人が今の保有者と同じ 1 件は、受け渡しを作りません。",
    );
  });
});
