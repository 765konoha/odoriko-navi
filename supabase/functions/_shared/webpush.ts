// Web Push の送信。
//
// お知らせの配信(send-push)とリハ前日の案内(notify-rehearsal-eve)で
// 同じ手順を使うため、VAPID 鍵の扱いと送信をここにまとめる。
//
// 送信には Deno ネイティブの @negrel/webpush を使う
// (npm:web-push は Node 互換層経由のため Edge Runtime で不安定)。
//
// 必要な Secrets: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
// (web-push generate-vapid-keys 形式の base64url 文字列。ここで JWK に変換する)

import * as webpush from "jsr:@negrel/webpush";

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

export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  /** 通知タップ時の遷移先 */
  url?: string;
}

export interface PushResult {
  total: number;
  sent: number;
  removed: number;
  errors: string[];
}

/** 連絡先(VAPID の contactInformation) */
const CONTACT = "mailto:miyamoto.shohei@plus-zero.co.jp";

/**
 * 購読の一覧へ通知を送る。
 *
 * 送信失敗しても購読は削除しない(解除はトグルオフ時にクライアントが行う)。
 * 1件の失敗で全体を止めないよう、結果にまとめて返す。
 */
export async function sendPush(
  subscriptions: Subscription[],
  payload: PushPayload,
): Promise<PushResult> {
  const vapidPublic = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
  const vapidPrivate = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
  if (!vapidPublic || !vapidPrivate) {
    throw new Error("VAPID keys are not configured");
  }
  const vapidKeys = await webpush.importVapidKeys(
    rawVapidToJwk(vapidPublic, vapidPrivate),
    { extractable: false },
  );
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: CONTACT,
    vapidKeys,
  });

  const text = JSON.stringify({
    title: payload.title,
    body: (payload.body ?? "").slice(0, 180),
    url: payload.url,
  });

  const result: PushResult = {
    total: subscriptions.length,
    sent: 0,
    removed: 0,
    errors: [],
  };

  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        const subscriber = appServer.subscribe({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        });
        await subscriber.pushTextMessage(text, {});
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

  return result;
}
