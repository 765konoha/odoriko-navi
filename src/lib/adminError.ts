// 管理画面のエラー表示。
//
// 画面に出す文言と、開発者が見るログを分ける。
// API の詳細(制約名・内部ID・接続設定など)は運営には対処できないため、
// 画面には出さずログにだけ残す。

/** 画面には出さない詳細をログにだけ残す */
export function reportAdminError(context: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[admin] ${context}: ${detail}`);
}

/** 一覧の取得に失敗したとき */
export const LOAD_ERROR_MESSAGE =
  "最新の情報を取得できませんでした。通信環境を確認してください。";

/** 削除に失敗したとき */
export const DELETE_ERROR_MESSAGE =
  "削除できませんでした。通信環境を確認して、もう一度お試しください。";

/** ログアウトに失敗したとき */
export const SIGN_OUT_ERROR_MESSAGE =
  "ログアウトできませんでした。通信環境を確認して、もう一度お試しください。";
