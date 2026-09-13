import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Festival } from "../../types/domain";
import { loadLastFestivalSlug } from "../../lib/storage";

/**
 * 祭りモードに入るときの祭り選び。
 *
 * 画面を切り替えると今いる場所を見失うため、通常モードのホームに重ねて出す。
 * 開閉は履歴で持っているので、戻る操作でも閉じられる(useHistoryOverlay)。
 */
export default function FestivalSelectSheet({
  festivals,
  loading,
  onClose,
}: {
  festivals: Festival[];
  loading: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  // Esc でも閉じられるようにする(PCから開いた場合)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 前に見ていた祭りを先頭に出す(当日は同じ祭りを何度も開くため)
  const last = loadLastFestivalSlug();
  const byLastUsed = (a: Festival, b: Festival) =>
    Number(b.slug === last) - Number(a.slug === last);
  const active = festivals.filter((f) => f.isActive).sort(byLastUsed);
  const past = festivals.filter((f) => !f.isActive).sort(byLastUsed);

  // replace で置き換えるので、祭りホームからの「戻る」は通常モードに戻る
  const enter = (slug: string) => navigate(`/f/${slug}`, { replace: true });

  const itemClass =
    "block w-full rounded-xl px-4 py-3 text-left shadow-sm";

  return (
    // 下部ナビが z-50 なので、その上に重ねる(下の項目がタップできなくなるため)
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 px-4 pb-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="festival-select-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-2xl bg-slate-100 p-4 shadow-xl"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2
              id="festival-select-title"
              className="text-lg font-bold text-slate-800"
            >
              どの祭りを見ますか
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              選んだ祭りの当日の予定・マップ・お知らせを表示します。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-600"
          >
            閉じる
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {loading && festivals.length === 0 && (
            <p className="py-6 text-center text-slate-500">読み込み中…</p>
          )}

          {!loading && festivals.length === 0 && (
            <p className="rounded-xl bg-white p-4 text-slate-600">
              祭りが登録されていません。
            </p>
          )}

          {active.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500">
                開催中の祭り
              </h3>
              {active.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => enter(f.slug)}
                  className={`${itemClass} bg-white text-base font-bold text-slate-900`}
                >
                  {f.name}
                </button>
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-500">過去の祭り</h3>
              {past.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => enter(f.slug)}
                  className={`${itemClass} bg-white text-sm font-medium text-slate-600`}
                >
                  {f.name}
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
