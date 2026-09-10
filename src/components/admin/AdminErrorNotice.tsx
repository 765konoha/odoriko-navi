// 管理画面の共通エラー表示(小さいものだけ)。
// 画面ごとの作りは変えず、必要な箇所にこの3つを差し込んで使う。

/** 取得に失敗し、表示できるものが何も無いとき(再試行できる) */
export function AdminLoadError({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl bg-red-50 px-4 py-3">
      <p className="text-sm font-bold text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-bold text-white disabled:bg-slate-300"
      >
        {retrying ? "再試行中…" : "再試行"}
      </button>
    </div>
  );
}

/** 前回取得分は表示できているが、最新の取得に失敗したとき */
export function AdminStaleNotice({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5">
      <p className="min-w-0 flex-1 text-xs font-medium text-amber-900">
        {message}前回取得した内容を表示しています。
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 disabled:opacity-50"
      >
        {retrying ? "再試行中…" : "再試行"}
      </button>
    </div>
  );
}

/** 削除など、操作に失敗したとき */
export function AdminActionError({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
      {message}
    </p>
  );
}
