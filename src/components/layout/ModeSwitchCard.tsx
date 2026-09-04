import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FestivalSelect, useFestivalList } from "./FestivalPicker";
import { loadLastFestivalSlug } from "../../lib/storage";

const cardClass = "space-y-2 rounded-xl bg-white px-4 py-2.5";
const rowClass = "flex items-center gap-2";
const buttonClass =
  "shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600";

/**
 * 通常モードのホームに置く切替。
 * 祭りモードはどの祭りの当日運用かで中身が変わるため、
 * 切り替える祭りをここで選ぶ。
 */
export function ToFestivalModeCard() {
  const navigate = useNavigate();
  const festivals = useFestivalList();
  const [picked, setPicked] = useState("");

  // 前に見ていた祭り → 開催中の祭り、の順に既定を決める
  const defaultSlug = useMemo(() => {
    const last = loadLastFestivalSlug();
    if (last && festivals.some((f) => f.slug === last)) return last;
    return festivals.find((f) => f.isActive)?.slug ?? festivals[0]?.slug ?? "";
  }, [festivals]);
  const slug = picked || defaultSlug;

  return (
    <div className={cardClass}>
      <div className={rowClass}>
        <span className="text-sm text-slate-500">現在</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
          通常モード
        </span>
      </div>
      <div className={rowClass}>
        <FestivalSelect
          festivals={festivals}
          value={slug}
          onChange={setPicked}
        />
        <button
          type="button"
          disabled={slug === ""}
          onClick={() => navigate(`/f/${slug}`)}
          className={`${buttonClass} disabled:opacity-40`}
        >
          祭りモードに切替
        </button>
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
  const festivals = useFestivalList();

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
