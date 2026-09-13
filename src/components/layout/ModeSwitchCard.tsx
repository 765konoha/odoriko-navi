import { Link, useNavigate, useParams } from "react-router-dom";
import { FestivalSelect, useFestivalList } from "./FestivalPicker";
import FestivalSelectSheet from "./FestivalSelectSheet";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";

const cardClass = "space-y-2 rounded-xl bg-white px-4 py-2.5";
const rowClass = "flex items-center gap-2";
const buttonClass =
  "shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600";

/**
 * 通常モードのホームに置く切替。
 *
 * どの祭りに入るかは、切り替えを押したあとに重ねて出す祭り選びで決める。
 * 通常モードは祭りに紐づかないため、押す前に祭りを出しておく意味がない。
 * 選ぶ先が1つしか無いときは、重ねずにそのまま入る。
 */
export function ToFestivalModeCard() {
  const navigate = useNavigate();
  const { festivals, loading } = useFestivalList();
  const { open, requestOpen, close } = useHistoryOverlay("festivalSelect");

  const active = festivals.filter((f) => f.isActive);
  const onlyOne = festivals.length === 1 && active.length === 1;

  return (
    <div className={cardClass}>
      <div className={rowClass}>
        <span className="text-sm text-slate-500">現在</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
          通常モード
        </span>
        <button
          type="button"
          onClick={() =>
            onlyOne ? navigate(`/f/${active[0].slug}`) : requestOpen()
          }
          className={buttonClass}
        >
          祭りモードに切替
        </button>
      </div>

      {open && (
        <FestivalSelectSheet
          festivals={festivals}
          loading={loading}
          onClose={close}
        />
      )}
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
