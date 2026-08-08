import { supabase } from "./supabase";

// プッシュ通知の購読管理(踊り子側)。
// 購読情報は Supabase の push_subscriptions に保存し、
// 送信は Edge Function(send-push)が行う。

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/** この環境でプッシュ通知が使えるか(SW未登録のdev環境や非対応ブラウザはfalse) */
export function isPushSupported(): boolean {
  return (
    !!VAPID_PUBLIC_KEY &&
    !!supabase &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

/** 現在この端末が購読済みか */
export async function isSubscribed(): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg) return false;
  return (await reg.pushManager.getSubscription()) != null;
}

export type SubscribeResult = "subscribed" | "denied" | "unsupported" | "error";

/** 通知許可を求めて購読し、Supabase に登録する */
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported() || !supabase) return "unsupported";
  const reg = await getRegistration();
  if (!reg) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      }));
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").insert({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    });
    // 登録済み(unique制約違反 23505)は成功扱い
    if (error && error.code !== "23505") return "error";
    return "subscribed";
  } catch {
    return "error";
  }
}

/** 購読を解除し、Supabase からも削除する */
export async function unsubscribeFromPush(): Promise<void> {
  const reg = await getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
