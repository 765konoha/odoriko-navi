import { useEffect, useState } from "react";
import {
  isPushSupported,
  isSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "../../lib/push";

type State = "hidden" | "off" | "on" | "denied";

const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

/** お知らせのプッシュ通知 オン/オフ */
export default function PushToggle() {
  const [state, setState] = useState<State>("hidden");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    void isSubscribed().then((on) => setState(on ? "on" : "off"));
  }, []);

  if (state === "hidden") return null;
  // iPhone/iPad はホーム画面に追加した PWA でのみ通知可能
  if (isIos && !isStandalone) {
    return (
      <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
        🔔 iPhone/iPadで通知を受け取るには、共有メニューから「ホーム画面に追加」し、追加したアプリから通知をオンにしてください。
      </p>
    );
  }

  async function handleToggle() {
    setBusy(true);
    setMessage(null);
    if (state === "on") {
      await unsubscribeFromPush();
      setState("off");
    } else {
      const result = await subscribeToPush();
      if (result === "subscribed") {
        setState("on");
        setMessage("この端末で新しいお知らせの通知を受け取ります。");
      } else if (result === "denied") {
        setState("denied");
      } else {
        setMessage("通知の設定に失敗しました。通信環境を確認してください。");
      }
    }
    setBusy(false);
  }

  if (state === "denied") {
    return (
      <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
        🔔 通知がブロックされています。受け取るには端末の設定でこのサイトの通知を許可してください。
      </p>
    );
  }

  return (
    <div className="rounded-xl bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">
          🔔 新しいお知らせをプッシュ通知で受け取る
        </span>
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={busy}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold disabled:opacity-50 ${
            state === "on"
              ? "bg-emerald-600 text-white"
              : "bg-slate-200 text-slate-600"
          }`}
        >
          {busy ? "…" : state === "on" ? "オン" : "オフ"}
        </button>
      </div>
      {message && <p className="mt-1 text-xs text-slate-500">{message}</p>}
    </div>
  );
}
