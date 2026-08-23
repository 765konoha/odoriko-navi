import { useMode } from "../../context/ModeContext";

/** 通常/祭りモードの切替(ホーム上部に置く) */
export default function ModeSwitchCard() {
  const { mode, toggleMode } = useMode();
  const isFestival = mode === "festival";
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5">
      <span className="text-sm text-slate-500">現在</span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
        {isFestival ? "祭りモード" : "通常モード"}
      </span>
      <button
        type="button"
        onClick={toggleMode}
        className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-600"
      >
        {isFestival ? "通常モードに切替" : "祭りモードに切替"}
      </button>
    </div>
  );
}
