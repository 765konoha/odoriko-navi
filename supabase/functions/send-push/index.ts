// Supabase Edge Function: send-push
// 管理者(ログイン済みユーザー)からの呼び出しで、登録済みの全端末へ
// Web Push 通知を送信する。
//
// 送信には Deno ネイティブの @negrel/webpush を使用する
// (npm:web-push は Node 互換層経由のため Edge Runtime で不安定)。
//
// 必要な Secrets(Edge Functions → Secrets で設定):
//   VAPID_PUBLIC_KEY  / VAPID_PRIVATE_KEY
//   (web-push generate-vapid-keys 形式の base64url 文字列。関数内で JWK に変換する)
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY は自動注入)

import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

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

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** web-push CLI 形式の VAPID 鍵ペア(base64url)を JWK ペアに変換する */
function rawVapidToJwk(publicKey: string, privateKey: string) {
  const pub = b64urlDecode(publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY の形式が不正です");
  }
  const x = b64urlEncode(pub.slice(1, 33));
  const y = b64urlEncode(pub.slice(33, 65));
  return {
    publicKey: { kty: "EC", crv: "P-256", x, y, ext: true },
    privateKey: { kty: "EC", crv: "P-256", x, y, d: privateKey, ext: true },
  };
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

    const vapidKeys = await webpush.importVapidKeys(
      rawVapidToJwk(vapidPublic, vapidPrivate),
      { extractable: false },
    );
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: "mailto:miyamoto.shohei@plus-zero.co.jp",
      vapidKeys,
    });

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
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          const subscriber = appServer.subscribe({
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          });
          await subscriber.pushTextMessage(payload, {});
          result.sent++;
        } catch (e) {
          let detail: string;
          if (e instanceof webpush.PushMessageError) {
            let bodyText = "";
            try {
              bodyText = await e.response.text();
            } catch {
              // ignore
            }
            detail = `HTTP ${e.response.status}: ${bodyText.slice(0, 200)}`;
          } else {
            detail = String(e).slice(0, 300);
          }
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
