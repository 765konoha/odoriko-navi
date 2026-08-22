import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import type { BaggageGroup, FestivalParticipant } from "../../types/domain";
import {
  assignBaggageGroup,
  createBaggageGroup,
  deleteBaggageGroup,
  listBaggageGroups,
  listParticipants,
  setBaggageGroupLeader,
} from "../../lib/adminApi";
import { compareSerial } from "../../lib/audience";
import { loadAdminCache, saveAdminCache } from "../../lib/adminCache";

function label(p: FestivalParticipant): string {
  return `${p.serial} / ${p.nickname}`;
}

export default function BaggageAdminPage() {
  const { festival } = useAdminFestival();
  const [groups, setGroups] = useState<BaggageGroup[]>([]);
  const [participants, setParticipants] = useState<FestivalParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 未配属パネル
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState("");
  const [assigning, setAssigning] = useState(false);

  // グループ追加・アコーディオン開閉
  const [addingGroup, setAddingGroup] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // キャッシュ即時表示済みの祭りID
  const hydratedForRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!festival) return;
    interface Cache {
      groups: BaggageGroup[];
      participants: FestivalParticipant[];
    }
    if (hydratedForRef.current !== festival.id) {
      hydratedForRef.current = festival.id;
      const cached = loadAdminCache<Cache>(festival.id, "baggage");
      if (cached) {
        setGroups(cached.groups);
        setParticipants(cached.participants);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    const [groupList, participantList] = await Promise.all([
      listBaggageGroups(festival.id),
      listParticipants(festival.id),
    ]);
    const sortedGroups = [...groupList].sort((a, b) =>
      compareSerial(a.groupCode, b.groupCode),
    );
    const sortedParticipants = [...participantList].sort((a, b) =>
      compareSerial(a.serial, b.serial),
    );
    setGroups(sortedGroups);
    setParticipants(sortedParticipants);
    saveAdminCache<Cache>(festival.id, "baggage", {
      groups: sortedGroups,
      participants: sortedParticipants,
    });
    setLoading(false);
  }, [festival]);

  useEffect(() => {
    void load();
  }, [load]);

  const unassigned = useMemo(
    () => participants.filter((p) => !p.baggageGroupId),
    [participants],
  );
  const filteredUnassigned = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return unassigned;
    return unassigned.filter(
      (p) =>
        p.serial.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q),
    );
  }, [unassigned, query]);

  const membersOf = useCallback(
    (groupId: string) => participants.filter((p) => p.baggageGroupId === groupId),
    [participants],
  );

  if (!festival) return null;
  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  /** 操作を実行し、リーダー整合性エラー等を画面に表示する */
  async function run(action: () => Promise<void>, doneMessage?: string) {
    setErrorMsg(null);
    setFlash(null);
    try {
      await action();
      if (doneMessage) setFlash(doneMessage);
      await load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "操作に失敗しました");
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleAssign() {
    if (selectedIds.size === 0 || !assignTarget) return;
    setAssigning(true);
    const count = selectedIds.size;
    const target = groups.find((g) => g.id === assignTarget);
    await run(
      () => assignBaggageGroup([...selectedIds], assignTarget),
      `${count}名を荷物グループ${target?.groupCode ?? ""}へ割り当てました。`,
    );
    setSelectedIds(new Set());
    setAssigning(false);
  }

  /** 追加時に使う次の番号(既存の数値コードの最大+1。空なら1) */
  function nextGroupCode(): string {
    const numbers = groups
      .map((g) => Number(g.groupCode))
      .filter((n) => Number.isInteger(n) && n > 0);
    return String(numbers.length === 0 ? 1 : Math.max(...numbers) + 1);
  }

  async function handleAddGroup() {
    const code = nextGroupCode();
    setAddingGroup(true);
    setErrorMsg(null);
    try {
      await createBaggageGroup(festival!.id, code);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "追加に失敗しました";
      setErrorMsg(
        message.includes("duplicate")
          ? `荷物グループ${code}は既に存在します`
          : message,
      );
    } finally {
      setAddingGroup(false);
    }
  }

  async function handleDeleteGroup(group: BaggageGroup) {
    const members = membersOf(group.id);
    if (members.length > 0) {
      const ok = window.confirm(
        `荷物グループ${group.groupCode}を削除しますか?\n\n所属している${members.length}名は未配属に戻ります。\nリーダー設定も解除されます。`,
      );
      if (!ok) return;
    }
    await run(
      () => deleteBaggageGroup(group.id),
      `荷物グループ${group.groupCode}を削除しました。`,
    );
  }

  /** メンバーの移動(グループ変更 or 未配属へ)。リーダーはAPI側でブロックされる */
  async function handleMoveMember(
    p: FestivalParticipant,
    targetGroupId: string,
  ) {
    await run(() =>
      assignBaggageGroup([p.id], targetGroupId === "" ? null : targetGroupId),
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">荷物グループ管理</h1>

      {flash && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          {flash}
        </p>
      )}
      {errorMsg && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
          {errorMsg}
        </p>
      )}

      {/* 未配属 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <p className="text-base font-bold text-slate-800">
            未配属
            <span
              className={`ml-2 ${unassigned.length > 0 ? "text-amber-700" : "text-slate-500"}`}
            >
              {unassigned.length}名
            </span>
          </p>
          <button
            type="button"
            onClick={() => setShowUnassigned((v) => !v)}
            className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600"
          >
            {showUnassigned ? "閉じる" : "未配属メンバーを見る"}
          </button>
        </div>

        {showUnassigned && (
          <div className="mt-3 space-y-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
              placeholder="🔍 シリアル・名前・ニックネームで検索"
            />

            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {filteredUnassigned.map((p) => (
                <label key={p.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={(e) => toggleSelect(p.id, e.target.checked)}
                    className="h-5 w-5 shrink-0"
                  />
                  <span className="min-w-0 truncate text-base">
                    {label(p)}
                    <span className="ml-1.5 text-sm text-slate-500">
                      {p.name}
                    </span>
                  </span>
                </label>
              ))}
              {filteredUnassigned.length === 0 && (
                <p className="py-2 text-sm text-slate-500">
                  {unassigned.length === 0
                    ? "未配属の参加者はいません。"
                    : "該当する参加者がいません。"}
                </p>
              )}
            </div>

            {unassigned.length > 0 && (
              <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-2.5">
                <p className="text-sm font-bold text-slate-600">
                  選択: {selectedIds.size}名
                </p>
                <div className="flex gap-2">
                  <select
                    value={assignTarget}
                    onChange={(e) => setAssignTarget(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  >
                    <option value="">割り当て先を選択</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        荷物グループ{g.groupCode}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleAssign()}
                    disabled={
                      assigning || selectedIds.size === 0 || !assignTarget
                    }
                    className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    割り当て
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* グループ一覧(アコーディオン) */}
      {groups.map((group) => {
        const members = membersOf(group.id);
        const leader =
          members.find((p) => p.id === group.leaderParticipantId) ?? null;
        const open = openIds.has(group.id);
        return (
          <section
            key={group.id}
            className="overflow-hidden rounded-2xl bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() =>
                setOpenIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                })
              }
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span
                className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
              >
                ›
              </span>
              <span className="text-base font-bold text-slate-900">
                荷物グループ{group.groupCode}
              </span>
              <span className="text-sm text-slate-500">{members.length}名</span>
              <span className="ml-auto truncate text-xs text-slate-500">
                {leader ? `リーダー: ${label(leader)}` : "リーダー未設定"}
              </span>
            </button>

            {open && (
              <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">
                    荷物リーダー(このグループの所属者から選択)
                  </span>
                  <select
                    value={group.leaderParticipantId ?? ""}
                    onChange={(e) =>
                      void run(() =>
                        setBaggageGroupLeader(
                          group.id,
                          e.target.value || null,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  >
                    <option value="">(未設定)</option>
                    {members.map((p) => (
                      <option key={p.id} value={p.id}>
                        {label(p)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-1.5">
                  {members.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-base">
                        {label(p)}
                        {p.id === group.leaderParticipantId && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                            リーダー
                          </span>
                        )}
                      </span>
                      <select
                        value={group.id}
                        onChange={(e) => void handleMoveMember(p, e.target.value)}
                        className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        aria-label={`${label(p)}の移動先`}
                      >
                        <option value={group.id}>
                          グループ{group.groupCode}
                        </option>
                        {groups
                          .filter((g) => g.id !== group.id)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              → グループ{g.groupCode}
                            </option>
                          ))}
                        <option value="">→ 未配属に戻す</option>
                      </select>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-sm text-slate-500">
                      所属者はいません。未配属メンバーから割り当ててください。
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleDeleteGroup(group)}
                  className="w-full rounded-lg border border-red-300 py-2 text-sm font-bold text-red-600"
                >
                  荷物グループ{group.groupCode}を削除
                </button>
              </div>
            )}
          </section>
        );
      })}

      {groups.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
          荷物グループはまだありません。下の「+ 荷物グループ追加」から作成してください。
        </p>
      )}

      {/* グループ追加(番号は自動採番) */}
      <button
        type="button"
        onClick={() => void handleAddGroup()}
        disabled={addingGroup}
        className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-40"
      >
        {addingGroup
          ? "追加中…"
          : `+ 荷物グループ${nextGroupCode()}を追加`}
      </button>
    </div>
  );
}
