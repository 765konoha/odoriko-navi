// Supabase Edge Function: sync-participants
//
// 名簿のスプレッドシートを読みに行き、festival_participants に反映する。
// 祭りのたびに同じ名簿を貼り直さずに済ませるため。
//
// 呼び出しは運営画面の「今すぐ同期」だけ(ログイン必須)。
// 名簿には本名が入るので、踊り子側からは呼べないようにしている。
//
// シートは「リンクを知っている全員が閲覧可」を前提に、書き出しURLから CSV を取る。
// シートのURLはこの関数(サーバー側)だけが扱い、ブラウザには配らない。
//
// この同期は足す・直すだけで、消さない。
// シートから消えた人を自動で削除すると、その人宛ての個人お知らせや
// 荷物グループの所属も一緒に消えてしまうため。
// シートに無い登録者は件数と名前を結果に出し、運営が画面から判断して消す。

import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchSheetCsv } from "../_shared/sheetFetch.ts";
import {
  buildParticipantRows,
  findParticipantColumns,
  missingColumnLabels,
  parseSheet,
} from "../_shared/participantParse.ts";

// 差し替えたことを画面から確かめられるようにする
const FUNCTION_VERSION = "2026-09-18a";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SyncSetting {
  festival_id: string;
  sheet_id: string;
  gid: string;
}

interface Outcome {
  ok: boolean;
  message: string;
  detail?: string;
  clearGid?: boolean;
}

/** 一度に投げる件数(名簿は数百人になることがある) */
const CHUNK = 200;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function syncFestival(
  admin: ReturnType<typeof createClient>,
  setting: SyncSetting,
): Promise<Outcome> {
  const fetched = await fetchSheetCsv(setting.sheet_id, setting.gid);
  if (!fetched.ok || fetched.csv == null) {
    return {
      ok: false,
      message: fetched.message ?? "シートを読めませんでした。",
      detail: fetched.detail,
      clearGid: fetched.clearGid,
    };
  }

  const sheet = parseSheet(fetched.csv, ",");
  if (!sheet) {
    return {
      ok: false,
      message: "見出し行とデータ行を読み取れませんでした。",
      detail: `取得先: ${fetched.url}`,
      clearGid: fetched.clearGid,
    };
  }

  const columns = findParticipantColumns(sheet.header);
  if (!columns) {
    const missing = missingColumnLabels(sheet.header);
    return {
      ok: false,
      message:
        `見出しに ${missing.join("・")} の列が見つかりませんでした。` +
        "1行目を見出しにして、シリアル・名前・ニックネームの列を作ってください。",
      detail: `取得先: ${fetched.url} / 見出し: ${sheet.header.join(" | ")}`,
      clearGid: fetched.clearGid,
    };
  }

  const { rows, errors } = buildParticipantRows(sheet, columns);
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        "登録できる行がありませんでした。" +
        (errors.length > 0 ? ` (${errors.slice(0, 3).join(" / ")})` : ""),
      detail: `取得先: ${fetched.url}`,
      clearGid: fetched.clearGid,
    };
  }

  // 参加者マスターに無いシリアルは外部キーで弾かれるため、先に足す
  for (const part of chunk(rows, CHUNK)) {
    const { error } = await admin
      .from("participants")
      .upsert(part.map((r) => ({ serial: r.serial })), {
        onConflict: "serial",
        ignoreDuplicates: true,
      });
    if (error) {
      return { ok: false, message: `マスターへの追加に失敗: ${error.message}` };
    }
  }

  // 反映前の状態。追加と更新の件数を分けて出すために見ておく
  const { data: before, error: beforeError } = await admin
    .from("festival_participants")
    .select("serial, name, nickname")
    .eq("festival_id", setting.festival_id);
  if (beforeError) {
    return { ok: false, message: `既存の名簿を読めません: ${beforeError.message}` };
  }
  const existing = new Map(
    ((before ?? []) as { serial: string; name: string; nickname: string }[]).map(
      (p) => [p.serial, p],
    ),
  );

  const added = rows.filter((r) => !existing.has(r.serial));
  const changed = rows.filter((r) => {
    const cur = existing.get(r.serial);
    return cur != null && (cur.name !== r.name || cur.nickname !== r.nickname);
  });

  for (const part of chunk(rows, CHUNK)) {
    const { error } = await admin.from("festival_participants").upsert(
      part.map((r) => ({
        festival_id: setting.festival_id,
        serial: r.serial,
        name: r.name,
        nickname: r.nickname,
      })),
      { onConflict: "festival_id,serial" },
    );
    if (error) return { ok: false, message: `保存に失敗: ${error.message}` };
  }

  // 新しく入った人にだけ既定役職(踊り子一般)を付ける。
  // 既にいる人の役職は触らない(運営が画面で付けたものを消さないため)
  let roleNote = "";
  if (added.length > 0) {
    const { data: role } = await admin
      .from("festival_roles")
      .select("id")
      .eq("festival_id", setting.festival_id)
      .eq("is_default", true)
      .maybeSingle();
    const roleId = (role as { id: string } | null)?.id;
    if (roleId) {
      const { data: inserted } = await admin
        .from("festival_participants")
        .select("id, serial")
        .eq("festival_id", setting.festival_id)
        .in("serial", added.map((r) => r.serial));
      const links = ((inserted ?? []) as { id: string; serial: string }[]).map(
        (p) => ({ festival_participant_id: p.id, role_id: roleId }),
      );
      for (const part of chunk(links, CHUNK)) {
        const { error } = await admin
          .from("festival_participant_roles")
          .upsert(part, {
            onConflict: "festival_participant_id,role_id",
            ignoreDuplicates: true,
          });
        if (error) {
          roleNote = ` / 役職の設定に失敗: ${error.message}`;
          break;
        }
      }
    } else {
      roleNote = " / 既定役職(踊り子一般)が無いため役職は付けていません";
    }
  }

  // シートから消えた人は消さない。件数と名前を出して運営に判断してもらう
  const inSheet = new Set(rows.map((r) => r.serial));
  const missing = [...existing.values()].filter((p) => !inSheet.has(p.serial));
  const missingNote =
    missing.length > 0
      ? ` / シートに無い登録者 ${missing.length}名(消していません: ` +
        missing
          .slice(0, 10)
          .map((p) => `${p.serial} ${p.nickname}`)
          .join("、") +
        (missing.length > 10 ? " ほか" : "") +
        ")"
      : "";

  const skippedNote =
    errors.length > 0
      ? ` / 読み飛ばし ${errors.length}行(${errors.slice(0, 3).join(" / ")}${
          errors.length > 3 ? " ほか" : ""
        })`
      : "";

  const gidNote = fetched.clearGid
    ? ` タブの指定(gid=${setting.gid})では読めなかったため、先頭のタブを読みました。`
    : "";

  return {
    ok: true,
    message:
      `シートの${rows.length}名を反映しました` +
      `(新規 ${added.length}名 / 名前を更新 ${changed.length}名)` +
      roleNote +
      missingNote +
      skippedNote +
      gidNote,
    detail: `取得先: ${fetched.url}`,
    clearGid: fetched.clearGid,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const auth = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 名簿には本名が入るため、運営(ログイン済み)だけが実行できる
    if (auth !== `Bearer ${serviceKey}`) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      );
      const {
        data: { user },
      } = await authClient.auth.getUser();
      if (user == null) return json({ error: "unauthorized" }, 401);
    }

    const { festivalId } = body as { festivalId?: string };
    if (!festivalId) return json({ error: "festivalId is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data: settings, error } = await admin
      .from("participant_sheet_sync")
      .select("festival_id, sheet_id, gid")
      .eq("festival_id", festivalId);
    if (error) return json({ error: error.message }, 500);
    if (!settings || settings.length === 0) {
      return json({ error: "同期の設定がありません" }, 404);
    }

    const setting = (settings as unknown as SyncSetting[])[0];
    let outcome: Outcome;
    try {
      outcome = await syncFestival(admin, setting);
    } catch (e) {
      outcome = { ok: false, message: e instanceof Error ? e.message : String(e) };
    }

    const stored = outcome.detail
      ? `${outcome.message} [${FUNCTION_VERSION}] ${outcome.detail}`
      : `${outcome.message} [${FUNCTION_VERSION}]`;
    await admin
      .from("participant_sheet_sync")
      .update({
        last_synced_at: new Date().toISOString(),
        last_result: stored,
        last_ok: outcome.ok,
        // 使えないタブ指定は消しておく。次からは先頭タブを直接読む
        ...(outcome.clearGid ? { gid: "" } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("festival_id", setting.festival_id);

    return json({
      results: [
        {
          festivalId: setting.festival_id,
          ok: String(outcome.ok),
          message: stored,
        },
      ],
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
