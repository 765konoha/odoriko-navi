import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// 利用者(シリアル)選択画面の開閉を「履歴」で管理する。
// React の state だけで開閉すると、戻るボタン(ヘッダー・OS・ブラウザいずれも)を
// 押しても選択画面が閉じず、裏のページだけが動いてしまうため。

interface UserSelectState {
  userSelect?: boolean;
}

export interface UserSelectRoute {
  /** 「変更」で選択画面を開いている最中か */
  changeRequested: boolean;
  /** 選択画面を開く(履歴を1件積むので戻る操作で閉じられる) */
  requestChange: () => void;
  /** 選択画面を閉じる(積んだ履歴を現在地ごと置き換える) */
  closeChange: () => void;
}

export function useUserSelect(): UserSelectRoute {
  const navigate = useNavigate();
  const location = useLocation();
  const changeRequested =
    (location.state as UserSelectState | null)?.userSelect === true;
  const here = `${location.pathname}${location.search}${location.hash}`;

  const requestChange = useCallback(() => {
    if (changeRequested) return;
    navigate(here, { state: { userSelect: true } satisfies UserSelectState });
  }, [changeRequested, here, navigate]);

  // replace で閉じることで、閉じたあとの「戻る」は開く前の画面に戻る
  const closeChange = useCallback(() => {
    if (!changeRequested) return;
    navigate(here, { replace: true, state: null });
  }, [changeRequested, here, navigate]);

  return { changeRequested, requestChange, closeChange };
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
