import { Link } from "react-router-dom";
import { usePropSummary } from "../../hooks/usePropSummary";

/** ホームに置く小道具リレーの入口(通常モード・祭りモード共通) */
export default function PropRelayCard({ slug }: { slug: string }) {
  const summary = usePropSummary();
  const hasIncoming = (summary?.incoming ?? 0) > 0;

  return (
    <Link
      to={`/${slug}/props`}
      className={`block rounded-2xl p-4 ${
        hasIncoming
          ? "border border-blue-200 bg-blue-50"
          : "bg-white shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        <p
          className={`text-xs font-bold ${
            hasIncoming ? "text-blue-700" : "text-slate-500"
          }`}
        >
          🧰 小道具リレー
        </p>
        <span className="ml-auto text-sm font-bold text-blue-700">
          確認する ›
        </span>
      </div>
      {summary ? (
        <p className="mt-1 text-base font-bold text-slate-900">
          {hasIncoming && (
            <span className="text-blue-800">
              あなたへの受け渡し {summary.incoming}件
            </span>
          )}
          {hasIncoming && <span className="mx-1.5 text-slate-300">/</span>}
          <span className={hasIncoming ? "text-slate-700" : ""}>
            保管中 {summary.holding}件
          </span>
          {summary.outgoing > 0 && (
            <span className="ml-1.5 text-slate-700">
              ・渡す予定 {summary.outgoing}件
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-600">
          保管中の小道具と受け渡し予定を確認できます。
        </p>
      )}
    </Link>
  );
}
