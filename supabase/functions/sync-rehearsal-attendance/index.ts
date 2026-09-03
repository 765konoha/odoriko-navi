// Supabase Edge Function: sync-rehearsal-attendance
//
// エントリーフォームの回答シートを読みに行き、rehearsal_attendances に反映する。
// 貼り付けによる手動取り込みでは日々の更新に追いつかないため。
//
// 呼び出し方は2通り。
//   1. 運営画面の「今すぐ同期」    … ログイン済みユーザーとして { festivalId } を渡す
//   2. 定期実行(pg_cron + pg_net) … service_role キーで { all: true } を渡す
//
// シートは「リンクを知っている全員が閲覧可」を前提に、書き出しURLから CSV を取る。
// シートのURLはこの関数(サーバー側)だけが扱い、ブラウザには配らない。
//
// 解析は画面の貼り付け取り込みと同じものを使う(表記ゆれの扱いを一箇所に保つ)。

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildImportRows,
  findAttendanceColumns,
  guessSerialColumn,
  parseSheet,
} from "../_shared/attendanceParse.ts";

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

interface RehearsalRow {
  id: string;
  starts_at: string;
}

/** 日本時間での月日(シートの見出しは月日しか持たないため) */
function jstMonthDay(iso: string): { month: number; day: number } {
  const ymd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date(iso));
  const [, m, d] = ymd.split("-");
  return { month: Number(m), day: Number(d) };
}

function sheetCsvUrl(sheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/** 1つの祭りを同期する。結果の文言をそのまま last_result に残す。 */
async function syncFestival(
  admin: ReturnType<typeof createClient>,
  setting: SyncSetting,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(sheetCsvUrl(setting.sheet_id, setting.gid), {
    redirect: "follow",
  });
  if (!res.ok) {
    return {
      ok: false,
      message:
        `シートを読めませんでした(HTTP ${res.status})。` +
        `共有設定が「リンクを知っている全員が閲覧可」になっているか、` +
        `シートIDとgidが正しいか確認してください。`,
    };
  }
  const csv = await res.text();
  // 閲覧権が無いとログインのHTMLが返る。CSVとして解析すると無意味な結果になるため弾く。
  if (csv.trimStart().startsWith("<")) {
    return {
      ok: false,
      message:
        "シートの中身ではなくログイン画面が返りました。" +
        "共有設定を「リンクを知っている全員が閲覧可」にしてください。",
    };
  }

  const sheet = parseSheet(csv, ",");
  if (!sheet) {
    return { ok: false, message: "見出し行とデータ行を読み取れませんでした。" };
  }
  const serialColumn = guessSerialColumn(sheet.header);
  if (serialColumn < 0) {
    return {
      ok: false,
      message: "シリアルの列が見つかりませんでした(見出しに「シリアル」が必要です)。",
    };
  }

  const { data: rehearsals } = await admin
    .from("rehearsals")
    .select("id, starts_at")
    .eq("festival_id", setting.festival_id);
  const list = (rehearsals ?? []) as RehearsalRow[];
  if (list.length === 0) {
    return { ok: false, message: "この祭りにリハが登録されていません。" };
  }

  const { data: participants } = await admin
    .from("festival_participants")
    .select("serial")
    .eq("festival_id", setting.festival_id);
  const serials = new Set(
    ((participants ?? []) as { serial: string }[]).map((p) => p.serial),
  );

  const notes: string[] = [];
  let total = 0;
  let matched = 0;

  for (const column of findAttendanceColumns(sheet.header)) {
    const md = column.monthDay;
    if (!md) continue;
    const target = list.find((r) => {
      const x = jstMonthDay(r.starts_at);
      return x.month === md.month && x.day === md.day;
    });
    if (!target) continue; // 対応するリハが無い月日は黙って飛ばす
    matched += 1;

    // 実際のシートでは出欠の右隣が「遅刻・早退の時刻」になっている
    const result = buildImportRows(
      sheet,
      serialColumn,
      column.index,
      column.index + 1 < sheet.header.length ? column.index + 1 : null,
    );
    // 参加者マスターに無いシリアルは外部キーで弾かれるため、先に除く
    const rows = result.rows.filter((r) => serials.has(r.serial));
    if (rows.length > 0) {
      const { error } = await admin.from("rehearsal_attendances").upsert(
        rows.map((r) => ({
          rehearsal_id: target.id,
          serial: r.serial,
          status: r.status,
          time_note: r.timeNote ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "rehearsal_id,serial" },
      );
      if (error) return { ok: false, message: `保存に失敗: ${error.message}` };
    }
    total += rows.length;

    const skipped = result.rows.length - rows.length;
    notes.push(
      `${md.month}/${md.day}: ${rows.length}件` +
        (skipped > 0 ? ` / 参加者に無いシリアル ${skipped}件` : "") +
        (result.errors.length > 0
          ? ` / 解釈できない値 ${result.errors.length}件`
          : ""),
    );
  }

  if (matched === 0) {
    return {
      ok: false,
      message:
        "見出しの月日と一致するリハがありませんでした。" +
        "リハの日付と、シートの見出しの日付を確認してください。",
    };
  }
  return { ok: true, message: `${total}件を反映 (${notes.join(" / ")})` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // 定期実行は service_role キーで呼ぶ。それ以外は実ユーザー(運営)であること。
    const isCron = auth === `Bearer ${serviceKey}`;
    if (!isCron) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      );
      const {
        data: { user },
      } = await authClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);
    }

    const { festivalId, all } = await req.json().catch(() => ({}));
    if (!festivalId && !all) {
      return json({ error: "festivalId or all is required" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    let query = admin
      .from("rehearsal_sheet_sync")
      .select("festival_id, sheet_id, gid");
    // 定期実行は enabled のものだけ。手動の「今すぐ同期」は設定した本人の操作なので対象を絞らない。
    if (all) query = query.eq("enabled", true);
    else query = query.eq("festival_id", festivalId);

    const { data: settings, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!settings || settings.length === 0) {
      return json({ error: "同期の設定がありません" }, 404);
    }

    const results: Record<string, string>[] = [];
    for (const setting of settings as unknown as SyncSetting[]) {
      let outcome: { ok: boolean; message: string };
      try {
        outcome = await syncFestival(admin, setting);
      } catch (e) {
        outcome = {
          ok: false,
          message: e instanceof Error ? e.message : String(e),
        };
      }
      await admin
        .from("rehearsal_sheet_sync")
        .update({
          last_synced_at: new Date().toISOString(),
          last_result: outcome.message,
          last_ok: outcome.ok,
          updated_at: new Date().toISOString(),
        })
        .eq("festival_id", setting.festival_id);
      results.push({
        festivalId: setting.festival_id,
        ok: String(outcome.ok),
        message: outcome.message,
      });
    }

    return json({ results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
