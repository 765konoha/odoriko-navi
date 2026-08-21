import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import type { FestivalParticipant, FestivalRole } from "../../types/domain";
import {
  bulkRegisterParticipants,
  createRole,
  deleteAllParticipants,
  listParticipants,
  listRoles,
  setParticipantRoles,
  updateParticipant,
} from "../../lib/adminApi";
import {
  parseParticipantPaste,
  type ParseResult,
} from "../../lib/participantImport";
import { compareSerial } from "../../lib/audience";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

/** 参加者の個別編集(名前・ニックネーム・役職) */
function ParticipantForm({
  participant,
  roles,
  onSaved,
  onCancel,
}: {
  participant: FestivalParticipant;
  roles: FestivalRole[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(participant.name);
  const [nickname, setNickname] = useState(participant.nickname);
  const [roleIds, setRoleIds] = useState<string[]>(participant.roleIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(roleId: string, checked: boolean) {
    setRoleIds((prev) =>
      checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateParticipant(participant.id, name.trim(), nickname.trim());
      await setParticipantRoles(participant.id, roleIds);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-bold text-slate-800">
        参加者を編集(シリアル: {participant.serial})
      </h2>

      <label className="block">
        <span className={labelClass}>名前 *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>ニックネーム *</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          className={inputClass}
        />
      </label>

      <div>
        <span className={labelClass}>役職(複数選択可)</span>
        <div className="mt-1 space-y-2">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={roleIds.includes(role.id)}
                onChange={(e) => toggleRole(role.id, e.target.checked)}
                className="h-5 w-5"
              />
              <span className="text-base">{role.name}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-600"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

/** Spreadsheet 貼り付けの一括登録(参加者が0人のときのみ) */
function BulkImport({
  festivalId,
  onDone,
}: {
  festivalId: string;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!parsed || parsed.errors.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await bulkRegisterParticipants(festivalId, parsed.rows);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">参加者の一括登録</h2>
      <p className="text-sm text-slate-500">
        Spreadsheetから「シリアルナンバー・名前・ニックネーム」の3列をコピーして、そのまま貼り付けてください(ヘッダー行はあっても構いません)。
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setParsed(null);
        }}
        rows={8}
        className={`${inputClass} font-mono text-sm`}
        placeholder={"115\t大塚さやか\tさやか\n216\t大渕由貴\tふっちー"}
      />

      {parsed == null ? (
        <button
          type="button"
          onClick={() => setParsed(parseParticipantPaste(text))}
          disabled={!text.trim()}
          className="w-full rounded-xl bg-slate-700 py-3 font-bold text-white disabled:opacity-40"
        >
          解析してプレビュー
        </button>
      ) : (
        <div className="space-y-3">
          {parsed.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {parsed.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {parsed.rows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500">
                登録予定: {parsed.rows.length}名
              </p>
              <div className="max-h-64 overflow-y-auto">
                {parsed.rows.map((r) => (
                  <p
                    key={r.serial}
                    className="border-b border-slate-100 px-3 py-1.5 text-sm last:border-b-0"
                  >
                    <span className="inline-block w-16 font-mono font-bold">
                      {r.serial}
                    </span>
                    {r.name}
                    <span className="ml-2 text-slate-500">{r.nickname}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleRegister()}
              disabled={saving || parsed.errors.length > 0}
              className="flex-1 rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-40"
            >
              {saving ? "登録中…" : `${parsed.rows.length}名を一括登録`}
            </button>
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-600"
            >
              修正する
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ParticipantAdminPage() {
  const { festival } = useAdminFestival();
  const [participants, setParticipants] = useState<FestivalParticipant[]>([]);
  const [roles, setRoles] = useState<FestivalRole[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<FestivalParticipant | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!festival) return;
    setLoading(true);
    const [participantList, roleList] = await Promise.all([
      listParticipants(festival.id),
      listRoles(festival.id),
    ]);
    setParticipants(
      [...participantList].sort((a, b) => compareSerial(a.serial, b.serial)),
    );
    setRoles(roleList);
    setLoading(false);
  }, [festival]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roles) map.set(r.id, r.name);
    return map;
  }, [roles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.serial.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q),
    );
  }, [participants, query]);

  if (!festival) return null;
  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  if (editing) {
    return (
      <ParticipantForm
        participant={editing}
        roles={roles}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  async function handleAddRole(e: FormEvent) {
    e.preventDefault();
    const name = newRoleName.trim();
    if (!name) return;
    setAddingRole(true);
    try {
      const maxSort = Math.max(0, ...roles.map((r) => r.sortOrder));
      await createRole(festival!.id, name, maxSort + 1);
      setNewRoleName("");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "追加に失敗しました";
      setFlash(
        message.includes("duplicate")
          ? `役職「${name}」は既に存在します`
          : message,
      );
    } finally {
      setAddingRole(false);
    }
  }

  async function handleDeleteAll() {
    const ok = window.confirm(
      "この祭りに登録されている参加者をすべて削除します。\n\n個人宛てのお知らせも同時に削除されます。\n\nこの操作は元に戻せません。",
    );
    if (!ok) return;
    await deleteAllParticipants(festival!.id);
    setFlash("参加者をすべて削除しました。再登録は一括登録から行えます。");
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">参加者管理</h1>

      {flash && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          {flash}
        </p>
      )}

      {participants.length === 0 ? (
        <BulkImport
          festivalId={festival.id}
          onDone={() => {
            setFlash("参加者を一括登録しました。");
            void load();
          }}
        />
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base"
            placeholder="🔍 シリアル・名前・ニックネームで検索"
          />

          <p className="text-sm text-slate-500">
            参加者 {participants.length}名
            {query.trim() && `(表示中 ${filtered.length}名)`}
          </p>

          <div className="space-y-2">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-base font-bold text-slate-900">
                    {p.serial}
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {p.name}
                  </span>
                  <span className="text-sm text-slate-500">{p.nickname}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {p.roleIds.length === 0 ? (
                    <span className="text-xs font-medium text-amber-700">
                      役職未設定(踊り子一般として表示)
                    </span>
                  ) : (
                    p.roleIds.map((id) => (
                      <span
                        key={id}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600"
                      >
                        {roleName.get(id) ?? "?"}
                      </span>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="ml-auto text-sm font-bold text-blue-700"
                  >
                    編集
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
                該当する参加者がいません。
              </p>
            )}
          </div>
        </>
      )}

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">役職</h2>
        <div className="flex flex-wrap gap-1.5">
          {roles.map((r) => (
            <span
              key={r.id}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-600"
            >
              {r.name}
            </span>
          ))}
        </div>
        <form onSubmit={handleAddRole} className="flex gap-2">
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
            placeholder="例: 旗士"
          />
          <button
            type="submit"
            disabled={addingRole || !newRoleName.trim()}
            className="shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            役職を追加
          </button>
        </form>
      </section>

      {participants.length > 0 && (
        <button
          type="button"
          onClick={() => void handleDeleteAll()}
          className="w-full rounded-xl border-2 border-red-300 py-3 font-bold text-red-600"
        >
          参加者を一括削除
        </button>
      )}
    </div>
  );
}
