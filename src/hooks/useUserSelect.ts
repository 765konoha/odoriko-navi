import { useLocation } from "react-router-dom";
import { useHistoryOverlay } from "./useHistoryOverlay";

// 利用者(シリアル)選択画面の開閉。
// 開閉の仕組みは useHistoryOverlay に置いてある(祭り選択と共通)。

export interface UserSelectRoute {
  /** 「変更」で選択画面を開いている最中か */
  changeRequested: boolean;
  /** 選択画面を開く(履歴を1件積むので戻る操作で閉じられる) */
  requestChange: () => void;
  /** 選択画面を閉じる(積んだ履歴を現在地ごと置き換える) */
  closeChange: () => void;
}

export function useUserSelect(): UserSelectRoute {
  const { open, requestOpen, close } = useHistoryOverlay("userSelect");
  return {
    changeRequested: open,
    requestChange: requestOpen,
    closeChange: close,
  };
}

/**
 * アプリ内に戻れる履歴があるか。
 * React Router が履歴に持たせている位置(idx)が 0 なら、これ以上戻るとアプリの外に出る。
 * ホーム画面から起動した PWA では白画面になってしまうため、戻る導線を出さない判定に使う。
 */
export function useCanGoBack(): boolean {
  // location が変わるたびに再評価するために購読する
  useLocation();
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" ? idx > 0 : true;
}
