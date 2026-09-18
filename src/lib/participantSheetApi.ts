import { supabase } from "./supabase";

// 名簿シートの同期設定(運営のみ)。
// シートのURLはこの表にだけ置き、踊り子側へは配らない。
// URLの解析は出欠と同じものを使う(parseSheetUrl)。

function client() {
  if (!supabase) throw new Error("Supabaseが設定されていません");
  return supabase;
}

export interface ParticipantSheetSync {
  festivalId: string;
  sheetId: string;
  gid: string;
  lastSyncedAt?: string;
  lastResult?: string;
  lastOk?: boolean;
}

interface Row {
  festival_id: string;
  sheet_id: string;
  gid: string;
  last_synced_at: string | null;
  last_result: string | null;
  last_ok: boolean | null;
}

const COLUMNS =
  "festival_id, sheet_id, gid, last_synced_at, last_result, last_ok";

function toSync(row: Row): ParticipantSheetSync {
  return {
    festivalId: row.festival_id,
    sheetId: row.sheet_id,
    gid: row.gid,
    lastSyncedAt: row.last_synced_at ?? undefined,
    lastResult: row.last_result ?? undefined,
    lastOk: row.last_ok ?? undefined,
  };
}

export async function getParticipantSheetSync(
  festivalId: string,
): Promise<ParticipantSheetSync | null> {
  if (!supabase) return null;
  const { data, error } = await client()
    .from("participant_sheet_sync")
    .select(COLUMNS)
    .eq("festival_id", festivalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSync(data as Row) : null;
}

export async function saveParticipantSheetSync(
  festivalId: string,
  sheetId: string,
  gid: string,
): Promise<void> {
  const { error } = await client()
    .from("participant_sheet_sync")
    .upsert(
      {
        festival_id: festivalId,
        sheet_id: sheetId,
        gid,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "festival_id" },
    );
  if (error) throw new Error(error.message);
}

export async function deleteParticipantSheetSync(
  festivalId: string,
): Promise<void> {
  const { error } = await client()
    .from("participant_sheet_sync")
    .delete()
    .eq("festival_id", festivalId);
  if (error) throw new Error(error.message);
}

/** 「今すぐ同期」。結果の文言をそのまま返す。 */
export async function runParticipantSheetSync(
  festivalId: string,
): Promise<string> {
  const { data, error } = await client().functions.invoke("sync-participants", {
    body: { festivalId },
  });
  if (error) throw new Error(error.message);
  const results = (data as { results?: { message: string }[] } | null)?.results;
  return results?.[0]?.message ?? "同期しました";
}
