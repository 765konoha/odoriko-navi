import { useCallback, useEffect, useMemo, useState } from "react";
import type { ParticipantMasterEntry } from "../../types/domain";
import {
  deleteMasterParticipant,
  listParticipantMaster,
  listRegistrations,
  mergeParticipant,
  renameParticipant,
  updateRegistrations,
  type MasterChangeLine,
  type MasterRegistration,
} from "../../lib/participantMasterApi";
import { normalizeSerial } from "../../lib/serial";
import { findSimilarSerials } from "../../lib/serialSimilarity";
import { compareSerial } from "../../lib/audience";
import { toDateString } from "../../lib/time";
import { AdminLoadError } from "../../components/admin/AdminErrorNotice";
import { LOAD_ERROR_MESSAGE, reportAdminError } from "../../lib/adminError";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

const FILTERS = [
  { key: "all", label: "すべて" },
  { key: "similar", label: "似たシリアルあり" },
  { key: "unlisted", label: "どの名簿にも無い" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

/**
 * RPC が返した理由(日本語で書いたもの)だけを画面に出す。
 * 通信エラーなどの詳細はログにだけ残す。
 */
function actionErrorMessage(context: string, err: unknown): string {
  reportAdminError(context, err);
  const message = err instanceof Error ? err.message : "";
  return /[ぁ-んァ-ヶ一-龠]/.test(message)
    ? message
    : "処理できませんでした。通信環境を確認して、もう一度お試しください。";
}

function displayName(e: ParticipantMasterEntry): string {
  if (!e.name && !e.nickname) return "";
  if (e.nickname && e.name && e.nickname !== e.name) {
    return `${e.nickname}(${e.name})`;
  }
  return e.nickname || e.name || "";
}

/** 一覧の1件に添える使われ方 */
function usageText(e: ParticipantMasterEntry): string {
  const parts: string[] = [];
  if (e.attendanceCount > 0) parts.push(`出欠 ${e.attendanceCount}件`);
  if (e.propCount > 0) parts.push(`小道具 ${e.propCount}件`);
  if (e.transferCount > 0) parts.push(`受け渡し ${e.transferCount}件`);
  if (e.pushCount > 0) parts.push(`通知 ${e.pushCount}台`);
  if (e.lastSeenAt) {
    const [, m, d] = toDateString(e.lastSeenAt).split("-");
    parts.push(`最終利用 ${Number(m)}/${Number(d)}`);
  }
  return parts.length > 0 ? parts.join(" ・ ") : "記録なし";
}

function ChangeLines({ lines }: { lines: MasterChangeLine[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((l, i) => (
        <li
          key={i}
          className={`rounded-lg px-3 py-2 ${
            l.level === "error"
              ? "bg-red-50 font-bold text-red-700"
              : l.level === "warn"
                ? "bg-amber-50 text-amber-900"
                : "bg-slate-50 text-slate-700"
          }`}
        >
          {l.level === "warn" ? "⚠ " : ""}
          {l.message}
        </li>
      ))}
    </ul>
  );
}

type Action =
  | { kind: "edit"; serial: string }
  | { kind: "merge"; serial: string }
  | { kind: "delete"; serial: string };

/**
 * シリアルと名前の編集。
 * 名前・ニックネームはマスタではなく祭りごとの名簿が持っているので、
 * 名簿ごとに並べて直せるようにする(祭りによって呼び名が違うこともある)。
 */
function EditPanel({
  entry,
  onDone,
  onCancel,
}: {
  entry: ParticipantMasterEntry;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [serial, setSerial] = useState(entry.serial);
  const [renameLines, setRenameLines] = useState<MasterChangeLine[] | null>(null);
  const [original, setOriginal] = useState<MasterRegistration[] | null>(null);
  const [rows, setRows] = useState<MasterRegistration[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRegistrations(entry.serial)
      .then((r) => {
        if (cancelled) return;
        setOriginal(r);
        setRows(r);
      })
      .catch((err) => {
        if (!cancelled) setError(actionErrorMessage("master:registrations", err));
      });
    return () => {
      cancelled = true;
    };
  }, [entry.serial]);

  const target = normalizeSerial(serial);
  const serialChanged = target !== "" && target !== entry.serial;

  const changed = rows.filter((r) => {
    const before = original?.find((o) => o.id === r.id);
    return before && (before.name !== r.name || before.nickname !== r.nickname);
  });
  const hasEmptyName = rows.some((r) => r.name.trim() === "");

  function updateRow(id: string, patch: Partial<MasterRegistration>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function checkRename() {
    setBusy(true);
    setError(null);
    setRenameLines(null);
    try {
      setRenameLines(await renameParticipant(entry.serial, target, false));
    } catch (err) {
      setError(actionErrorMessage("master:renamePlan", err));
    } finally {
      setBusy(false);
    }
  }

  async function applyRename() {
    setBusy(true);
    setError(null);
    try {
      await renameParticipant(entry.serial, target, true);
      onDone(
        `${entry.serial} を ${target} に変更しました。${entry.serial} を選んでいた人は、アプリで ${target} を選び直してもらってください。`,
      );
    } catch (err) {
      setError(actionErrorMessage("master:rename", err));
      setBusy(false);
    }
  }

  async function saveNames() {
    setBusy(true);
    setError(null);
    try {
      await updateRegistrations(
        entry.serial,
        changed.map((r) => ({ ...r, name: r.name.trim(), nickname: r.nickname.trim() })),
      );
      onDone(`${entry.serial} の名前を保存しました。`);
    } catch (err) {
      setError(actionErrorMessage("master:names", err));
      setBusy(false);
    }
  }

  const renameBlocked = renameLines?.some((l) => l.level === "error") ?? false;

  return (
    <div className="mt-3 space-y-4 border-t border-slate-100 pt-3">
      <section className="space-y-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">シリアル</span>
          <input
            value={serial}
            onChange={(e) => {
              setSerial(e.target.value);
              setRenameLines(null);
            }}
            className={`${inputClass} font-mono`}
          />
        </label>
        {serialChanged && target !== serial.trim() && (
          <p className="text-xs text-slate-500">「{target}」として登録します。</p>
        )}
        {renameLines && <ChangeLines lines={renameLines} />}
        {serialChanged && !renameLines && (
          <button
            type="button"
            onClick={() => void checkRename()}
            disabled={busy}
            className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            シリアルの変更内容を確認
          </button>
        )}
        {serialChanged && renameLines && (
          <button
            type="button"
            onClick={() => void applyRename()}
            disabled={busy || renameBlocked}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {target} に変更する
          </button>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium text-slate-600">
          名前・ニックネーム(祭りごとの名簿)
        </p>
        {original === null && !error && (
          <p className="text-sm text-slate-500">読み込み中…</p>
        )}
        {original !== null && rows.length === 0 && (
          <p className="text-xs text-slate-500">
            どの祭りの名簿にも載っていないため、名前はありません。
            名前は祭りの「参加者」で名簿に登録すると付きます。
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">{r.festivalName}</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-slate-500">名前</span>
                <input
                  value={r.name}
                  onChange={(e) => updateRow(r.id, { name: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">ニックネーム</span>
                <input
                  value={r.nickname}
                  onChange={(e) => updateRow(r.id, { nickname: e.target.value })}
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        ))}
        {rows.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setRows((prev) =>
                prev.map((r) => ({
                  ...r,
                  name: prev[0].name,
                  nickname: prev[0].nickname,
                })),
              )
            }
            className="text-xs font-bold text-blue-700"
          >
            1つ目の名前・ニックネームを全部の祭りにそろえる
          </button>
        )}
        {hasEmptyName && (
          <p className="text-xs font-bold text-red-600">名前は空にできません。</p>
        )}
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => void saveNames()}
            disabled={busy || changed.length === 0 || hasEmptyName}
            className="w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            名前を保存{changed.length > 0 ? `(${changed.length}件)` : ""}
          </button>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-600"
      >
        閉じる
      </button>
    </div>
  );
}

function MergePanel({
  entry,
  entries,
  similar,
  onDone,
  onCancel,
}: {
  entry: ParticipantMasterEntry;
  entries: ParticipantMasterEntry[];
  similar: string[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [to, setTo] = useState(similar[0] ?? "");
  const [lines, setLines] = useState<MasterChangeLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 似ているシリアルを先に並べる
  const options = useMemo(() => {
    const others = entries.filter((e) => e.serial !== entry.serial);
    const first = others.filter((e) => similar.includes(e.serial));
    const rest = others.filter((e) => !similar.includes(e.serial));
    return { first, rest };
  }, [entries, entry.serial, similar]);

  // 統合先を選ぶたびに、何が起きるかを読み直す
  useEffect(() => {
    setLines(null);
    setError(null);
    if (!to) return;
    let cancelled = false;
    setBusy(true);
    mergeParticipant(entry.serial, to, false)
      .then((l) => {
        if (!cancelled) setLines(l);
      })
      .catch((err) => {
        if (!cancelled) setError(actionErrorMessage("master:mergePlan", err));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.serial, to]);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await mergeParticipant(entry.serial, to, true);
      onDone(
        `${entry.serial} を ${to} に統合しました。${entry.serial} を選んでいた人は、アプリで ${to} を選び直してもらってください。`,
      );
    } catch (err) {
      setError(actionErrorMessage("master:merge", err));
      setBusy(false);
    }
  }

  const label = (e: ParticipantMasterEntry) =>
    [e.serial, displayName(e), e.festivalNames.join("・")]
      .filter(Boolean)
      .join(" ");
  const hasError = lines?.some((l) => l.level === "error") ?? false;
  // 正しい方を間違った方へ統合しかけていないか(名簿に載っている方が普通は正しい)
  const target = entries.find((e) => e.serial === to);
  const looksReversed =
    target != null &&
    entry.festivalNames.length > 0 &&
    target.festivalNames.length === 0;

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <p className="text-sm text-slate-600">
        <strong>{entry.serial}</strong>{" "}
        の記録(名簿・出欠・小道具・通知)を残す方のシリアルへ移して、
        <strong>{entry.serial} を消します</strong>。
      </p>
      <label className="block">
        <span className="text-sm font-medium text-slate-600">
          残す方(正しいシリアル)
        </span>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputClass}
        >
          <option value="">選択してください</option>
          {options.first.length > 0 && (
            <optgroup label="似ているシリアル">
              {options.first.map((e) => (
                <option key={e.serial} value={e.serial}>
                  {label(e)}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="すべて">
            {options.rest.map((e) => (
              <option key={e.serial} value={e.serial}>
                {label(e)}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      {looksReversed && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">
          ⚠ 残す方の {to} はどの祭りの名簿にも載っていません。向きが逆ではありませんか?
          {entry.serial} を残すときは、{to} の「別のシリアルに統合…」から {entry.serial} を選んでください。
        </p>
      )}
      {busy && !lines && <p className="text-sm text-slate-500">確認中…</p>}
      {lines && <ChangeLines lines={lines} />}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy || !to || !lines || hasError}
          className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {to ? `${to} に統合する` : "統合する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy && lines != null}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
        >
          やめる
        </button>
      </div>
    </div>
  );
}

function DeletePanel({
  entry,
  onDone,
  onCancel,
}: {
  entry: ParticipantMasterEntry;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [lines, setLines] = useState<MasterChangeLine[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    deleteMasterParticipant(entry.serial, false)
      .then((l) => {
        if (!cancelled) setLines(l);
      })
      .catch((err) => {
        if (!cancelled) setError(actionErrorMessage("master:deletePlan", err));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.serial]);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await deleteMasterParticipant(entry.serial, true);
      onDone(`${entry.serial} を削除しました。`);
    } catch (err) {
      setError(actionErrorMessage("master:delete", err));
      setBusy(false);
    }
  }

  const hasError = lines?.some((l) => l.level === "error") ?? false;

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      {busy && !lines && <p className="text-sm text-slate-500">確認中…</p>}
      {lines && <ChangeLines lines={lines} />}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy || !lines || hasError}
          className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {entry.serial} を削除する
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
        >
          やめる
        </button>
      </div>
    </div>
  );
}

/**
 * 踊り子マスタ(全祭り共通のシリアル一覧)の管理。
 * 名簿の貼り付けで打ち間違えたシリアルは、シリアル選択画面にも出てしまうため、
 * 正しいシリアルへの統合か削除で片付けられるようにする。
 */
export default function ParticipantMasterPage() {
  const [entries, setEntries] = useState<ParticipantMasterEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await listParticipantMaster();
    setEntries([...rows].sort((a, b) => compareSerial(a.serial, b.serial)));
  }, []);

  const runLoad = useCallback(() => {
    setLoading(true);
    setError(null);
    void load()
      .catch((err) => {
        reportAdminError("master:load", err);
        setError(LOAD_ERROR_MESSAGE);
      })
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    runLoad();
  }, [runLoad]);

  const similar = useMemo(
    () => findSimilarSerials((entries ?? []).map((e) => e.serial)),
    [entries],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? []).filter((e) => {
      if (filter === "similar" && !similar.has(e.serial)) return false;
      if (filter === "unlisted" && e.festivalNames.length > 0) return false;
      if (!q) return true;
      return [e.serial, e.name ?? "", e.nickname ?? ""].some((s) =>
        s.toLowerCase().includes(q),
      );
    });
  }, [entries, query, filter, similar]);

  function handleDone(message: string) {
    setAction(null);
    setNotice(message);
    runLoad();
  }

  if (loading && !entries) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }
  if (error && !entries) {
    return <AdminLoadError message={error} onRetry={runLoad} />;
  }
  const all = entries ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">踊り子マスタ</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          全部の祭りで共通のシリアルの一覧です(シリアル選択画面にもこの一覧が出ます)。
          シリアルや名前の間違いは「編集」で直せます。打ち間違いで増えたシリアルは、正しいシリアルへ統合するか削除してください。
        </p>
      </div>

      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="シリアル・名前で絞り込む"
        className={inputClass}
      />
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => {
            const count =
              f.key === "all"
                ? all.length
                : f.key === "similar"
                  ? similar.size
                  : all.filter((e) => e.festivalNames.length === 0).length;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                  filter === f.key
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 shadow-sm"
                }`}
              >
                {f.label} {count}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
          該当するシリアルはありません。
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((e) => {
          const like = similar.get(e.serial) ?? [];
          const open = action?.serial === e.serial ? action : null;
          return (
            <li key={e.serial} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-base font-bold text-slate-900">
                  {e.serial}
                </span>
                <span className="min-w-0 truncate text-sm text-slate-600">
                  {displayName(e)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {e.festivalNames.length > 0 ? (
                  <>名簿: {e.festivalNames.join("・")}</>
                ) : (
                  <span className="font-bold text-amber-700">
                    どの祭りの名簿にも載っていません
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">{usageText(e)}</p>
              {like.length > 0 && (
                <p className="mt-1 text-xs font-bold text-amber-700">
                  ⚠ 似たシリアル: {like.join("、")}
                </p>
              )}

              {!open && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setAction({ kind: "edit", serial: e.serial });
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setAction({ kind: "merge", serial: e.serial });
                    }}
                    className="flex-1 rounded-xl border border-slate-300 py-2 text-sm font-bold text-slate-700"
                  >
                    別のシリアルに統合…
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setAction({ kind: "delete", serial: e.serial });
                    }}
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700"
                  >
                    削除…
                  </button>
                </div>
              )}
              {open?.kind === "edit" && (
                <EditPanel
                  entry={e}
                  onDone={handleDone}
                  onCancel={() => setAction(null)}
                />
              )}
              {open?.kind === "merge" && (
                <MergePanel
                  entry={e}
                  entries={all}
                  similar={like}
                  onDone={handleDone}
                  onCancel={() => setAction(null)}
                />
              )}
              {open?.kind === "delete" && (
                <DeletePanel
                  entry={e}
                  onDone={handleDone}
                  onCancel={() => setAction(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
