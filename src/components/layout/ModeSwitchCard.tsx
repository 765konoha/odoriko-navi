import { Link } from "react-router-dom";

const cardClass =
  "flex items-center gap-2 rounded-xl bg-white px-4 py-2.5";
const buttonClass =
  "shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-600";

/**
 * 通常モードのホームに置く切替。
 * 祭りモードはどの祭りの当日運用かで中身が変わるため、
 * 切り替えるときに祭りを選ぶ(/festivals が1つしか無ければ素通しする)。
 */
export function ToFestivalModeCard() {
  return (
    <div className={cardClass}>
      <span className="text-sm text-slate-500">現在</span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
        通常モード
      </span>
      <Link to="/festivals" className={buttonClass}>
        祭りモードに切替
      </Link>
    </div>
  );
}

/** 祭りモードのホームに置く切替。どの祭りを見ているかを添える */
export function ToNormalModeCard({ festivalName }: { festivalName: string }) {
  return (
    <div className={cardClass}>
      <span className="text-sm text-slate-500">現在</span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
        祭りモード
        <span className="ml-1 font-medium text-slate-500">{festivalName}</span>
      </span>
      <Link to="/" className={buttonClass}>
        通常モードに切替
      </Link>
    </div>
  );
}
