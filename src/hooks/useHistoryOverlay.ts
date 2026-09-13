import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// 画面に重ねる選択UI(利用者選択・祭り選択)の開閉を「履歴」で管理する。
//
// React の state だけで開閉すると、戻るボタン(ヘッダー・OS・ブラウザいずれも)を
// 押しても重ねたUIが閉じず、裏のページだけが動いてしまうため。

export interface HistoryOverlay {
  /** 開いている最中か */
  open: boolean;
  /** 開く(履歴を1件積むので戻る操作で閉じられる) */
  requestOpen: () => void;
  /** 閉じる(積んだ履歴を現在地ごと置き換える) */
  close: () => void;
}

/** @param key 履歴の state に持たせる目印(重ねるUIごとに別の名前にする) */
export function useHistoryOverlay(key: string): HistoryOverlay {
  const navigate = useNavigate();
  const location = useLocation();
  const open =
    (location.state as Record<string, unknown> | null)?.[key] === true;
  const here = `${location.pathname}${location.search}${location.hash}`;

  const requestOpen = useCallback(() => {
    if (open) return;
    navigate(here, { state: { [key]: true } });
  }, [open, here, key, navigate]);

  // replace で閉じることで、閉じたあとの「戻る」は開く前の画面に戻る
  const close = useCallback(() => {
    if (!open) return;
    navigate(here, { replace: true, state: null });
  }, [open, here, navigate]);

  return { open, requestOpen, close };
}
