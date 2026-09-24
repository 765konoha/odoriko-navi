// Supabase Edge Function: notify-rehearsal-eve
//
// 「明日はリハです」を前日の夜に送る。
// リハの前日21時(JST)に定期実行から呼ばれることを想定している。
//
// 呼び出し方は2通り。
//   1. 定期実行 … service_role キー、または x-cron-secret ヘッダ
//      (GitHub Actions から呼ぶ場合は後者。service_role キーを
//       リポジトリの Secrets に置かずに済む)
//   2. 運営の手動確認 … ログイン済みユーザー。dryRun で送らず件数だけ見られる
//
// 送る相手は「そのリハの祭りの名簿に載っていて、プッシュ通知を
// オンにしている端末」。通知をオンにした端末だけが push_subscriptions に
// 行を持つので、その時点でオンの人に届く。
//
// 同じ日に同じ祭りのリハが複数あっても通知は1通にまとめる
// (昼の部・夜の部で二度鳴らさない)。
//
// 同じリハへ二度送らない(rehearsals.eve_notified_at)。
// 二度走っても、手で再実行しても送り直さない。
//
// 定期実行が日付をまたぐほど遅れた場合は送らない(jstHour を見る)。
// 送ってしまうと「明日」が一日ずれ、明後日のリハを案内したうえで
// 本来の前夜に送れなくなるため、黙って見送る方が害が小さい。

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type Subscription } from "../_shared/webpush.ts";

const FUNCTION_VERSION = "2026-09-24a";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface RehearsalRow {
  id: string;
  festival_id: string;
  title: string;
  starts_at: string;
  venue_name: string;
  note: string | null;
}

/** 日本時間の「今日 + offset 日」の YYYY-MM-DD */
function jstDate(offsetDays: number, now = new Date()): string {
  const base = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(now);
  const d = new Date(`${base}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d);
}

/** 日本時間の「時」(0-23) */
function jstHour(now = new Date()): number {
  const hhmm = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return Number(hhmm.slice(0, 2));
}

/** 日本時間の「M/D(曜) HH:MM」 */
function jstLabel(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}/${get("day")}(${get("weekday")}) ${get("hour")}:${get("minute")}`;
}

/** 通知の本文。1件なら1行、複数ならその祭りの明日の分を並べる */
function buildBody(rehearsals: RehearsalRow[]): string {
  return rehearsals
    .map((r) => {
      const when = jstLabel(r.starts_at);
      const detail =
        r.title.trim() === "" ? r.venue_name : `${r.venue_name}(${r.title})`;
      return `${when} ${detail}${r.note ? ` ※${r.note}` : ""}`;
    })
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { dryRun, force } = body as { dryRun?: boolean; force?: boolean };

    const auth = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = (Deno.env.get("CRON_SECRET") ?? "").trim();
    const givenSecret = (req.headers.get("x-cron-secret") ?? "").trim();

    // 定期実行(service_role キー、または CRON_SECRET)
    let allowed =
      auth === `Bearer ${serviceKey}` ||
      (cronSecret !== "" && givenSecret === cronSecret);
    // 運営が手で確かめる場合はログイン済みであればよい
    if (!allowed) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      );
      const {
        data: { user },
      } = await authClient.auth.getUser();
      allowed = user != null;
    }
    if (!allowed) return json({ error: "unauthorized" }, 401);

    // 前日の夜に走る前提。日付をまたいでから走ったなら
    // 「明日」がずれるので送らない(force で手動実行はできる)
    const hour = jstHour();
    if (!dryRun && !force && hour < 12) {
      return json({
        version: FUNCTION_VERSION,
        skipped: "日付が変わってからの実行のため送信しません",
        jstHour: hour,
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // 明日(JST)に始まるリハ。中止と、送信済みは除く
    const tomorrow = jstDate(1);
    const from = new Date(`${tomorrow}T00:00:00+09:00`).toISOString();
    const to = new Date(`${jstDate(2)}T00:00:00+09:00`).toISOString();
    const { data: rehearsals, error } = await admin
      .from("rehearsals")
      .select("id, festival_id, title, starts_at, venue_name, note")
      .gte("starts_at", from)
      .lt("starts_at", to)
      .eq("is_cancelled", false)
      .is("eve_notified_at", null)
      .order("starts_at");
    if (error) return json({ error: error.message }, 500);

    const list = (rehearsals ?? []) as RehearsalRow[];
    if (list.length === 0) {
      return json({
        version: FUNCTION_VERSION,
        date: tomorrow,
        results: [],
        message: "明日のリハはありません(または既に送信済みです)",
      });
    }

    // 同じ祭りの分はまとめて1通にする
    const byFestival = new Map<string, RehearsalRow[]>();
    for (const r of list) {
      const group = byFestival.get(r.festival_id);
      if (group) group.push(r);
      else byFestival.set(r.festival_id, [r]);
    }

    const results: Record<string, unknown>[] = [];
    for (const [festivalId, group] of byFestival) {
      const ids = group.map((r) => r.id);

      // その祭りの名簿に載っている人だけに送る
      const { data: roster, error: rosterError } = await admin
        .from("festival_participants")
        .select("serial")
        .eq("festival_id", festivalId);
      if (rosterError) {
        results.push({ festivalId, ids, ok: false, error: rosterError.message });
        continue;
      }
      const serials = ((roster ?? []) as { serial: string }[]).map(
        (p) => p.serial,
      );

      // 通知をオンにしている端末だけが購読の行を持つ
      let subs: Subscription[] = [];
      if (serials.length > 0) {
        const { data, error: subError } = await admin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .in("serial", serials);
        if (subError) {
          results.push({ festivalId, ids, ok: false, error: subError.message });
          continue;
        }
        subs = (data ?? []) as Subscription[];
      }

      const payload = {
        title:
          group.length === 1
            ? "明日はリハです"
            : `明日はリハが${group.length}件あります`,
        body: buildBody(group),
        // 通常モードのリハ画面を開く
        url: "/odoriko-navi/#/rehearsal",
      };

      if (dryRun) {
        results.push({
          festivalId,
          ids,
          ok: true,
          dryRun: true,
          total: subs.length,
          preview: `${payload.title} / ${payload.body}`,
        });
        continue;
      }

      // 送る相手がいなければ送信そのものを省く(VAPID の準備も不要)
      const sent =
        subs.length === 0
          ? { total: 0, sent: 0, removed: 0, errors: [] }
          : await sendPush(subs, payload);
      // 送れた分があってもなくても、送信を試みたリハには印を付ける。
      // 付けないと次の実行で同じリハをもう一度送ってしまう
      const { error: markError } = await admin
        .from("rehearsals")
        .update({ eve_notified_at: new Date().toISOString() })
        .in("id", ids)
        .is("eve_notified_at", null);
      results.push({
        festivalId,
        ids,
        ok: true,
        ...sent,
        ...(markError ? { markError: markError.message } : {}),
      });
    }

    return json({ version: FUNCTION_VERSION, date: tomorrow, results });
  } catch (e) {
    console.error("notify-rehearsal-eve fatal:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
