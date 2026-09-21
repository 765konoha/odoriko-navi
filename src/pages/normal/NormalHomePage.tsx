import { Link, Navigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import { displayLabel, useDisplayNames } from "../../hooks/useDisplayNames";
import { ToFestivalModeCard } from "../../components/layout/ModeSwitchCard";
import PropRelayCard from "../../components/props/PropRelayCard";
import NextRehearsalCard from "../../components/rehearsal/NextRehearsalCard";
import { useUserSelect } from "../../hooks/useUserSelect";
import { usePropUserData } from "../../hooks/usePropUserData";
import { useAutoFestivalSlug } from "../../hooks/useAutoFestivalSlug";

/**
 * 通常モード(日常運用)のホーム。祭りには紐づかない。
 *
 * 祭り当日は、ここを開いたら祭りモードへ入る。
 * 当日いちばん見たいのは予定・マップ・お知らせなので、
 * 毎回「祭りモードに切替」を押させない。
 * 自分で通常モードへ戻した日は、その日のあいだ引き戻さない。
 */
export default function NormalHomePage() {
  const { requestChange } = useUserSelect();
  const { selection } = useUser();
  const { names } = useDisplayNames();
  // リレーカードと「次のリハ」の受け渡し案内で同じものを見る
  const propData = usePropUserData();
  const autoSlug = useAutoFestivalSlug();

  // replace で置き換えるので、祭りホームからの「戻る」はここへ戻らない
  // (戻った先でまた飛ばされ、戻れなくなるため)
  if (autoSlug) return <Navigate to={`/f/${autoSlug}`} replace />;

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-lg font-bold text-slate-700">踊り子ナビ</h1>

      <ToFestivalModeCard />

      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5">
        <span className="text-sm text-slate-500">利用者</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
          {displayLabel(selection?.serial ?? null, names)}
        </span>
        <button
          type="button"
          onClick={requestChange}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-600"
        >
          変更
        </button>
      </div>

      <PropRelayCard to="/props" propData={propData} />

      <NextRehearsalCard propData={propData} />

      <footer className="pt-6 pb-2 text-center">
        <Link to="/admin" className="text-xs text-slate-400 underline">
          運営の方はこちら
        </Link>
      </footer>
    </div>
  );
}
