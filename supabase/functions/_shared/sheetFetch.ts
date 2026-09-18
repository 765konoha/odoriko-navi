// スプレッドシートの書き出し(CSV)を読みに行く共通処理。
//
// 出欠の同期と参加者の同期で同じことをするため、ここにまとめる。
// シートは「リンクを知っている全員が閲覧可」の共有設定を前提とする。

export interface SheetFetchResult {
  ok: boolean;
  /** 読めたときの本文(CSV) */
  csv?: string;
  /** 画面に出してよい文言 */
  message?: string;
  /** 取得先や応答の断片。運営にだけ見せる */
  detail?: string;
  /** 実際に読みに行ったURL */
  url: string;
  /** タブの指定が使えず、先頭タブで読めたとき。設定から gid を消す */
  clearGid: boolean;
}

/**
 * 書き出し(CSV)のURL。
 * gid が空なら付けない。先頭タブのgidは0とは限らず(フォームの回答シートに多い)、
 * 存在しないタブを指すと Google は 400 を返すため。
 */
export function sheetCsvUrl(sheetId: string, gid: string): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  return gid.trim() === "" ? base : `${base}&gid=${gid}`;
}

/**
 * シートの中身(CSV)を取る。
 * 指定したタブで読めなければ、先頭タブで一度だけ読み直す
 * (指定が効いていない以上、取り逃がすタブは無い)。
 */
export async function fetchSheetCsv(
  sheetId: string,
  gid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SheetFetchResult> {
  let url = sheetCsvUrl(sheetId, gid);
  let res = await fetchImpl(url, { redirect: "follow" });
  let clearGid = false;

  // 指定したタブが無いと Google は 400 を返す。
  // 先頭タブなら読めることが多いので、一度だけ試す。
  if (!res.ok && gid.trim() !== "") {
    const fallback = sheetCsvUrl(sheetId, "");
    const retry = await fetchImpl(fallback, { redirect: "follow" });
    if (retry.ok) {
      url = fallback;
      res = retry;
      clearGid = true;
    }
  }

  if (!res.ok) {
    // 何が返ったのかが分からないと原因を絞れないので、応答の先頭を残す。
    // Google は 400 の理由を本文に書いてくることがある。
    const body = (await res.text().catch(() => ""))
      .replace(/\s+/g, " ")
      .slice(0, 300);
    const hint =
      res.status === 400
        ? gid.trim() === ""
          ? "シートIDが正しいか確認してください。"
          : `タブの指定(gid=${gid})が違う可能性があります。` +
            "取り込みたいタブを開いた状態のURLを貼り直してください。"
        : "共有設定が「リンクを知っている全員が閲覧可」になっているか、" +
          "シートIDが正しいか確認してください。";
    return {
      ok: false,
      message: `シートを読めませんでした(HTTP ${res.status})。${hint}`,
      detail: `取得先: ${url} / 応答: ${body || "(空)"}`,
      url,
      clearGid,
    };
  }

  const csv = await res.text();
  // 閲覧権が無いとログインのHTMLが返る。CSVとして解析すると無意味な結果になるため弾く。
  if (csv.trimStart().startsWith("<")) {
    return {
      ok: false,
      message:
        "シートの中身ではなくログイン画面が返りました。" +
        "共有設定を「リンクを知っている全員が閲覧可」にしてください。",
      url,
      clearGid,
    };
  }

  return { ok: true, csv, url, clearGid };
}
