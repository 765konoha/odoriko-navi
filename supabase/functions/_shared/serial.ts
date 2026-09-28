// シリアルの表記ゆれをそろえる。
//
// Spreadsheet やフォームの入力では、同じ「K-015」が全角の「Ｋ－０１５」で
// 入っていることがあり、そのまま比べると別人として扱われてしまう。
// 取り込み・登録・照合の入口でこの関数を通して、表記を1つにそろえる。
//
// DB 側にも同じ規則の normalize_serial()(migration 0023)がある。
// 規則を変えるときは両方を合わせること。
//
// 貼り付け取り込み(ブラウザ)とシート同期(Edge Function)で同じものを
// 使うため、ここに置く。アプリからは src/lib/serial.ts を通して使う。

/** 英数字にはさまれたとき、ハイフンとみなす文字(長音符・各種ダッシュ) */
const DASH_LIKE = /(?<=[A-Za-z0-9])[ー‐‑–—−ｰ](?=[A-Za-z0-9])/g;

/**
 * - 全角の英数字・記号(！〜～)を半角にする
 * - 全角スペースを半角にし、前後の空白を除く
 * - 英数字にはさまれた長音符・ダッシュをハイフンにする
 *   (日本語入力のまま K ー 015 と打たれることがあるため)
 *
 * 日本語(「カメラマン」など)には触れない。大文字・小文字も変えない。
 */
export function normalizeSerial(value: string): string {
  return value
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(DASH_LIKE, "-")
    .trim();
}
