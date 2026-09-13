import { Link, useNavigate, useParams } from "react-router-dom";
import { FestivalSelect, useFestivalList } from "./FestivalPicker";

const cardClass = "space-y-2 rounded-xl bg-white px-4 py-2.5";
const rowClass = "flex items-center gap-2";
const buttonClass =
  "shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600";

/**
 * 通常モードのホームに置く切替。
 *
 * どの祭りに入るかは、切り替えを押したあとの祭り選び(/festivals)で決める。
 * 通常モードは祭りに紐づかないため、ここに祭りを出しておく意味がないため。
 * 開催中が1つだけのときは選ばせずにそのまま入る(選ぶ画面は素通しする)。
 */
export function ToFestivalModeCard() {
  return (
    <div className={cardClass}>
      <div className={rowClass}>
        <span className="text-sm text-slate-500">現在</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
          通常モード
        </span>
        <Link to="/festivals" className={buttonClass}>
          祭りモードに切替
        </Link>
      </div>
    </div>
  );
}

/**
 * 祭りモードのホームに置く切替。
 * どの祭りを見ているかの確認と、別の祭りへの切替もここで行う。
 */
export function ToNormalModeCard({ festivalName }: { festivalName: string }) {
  const { festivalSlug } = useParams();
  const navigate = useNavigate();
  const { festivals } = useFestivalList();

  return (
    <div className={cardClass}>
      <div className={rowClass}>
        <span className="text-sm text-slate-500">現在</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
          祭りモード
        </span>
        <Link to="/" className={buttonClass}>
          通常モードに切替
        </Link>
      </div>
      <div className={rowClass}>
        <FestivalSelect
          festivals={festivals}
          value={festivalSlug ?? ""}
          onChange={(next) => next !== festivalSlug && navigate(`/f/${next}`)}
          fallbackName={festivalName}
        />
      </div>
    </div>
  );
}
