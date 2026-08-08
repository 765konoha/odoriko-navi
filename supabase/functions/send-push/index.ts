// Supabase Edge Function: send-push
// 管理者(ログイン済みユーザー)からの呼び出しで、登録済みの全端末へ
// Web Push 通知を送信する。
//
// 必要な Secrets(Edge Functions → Secrets で設定):
//   VAPID_PUBLIC_KEY  / VAPID_PRIVATE_KEY
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY は自動注入)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

    const { title, body } = await req.json();
    if (!title) return json({ error: "title is required" }, 400);

    const vapidPublic = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
    const vapidPrivate = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
    if (!vapidPublic || !vapidPrivate) {
      return json({ error: "VAPID keys are not configured" }, 500);
    }
    webpush.setVapidDetails(
      "mailto:miyamoto.shohei@plus-zero.co.jp",
      vapidPublic,
      vapidPrivate,
    );

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");
    if (error) throw error;

    const payload = JSON.stringify({
      title,
      body: (body ?? "").slice(0, 180),
    });

    const result = {
      total: (subs ?? []).length,
      sent: 0,
      removed: 0,
      errors: [] as string[],
    };

    // 送信失敗時も購読は削除しない(解除はトグルオフ時にクライアントが行う)。
    // 失敗理由はすべて errors として返す。
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          result.sent++;
        } catch (e) {
          const err = e as {
            statusCode?: number;
            body?: string;
            message?: string;
          };
          const detail = `HTTP ${err.statusCode ?? "?"}: ${
            (err.body ?? err.message ?? String(e)).slice(0, 300)
          }`;
          console.error("push send failed:", detail);
          if (result.errors.length < 3) result.errors.push(detail);
        }
      }),
    );

    return json(result);
  } catch (e) {
    console.error("send-push fatal:", e);
    return json({ error: String(e) }, 500);
  }
});
