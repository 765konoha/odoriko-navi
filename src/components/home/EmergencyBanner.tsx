import type { Announcement } from "../../types/domain";
import { formatTime } from "../../lib/time";

interface Props {
  announcement: Announcement;
  onAcknowledge: () => void;
}

/** emergency のお知らせを「確認しました」が押されるまでホームに強制表示する */
export default function EmergencyBanner({ announcement, onAcknowledge }: Props) {
  return (
    <section className="rounded-2xl border-2 border-red-600 bg-red-50 p-4 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚠</span>
        <h2 className="text-lg font-bold text-red-700">緊急連絡</h2>
        <span className="ml-auto text-sm tabular-nums text-red-600">
          {formatTime(announcement.publishedAt)}
        </span>
      </div>

      <p className="mt-2 text-base font-bold text-slate-900">
        {announcement.title}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
        {announcement.body}
      </p>

      <button
        type="button"
        onClick={onAcknowledge}
        className="mt-4 w-full rounded-xl bg-red-600 py-3 text-base font-bold text-white active:bg-red-700"
      >
        確認しました
      </button>
    </section>
  );
}
