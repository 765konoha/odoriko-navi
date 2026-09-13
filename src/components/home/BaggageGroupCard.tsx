import { useId, useState } from "react";
import type { FestivalData, FestivalParticipant } from "../../types/domain";
import type { Viewer } from "../../lib/audience";
import { baggageGroupMembers } from "../../lib/baggage";

/**
 * ホームの荷物グループ案内。
 * シリアル選択済みの参加者にのみ表示する(番号指定なし・不参加は非表示)。
 *
 * 同じグループの人は普段は畳んでおく。
 * ホームは当日いちばん見る画面なので、既定では
 * 「自分のグループ」と「リーダーが誰か」だけを出す。
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

  const members = baggageGroupMembers(
    data.participants,
    group.id,
    group.leaderParticipantId,
  );

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

      <GroupMembers
        members={members}
        selfId={viewer.participant.id}
        leaderId={group.leaderParticipantId}
      />
    </div>
  );
}

/** 同じグループの人の一覧(既定は閉じている) */
function GroupMembers({
  members,
  selfId,
  leaderId,
}: {
  members: FestivalParticipant[];
  selfId: string;
  leaderId?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // 自分しかいないなら開閉させる意味がないので、そのまま出す
  if (members.length <= 1) {
    return (
      <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
        このグループに登録されているのはあなただけです。
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">
          グループのメンバー({members.length}人)
        </span>
        <span className="shrink-0 text-xs font-bold text-slate-500">
          {open ? "閉じる" : "見る"}
        </span>
        <span
          aria-hidden="true"
          className={`inline-block shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
      </button>

      {/* aria-controls の参照先を常に置いておき、開閉は hidden で切り替える */}
      <ul id={panelId} hidden={!open} className="mt-2 space-y-1.5">
        {members.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
              {p.serial} / {p.nickname}
            </span>
            {p.id === leaderId && (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                リーダー
              </span>
            )}
            {p.id === selfId && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600">
                あなた
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
