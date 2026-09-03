import { Link, useParams } from "react-router-dom";
import { useViewer } from "../../hooks/useViewer";
import { viewerLabel } from "../../lib/audience";
import ModeSwitchCard from "../../components/layout/ModeSwitchCard";
import PropRelayCard from "../../components/props/PropRelayCard";
import NextRehearsalCard from "../../components/rehearsal/NextRehearsalCard";
import { useUserSelect } from "../../hooks/useUserSelect";

/** 通常モード(日常運用)のホーム */
export default function NormalHomePage() {
  const { festivalSlug } = useParams();
  const { requestChange } = useUserSelect();
  const viewer = useViewer();

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-lg font-bold text-slate-700">踊り子ナビ</h1>

      <ModeSwitchCard />

      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5">
        <span className="text-sm text-slate-500">利用者</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
          {viewerLabel(viewer)}
        </span>
        <button
          type="button"
          onClick={requestChange}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-600"
        >
          変更
        </button>
      </div>

      <PropRelayCard slug={festivalSlug!} />

      <NextRehearsalCard slug={festivalSlug!} />

      <footer className="pt-6 pb-2 text-center">
        <Link to="/admin" className="text-xs text-slate-400 underline">
          運営の方はこちら
        </Link>
      </footer>
    </div>
  );
}
