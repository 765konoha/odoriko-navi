import type { AnnouncementPriority } from "../../types/domain";

const META: Record<AnnouncementPriority, { label: string; className: string }> =
  {
    normal: { label: "お知らせ", className: "bg-slate-200 text-slate-700" },
    important: { label: "重要", className: "bg-amber-100 text-amber-800" },
    emergency: { label: "緊急", className: "bg-red-600 text-white" },
  };

export default function PriorityBadge({
  priority,
}: {
  priority: AnnouncementPriority;
}) {
  const meta = META[priority];
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-bold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
