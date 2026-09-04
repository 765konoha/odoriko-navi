// Supabase Edge Function: sync-rehearsal-attendance
//
// エントリーフォームの回答シートを読みに行き、rehearsal_attendances に反映する。
// 貼り付けによる手動取り込みでは日々の更新に追いつかないため。
//
// 呼び出し方は3通り。
//   1. リハ画面を開いたとき  … { festivalId, refreshOnly: true }。ログイン不要。
//      前回の同期から間もなければ何もしない(呼び出しを増やさないため、
//      画面側でも last_synced_at を見て古いときだけ呼ぶ)
//   2. 運営画面の「今すぐ同期」… ログイン済みユーザーとして { festivalId }。
//      間隔にかかわらず必ず読みに行く
//   3. 定期実行(使う場合)   … service_role キーで { all: true }
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
  enabled: boolean;
  last_synced_at: string | null;
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

/** 画面を開くたびに読みに行かないための間隔 */
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/**
 * 書き出し(CSV)のURL。
 * gid が空なら付けない。先頭タブのgidは0とは限らず(フォームの回答シートに多い)、
 * 存在しないタブを指すと Google は 400 を返すため。
 */
function sheetCsvUrl(sheetId: string, gid: string): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  return gid.trim() === "" ? base : `${base}&gid=${gid}`;
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
    // 400 はタブ(gid)の指定違いで出ることが多い。原因ごとに案内を変える。
    const hint =
      res.status === 400
        ? setting.gid.trim() === ""
          ? "シートIDが正しいか確認してください。"
          : `タブの指定(gid=${setting.gid})が違う可能性があります。` +
            "取り込みたいタブを開いた状態のURLを貼り直してください。"
        : "共有設定が「リンクを知っている全員が閲覧可」になっているか、" +
          "シートIDが正しいか確認してください。";
    return {
      ok: false,
      message: `シートを読めませんでした(HTTP ${res.status})。${hint}`,
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
    const body = await req.json().catch(() => ({}));
    const auth = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // 定期実行は service_role キーで呼ぶ。
    // 画面を開いたときの更新(refreshOnly)はログイン不要。
    // それ以外(運営の「今すぐ同期」)は実ユーザーであることを確かめる。
    const isCron = auth === `Bearer ${serviceKey}`;
    if (!isCron && !body.refreshOnly) {
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

    const { festivalId, all, refreshOnly } = body as {
      festivalId?: string;
      all?: boolean;
      refreshOnly?: boolean;
    };
    if (!festivalId && !all) {
      return json({ error: "festivalId or all is required" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    let query = admin
      .from("rehearsal_sheet_sync")
      .select("festival_id, sheet_id, gid, enabled, last_synced_at");
    // まとめて回す場合は enabled のものだけ。
    if (all) query = query.eq("enabled", true);
    else query = query.eq("festival_id", festivalId);

    const { data: settings, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!settings || settings.length === 0) {
      return json({ error: "同期の設定がありません" }, 404);
    }

    const now = Date.now();
    const results: Record<string, string>[] = [];
    for (const setting of settings as unknown as SyncSetting[]) {
      // 自動更新を切っている祭りは、画面を開いても読みに行かない。
      // 運営の「今すぐ同期」は設定した本人の操作なので、この制限を受けない。
      if (refreshOnly && !setting.enabled) {
        results.push({
          festivalId: setting.festival_id,
          ok: "true",
          message: "自動更新が切られています",
          skipped: "true",
        });
        continue;
      }
      // 画面を開いたときの更新は、前回から間もなければ何もしない。
      // 大勢が同時に開いてもシートを読みに行くのは間隔ごとに1回で済む。
      if (refreshOnly && setting.last_synced_at) {
        const elapsed = now - new Date(setting.last_synced_at).getTime();
        if (elapsed < REFRESH_INTERVAL_MS) {
          results.push({
            festivalId: setting.festival_id,
            ok: "true",
            message: "前回の同期から間もないため、そのままにしました",
            skipped: "true",
          });
          continue;
        }
      }
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
