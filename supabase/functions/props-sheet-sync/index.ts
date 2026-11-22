// Supabase Edge Function: props-sheet-sync
//
// 小道具担当のスプレッドシート(Apps Script)から呼ばれ、次の2つを反映する。
//   * action "holders"   … 保有者・状態の更新(基準の列まで)
//   * action "handovers" … お祭り当日の持ち帰り(対象日の受け渡し予定)
// apply が false なら確認だけ(DB は変えない)。
//
// 呼び出しは Apps Script だけ。ヘッダーの x-sync-token を、Secrets の
// PROPS_SYNC_TOKEN と照らし合わせる(ログインの仕組みは使わない)。
// シートの読み方は _shared/propSheet.ts と docs/PROPS_SHEET_SYNC.md。

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  analyzeSheet,
  buildHandoverSync,
  buildHolderSync,
  columnIndex,
  columnLetter,
  createResolver,
  findEventGroups,
  formatReport,
  isTimelineColumn,
  type DbSnapshot,
  type DbTransfer,
} from "../_shared/propSheet.ts";

// 差し替えたことを確かめられるよう、結果に出す
const FUNCTION_VERSION = "2026-11-21a";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-token",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** 合言葉の比較(長さ以外の情報を時間で漏らさない) */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 受け取ったシートを、決まった大きさの文字列の表にそろえる */
function toGrid(value: unknown): string[][] | null {
  if (!Array.isArray(value) || value.length > 3000) return null;
  return value.map((row) =>
    Array.isArray(row)
      ? row.slice(0, 300).map((c) => String(c ?? "").slice(0, 500))
      : [],
  );
}

function fail(message: string, status = 200): Response {
  return json({ ok: false, version: FUNCTION_VERSION, message }, status);
}

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, "public", any>;

/** Supabase は1回に1000行までなので、分けて全部読む */
async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function loadSnapshot(admin: Admin, date: string | null): Promise<{
  db: DbSnapshot;
  serials: Set<string>;
  roster: { serial: string; nickname: string }[];
}> {
  const [participants, roster, display, items, coHolders] = await Promise.all([
    selectAll<{ serial: string }>((f, t) =>
      admin.from("participants").select("serial").range(f, t),
    ),
    selectAll<{ serial: string; nickname: string }>((f, t) =>
      admin.from("festival_participants").select("serial, nickname").range(f, t),
    ),
    selectAll<{ serial: string; nickname: string; name: string }>((f, t) =>
      admin.from("participant_display").select("serial, nickname, name").range(f, t),
    ),
    selectAll<{
      id: string;
      category: string;
      identifier: string;
      condition: string;
      current_holder_serial: string | null;
      is_archived: boolean;
    }>((f, t) =>
      admin
        .from("prop_items")
        .select("id, category, identifier, condition, current_holder_serial, is_archived")
        .range(f, t),
    ),
    selectAll<{ prop_item_id: string; serial: string }>((f, t) =>
      admin.from("prop_item_co_holders").select("prop_item_id, serial").range(f, t),
    ),
  ]);

  // 未完了の予定と、対象日のスプシ由来の予定
  let query = admin
    .from("prop_transfers")
    .select("id, prop_item_id, status, sheet_date, to_serial");
  query = date
    ? query.or(`status.eq.pending,sheet_date.eq.${date}`)
    : query.eq("status", "pending");
  const { data: transferRows, error: transferError } = await query;
  if (transferError) throw transferError;
  const transfers = (transferRows ?? []) as {
    id: string;
    prop_item_id: string;
    status: string;
    sheet_date: string | null;
    to_serial: string;
  }[];
  const receivers = new Map<string, string[]>();
  if (transfers.length > 0) {
    const { data, error } = await admin
      .from("prop_transfer_receivers")
      .select("transfer_id, serial")
      .in("transfer_id", transfers.map((t) => t.id));
    if (error) throw error;
    for (const r of (data ?? []) as { transfer_id: string; serial: string }[]) {
      receivers.set(r.transfer_id, [...(receivers.get(r.transfer_id) ?? []), r.serial]);
    }
  }

  const coByItem = new Map<string, string[]>();
  for (const c of coHolders) {
    coByItem.set(c.prop_item_id, [...(coByItem.get(c.prop_item_id) ?? []), c.serial]);
  }
  const db: DbSnapshot = {
    items: items.map((i) => ({
      id: i.id,
      category: i.category,
      identifier: i.identifier,
      condition: i.condition,
      holders: [
        ...new Set([
          ...(i.current_holder_serial ? [i.current_holder_serial] : []),
          ...(coByItem.get(i.id) ?? []),
        ]),
      ].sort(),
      isArchived: i.is_archived,
    })),
    transfers: transfers.map(
      (t): DbTransfer => ({
        id: t.id,
        itemId: t.prop_item_id,
        status: t.status,
        sheetDate: t.sheet_date,
        receivers: [...new Set([t.to_serial, ...(receivers.get(t.id) ?? [])])].sort(),
      }),
    ),
    names: new Map(display.map((d) => [d.serial, d.nickname || d.name])),
  };
  return {
    db,
    serials: new Set(participants.map((p) => p.serial)),
    roster,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return fail("POST で呼んでください。", 405);

  const expected = Deno.env.get("PROPS_SYNC_TOKEN") ?? "";
  if (expected === "") {
    return fail("受付口の合言葉(PROPS_SYNC_TOKEN)が設定されていません。", 500);
  }
  if (!sameToken(req.headers.get("x-sync-token") ?? "", expected)) {
    return fail("合言葉が違います。スクリプトの設定(SYNC_TOKEN)を確認してください。", 401);
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      apply?: boolean;
      grid?: unknown;
      year?: number;
      baseColumn?: string;
      targetDate?: string;
      aliases?: unknown;
    } | null;
    if (!body) return fail("送られてきた内容が読めませんでした。");
    const grid = toGrid(body.grid);
    if (!grid) return fail("シートの内容が読めませんでした。");
    const apply = body.apply === true;
    const aliases = Array.isArray(body.aliases)
      ? (body.aliases as unknown[])
          .filter((a): a is unknown[] => Array.isArray(a))
          .map((a) => [String(a[0] ?? ""), String(a[1] ?? "")] as [string, string])
          .slice(0, 2000)
      : [];

    const targetDate =
      typeof body.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)
        ? body.targetDate
        : null;
    const year =
      Number.isInteger(body.year) && (body.year as number) > 2000
        ? (body.year as number)
        : targetDate
          ? Number(targetDate.slice(0, 4))
          : new Date().getFullYear();

    const analyzed = analyzeSheet(grid, year);
    if ("error" in analyzed) return fail(analyzed.error);
    const layout = analyzed.layout;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const head = apply ? "【反映しました】" : "【確認】";

    if (body.action === "holders") {
      const baseCol = columnIndex(body.baseColumn ?? "");
      if (!isTimelineColumn(layout, baseCol)) {
        return fail(
          `基準の列「${body.baseColumn ?? ""}」が選べません。D列から「現在の保管者」の手前までの列を選んでください。`,
        );
      }
      const { db, serials, roster } = await loadSnapshot(admin, null);
      const resolve = createResolver({ aliases, roster, serials });
      const result = buildHolderSync(layout, baseCol, resolve, db);
      const target = `${columnLetter(baseCol)}列まで`;
      let title = `${head}保有者・状態の更新（基準: ${target}）`;
      if (apply && result.payload.length > 0) {
        const { data, error } = await admin.rpc("prop_sheet_apply_holders", {
          p_items: result.payload,
          p_note: `スプレッドシートから反映（${target}）`,
        });
        if (error) throw error;
        const r = data as { created: number; holders: number; conditions: number };
        title += `\n新規登録 ${r.created} 件 / 保有者 ${r.holders} 件 / 状態 ${r.conditions} 件`;
      }
      const message = formatReport(title, result);
      if (apply) {
        await admin.from("prop_sheet_sync_runs").insert({
          action: "holders",
          target,
          applied_count: result.payload.length,
          error_count: result.errors.length,
          summary: message.slice(0, 4000),
        });
      }
      return json({
        ok: true,
        version: FUNCTION_VERSION,
        message,
        errors: result.errors,
        changes: result.changes,
        notices: result.notices,
        pending: result.payload.length,
      });
    }

    if (body.action === "handovers") {
      if (!targetDate) return fail("対象日を入れてください。");
      const groups = findEventGroups(layout, targetDate);
      if (groups.length === 0) {
        return fail(
          `${targetDate} に当たるお祭りの列が見つかりませんでした。見出しの日付を確認してください。`,
        );
      }
      if (groups.length > 1) {
        return fail(
          `${targetDate} に当たるお祭りが複数あります（${groups.map((g) => g.name).join("、")}）。日付を確認してください。`,
        );
      }
      const group = groups[0];
      const lastDate = group.dates[group.dates.length - 1];
      const { db, serials, roster } = await loadSnapshot(admin, lastDate);
      const resolve = createResolver({ aliases, roster, serials });
      const result = buildHandoverSync(layout, group, resolve, db);
      let title = `${head}受け渡し予定の反映（${result.label} → ${result.date} の予定として）`;
      if (apply) {
        const { data, error } = await admin.rpc("prop_sheet_apply_handovers", {
          p_date: result.date,
          p_label: result.label,
          p_items: result.payload,
          p_keep: result.keep,
        });
        if (error) throw error;
        const r = data as { created: number; updated: number; cancelled: number };
        title += `\n作成 ${r.created} 件 / 更新 ${r.updated} 件 / 取り消し ${r.cancelled} 件`;
      }
      const message = formatReport(title, result);
      if (apply) {
        await admin.from("prop_sheet_sync_runs").insert({
          action: "handovers",
          target: `${result.label}（${result.date}）`,
          applied_count: result.payload.length,
          error_count: result.errors.length,
          summary: message.slice(0, 4000),
        });
      }
      return json({
        ok: true,
        version: FUNCTION_VERSION,
        message,
        errors: result.errors,
        changes: result.changes,
        notices: result.notices,
        pending: result.payload.length,
      });
    }

    return fail("action は holders か handovers を指定してください。");
  } catch (err) {
    // 内部の詳細はログにだけ残す(スプレッドシートには出さない)
    console.error("props-sheet-sync failed:", err instanceof Error ? err.message : err);
    return fail("反映中にエラーが起きました。時間をおいてもう一度お試しください。", 500);
  }
});
