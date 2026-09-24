// Supabase Edge Function: send-push
// 管理者(ログイン済みユーザー)からの呼び出しで、登録済みの端末へ
// Web Push 通知を送信する。
//
// 送信の手順(VAPID 鍵の扱いを含む)は _shared/webpush.ts にある。
// リハ前日の案内(notify-rehearsal-eve)と同じものを使う。
//
// 必要な Secrets(Edge Functions → Secrets で設定):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY は自動注入)

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type Subscription } from "../_shared/webpush.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 呼び出し元が実ユーザー(管理者)であることを確認(anon keyのみは拒否)
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    // serials: 配信対象のシリアル一覧(役職・個人向けお知らせ用)。
    // 未指定(null/undefined)なら全端末へ送信する。
    const { title, body, url, serials } = await req.json();
    if (!title) return json({ error: "title is required" }, 400);
    if (serials != null && !Array.isArray(serials)) {
      return json({ error: "serials must be an array" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let query = admin.from("push_subscriptions").select("endpoint, p256dh, auth");
    if (serials != null) {
      // 対象シリアルの購読のみ(シリアル未記録の旧購読は対象外)
      query = query.in("serial", serials as string[]);
    }
    const { data: subs, error } = await query;
    if (error) throw error;

    const result = await sendPush((subs ?? []) as Subscription[], {
      title,
      body,
      // 通知タップ時の遷移先(お知らせ詳細ページ)
      url: typeof url === "string" ? url : undefined,
    });
    return json(result);
  } catch (e) {
    console.error("send-push fatal:", e);
    return json({ error: String(e) }, 500);
  }
});
