import type { FestivalData } from "../../types/domain";
import type { Viewer } from "../../lib/audience";

/**
 * ホームの荷物グループ案内。
 * シリアル選択済みの参加者にのみ表示する(番号指定なし・不参加は非表示)。
 */
export default function BaggageGroupCard({
  data,
  viewer,
}: {
  data: FestivalData;
  viewer: Viewer;
}) {
  // 個人を特定できない利用者には表示しない
  if (!viewer.participant) return null;

  const group = viewer.participant.baggageGroupId
    ? (data.baggageGroups.find(
        (g) => g.id === viewer.participant!.baggageGroupId,
      ) ?? null)
    : null;

  if (!group) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-bold text-amber-700">🧳 荷物グループ</p>
        <p className="mt-1 text-base font-bold text-amber-900">
          荷物グループは未配属です。
        </p>
        <p className="text-sm text-amber-800">
          運営からの案内をご確認ください。
        </p>
      </div>
    );
  }

  const leader =
    data.participants.find((p) => p.id === group.leaderParticipantId) ?? null;
  const isSelfLeader = leader?.id === viewer.participant.id;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500">🧳 荷物グループ</p>
      <p className="mt-1 text-base font-bold text-slate-900">
        あなたは荷物グループ{group.groupCode}です。
      </p>
      <p className="text-sm text-slate-600">
        {isSelfLeader
          ? "あなたが荷物リーダーです。"
          : leader
            ? `リーダーは ${leader.serial} / ${leader.nickname} です。`
            : "リーダーは未設定です。"}
      </p>
    </div>
  );
}
