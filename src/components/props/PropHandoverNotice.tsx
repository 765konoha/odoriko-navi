import { Link } from "react-router-dom";
import type { HandoverEntry } from "../../lib/propHandover";
import { serialLabel } from "../../lib/props";
import { formatTime } from "../../lib/time";

/**
 * その日に小道具の受け渡しがあることの案内。
 *
 * tone="dark" は「次のリハ」の黒いカードの中に置く用。
 * tone="light" は祭りホームに単独のカードとして置く用。
 */
export default function PropHandoverNotice({
  outgoing,
  incoming,
  names,
  tone,
  to,
}: {
  outgoing: HandoverEntry[];
  incoming: HandoverEntry[];
  names: Map<string, string>;
  tone: "dark" | "light";
  to: string;
}) {
  if (outgoing.length === 0 && incoming.length === 0) return null;

  const dark = tone === "dark";

  const lines = (
    <div className="mt-1.5 space-y-1">
      {outgoing.map(({ transfer, item }) => (
        <p
          key={transfer.id}
          className={`text-sm ${dark ? "text-amber-50" : "text-amber-900"}`}
        >
          <span className="font-bold">渡す</span>
          {" — "}
          {item.displayName} → {serialLabel(transfer.toSerial, names)}
          {transfer.scheduledAt && (
            <span className={dark ? "text-amber-200/80" : "text-amber-700"}>
              {" "}
              {formatTime(transfer.scheduledAt)}
            </span>
          )}
        </p>
      ))}
      {incoming.map(({ transfer, item }) => (
        <p
          key={transfer.id}
          className={`text-sm ${dark ? "text-amber-50" : "text-amber-900"}`}
        >
          <span className="font-bold">受け取る</span>
          {" — "}
          {item.displayName} ← {serialLabel(transfer.fromSerial, names)}
          {transfer.scheduledAt && (
            <span className={dark ? "text-amber-200/80" : "text-amber-700"}>
              {" "}
              {formatTime(transfer.scheduledAt)}
            </span>
          )}
        </p>
      ))}
    </div>
  );

  if (dark) {
    return (
      <div className="mt-4 rounded-xl bg-amber-500/15 px-3 py-2.5">
        <p className="text-sm font-bold text-amber-300">
          🧰 この日は小道具の受け渡しがあります
        </p>
        {lines}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="block rounded-2xl border border-amber-300 bg-amber-50 p-4"
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-amber-800">
          🧰 小道具の受け渡しがあります
        </p>
        <span className="ml-auto shrink-0 text-sm font-bold text-amber-800">
          確認する ›
        </span>
      </div>
      {lines}
    </Link>
  );
}
