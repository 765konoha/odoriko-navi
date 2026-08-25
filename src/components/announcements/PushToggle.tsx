import { useEffect, useState } from "react";
import {
  isPushSupported,
  isSubscribed,
  subscribeToPush,
  syncSubscription,
  unsubscribeFromPush,
} from "../../lib/push";
import { useUser } from "../../context/UserContext";
import { useUserSelect } from "../../hooks/useUserSelect";

type State = "hidden" | "off" | "on" | "denied";

const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

/** お知らせのプッシュ通知 オン/オフ(シリアル選択が必須) */
export default function PushToggle() {
  const { selection } = useUser();
  const { requestChange } = useUserSelect();
  const serial = selection?.serial ?? null;
  const [state, setState] = useState<State>("hidden");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    void isSubscribed().then((on) => {
      setState(on ? "on" : "off");
      // 購読済みならDB側の登録を自動修復し、現在のシリアルを記録する
      if (on && serial) void syncSubscription(serial);
    });
  }, [serial]);

  if (state === "hidden") return null;

  // 通知対象の判定にシリアルが必要なため、番号指定なしでは購読できない
  if (serial == null) {
    return (
      <div className="rounded-xl bg-white px-4 py-3">
        <p className="text-sm font-bold text-slate-800">🔔 プッシュ通知</p>
        <p className="mt-0.5 text-xs text-slate-500">
          通知を受け取るにはシリアルの選択が必要です(番号指定なしでは利用できません)。
        </p>
        <button
          type="button"
          onClick={requestChange}
          className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600"
        >
          シリアルを選択する
        </button>
      </div>
    );
  }
  // iPhone/iPad はホーム画面に追加した PWA でのみ通知可能
  if (isIos && !isStandalone) {
    return (
      <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
        🔔 iPhone/iPadで通知を受け取るには、共有メニューから「ホーム画面に追加」し、追加したアプリから通知をオンにしてください。
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
        🔔 通知がブロックされています。受け取るには端末の設定でこのサイトの通知を許可してください。
      </p>
    );
  }

  const isOn = state === "on";

  async function handleToggle() {
    setBusy(true);
    setMessage(null);
    if (isOn) {
      await unsubscribeFromPush();
      setState("off");
    } else {
      const result = await subscribeToPush(serial!);
      if (result === "subscribed") {
        setState("on");
      } else if (result === "denied") {
        setState("denied");
      } else {
        setMessage("通知の設定に失敗しました。通信環境を確認してください。");
      }
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">🔔 プッシュ通知</p>
          <p
            className={`mt-0.5 text-xs font-medium ${
              isOn ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            {isOn
              ? "現在オン:新しいお知らせを通知します"
              : "現在オフ:通知は届きません"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={`プッシュ通知を${isOn ? "オフ" : "オン"}にする`}
          onClick={() => void handleToggle()}
          disabled={busy}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            isOn ? "bg-emerald-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              isOn ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        タップで{isOn ? "オフ" : "オン"}に切り替え
      </p>
      {message && <p className="mt-1 text-xs text-red-600">{message}</p>}
    </div>
  );
}
