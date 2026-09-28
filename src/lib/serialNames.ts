import { supabase } from "./supabase";
import { mockNicknamesBySerial } from "../data/mock/participants";

// シリアル選択画面に添える呼び名。
//
// 祭りによってニックネームが違う人がいるため、どれか1つに絞らず、
// 祭りごとの名簿に登録されているニックネームを並べて出す。
// 並びは新しく登録された祭りから順。同じニックネームは1回だけ。

export interface RosterNameRow {
  serial: string;
  nickname: string;
}

/**
 * シリアル → ニックネームの一覧。
 * rows は新しい順に並んでいること(先に出たものを先に並べる)。
 */
export function nicknamesBySerial(rows: RosterNameRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const nickname = row.nickname.trim();
    if (nickname === "") continue;
    const list = map.get(row.serial);
    if (!list) map.set(row.serial, [nickname]);
    else if (!list.includes(nickname)) list.push(nickname);
  }
  return map;
}

/** 「615 / みや・みやもと」形式。呼び名が分からなければシリアルだけ */
export function serialOptionLabel(
  serial: string,
  names: Map<string, string[]>,
): string {
  const list = names.get(serial);
  return list && list.length > 0 ? `${serial} / ${list.join("・")}` : serial;
}

/** 1回に読む行数(Supabase の既定の上限に合わせる) */
const PAGE = 1000;

/** 全ての祭りの名簿からニックネームを集める。読めなければ空で返す */
export async function loadNicknamesBySerial(): Promise<Map<string, string[]>> {
  if (!supabase) return mockNicknamesBySerial();
  const rows: RosterNameRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("festival_participants")
      .select("serial, nickname")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return new Map();
    const page = (data ?? []) as RosterNameRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return nicknamesBySerial(rows);
}
