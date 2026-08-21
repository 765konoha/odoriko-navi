import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import type { FestivalParticipant, FestivalRole } from "../../types/domain";
import {
  bulkRegisterParticipants,
  createParticipant,
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

const PAGE_SIZE = 10;

/** 役職チェックボックス(編集・追加フォーム共通) */
function RoleChecks({
  roles,
  roleIds,
  onToggle,
}: {
  roles: FestivalRole[];
  roleIds: string[];
  onToggle: (roleId: string, checked: boolean) => void;
}) {
  return (
    <div>
      <span className={labelClass}>役職(複数選択可)</span>
      <div className="mt-1 space-y-2">
        {roles.map((role) => (
          <label key={role.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={roleIds.includes(role.id)}
              onChange={(e) => onToggle(role.id, e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-base">{role.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

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

      <RoleChecks
        roles={roles}
        roleIds={roleIds}
        onToggle={(roleId, checked) =>
          setRoleIds((prev) =>
            checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
          )
        }
      />

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

/** 参加者を1人追加する */
function AddParticipantForm({
  festivalId,
  roles,
  onSaved,
  onCancel,
}: {
  festivalId: string;
  roles: FestivalRole[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [serial, setSerial] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  // 既定は踊り子一般(初期登録と同じ)
  const [roleIds, setRoleIds] = useState<string[]>(() =>
    roles.filter((r) => r.isDefault).map((r) => r.id),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createParticipant(
        festivalId,
        {
          serial: serial.trim(),
          name: name.trim(),
          nickname: nickname.trim(),
        },
        roleIds,
      );
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "追加に失敗しました";
      setError(
        message.includes("duplicate")
          ? `シリアル「${serial.trim()}」は既にこの祭りに登録されています`
          : message,
      );
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-bold text-slate-800">参加者を1人追加</h2>

      <label className="block">
        <span className={labelClass}>シリアル *</span>
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          required
          className={inputClass}
          placeholder="例: 706"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <span className="mt-1 block text-xs text-slate-500">
          マスターに無いシリアルは自動でマスターへ追加されます。
        </span>
      </label>

      <label className="block">
        <span className={labelClass}>名前 *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder="例: 松本望"
        />
      </label>

      <label className="block">
        <span className={labelClass}>ニックネーム *</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          className={inputClass}
          placeholder="例: のぞみ"
        />
      </label>

      <RoleChecks
        roles={roles}
        roleIds={roleIds}
        onToggle={(roleId, checked) =>
          setRoleIds((prev) =>
            checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
          )
        }
      />

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
          {saving ? "追加中…" : "追加"}
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
        Spreadsheetから「シリアルナンバー・名前・ニックネーム」の3列をコピーして、そのまま貼り付けてください(ヘッダー行はあっても構いません)。登録した全員に役職「踊り子一般」が設定されます。
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
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<
    { mode: "add" } | { mode: "edit"; participant: FestivalParticipant } | null
  >(null);
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

  // 10人ごとのページング(検索やデータ変更でページが範囲外になったら丸める)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  if (!festival) return null;
  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  if (editing?.mode === "edit") {
    return (
      <ParticipantForm
        participant={editing.participant}
        roles={roles}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (editing?.mode === "add") {
    return (
      <AddParticipantForm
        festivalId={festival.id}
        roles={roles}
        onSaved={() => {
          setEditing(null);
          setFlash("参加者を追加しました。");
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

      {participants.length === 0 && (
        <BulkImport
          festivalId={festival.id}
          onDone={() => {
            setFlash("参加者を一括登録しました(全員に踊り子一般を設定)。");
            void load();
          }}
        />
      )}

      <button
        type="button"
        onClick={() => setEditing({ mode: "add" })}
        className={`w-full rounded-xl py-3 font-bold ${
          participants.length === 0
            ? "border-2 border-slate-300 text-slate-600"
            : "bg-slate-900 text-white"
        }`}
      >
        + 参加者を1人追加
      </button>

      {participants.length > 0 && (
        <>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base"
            placeholder="🔍 シリアル・名前・ニックネームで検索"
          />

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-3 py-2 font-bold">シリアル</th>
                    <th className="px-3 py-2 font-bold">名前</th>
                    <th className="px-3 py-2 font-bold">ニックネーム</th>
                    <th className="px-3 py-2 font-bold">役職</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setEditing({ mode: "edit", participant: p })}
                      className="cursor-pointer border-b border-slate-100 last:border-b-0 active:bg-slate-50"
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                        {p.serial}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-900">
                        {p.name}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                        {p.nickname}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                        {p.roleIds.length === 0
                          ? "—"
                          : p.roleIds
                              .map((id) => roleName.get(id) ?? "?")
                              .join("・")}
                      </td>
                      <td className="px-2 py-2.5 text-right text-slate-300">
                        ›
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-center text-slate-500"
                      >
                        該当する参加者がいません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-lg px-3 py-1.5 text-sm font-bold text-blue-700 disabled:text-slate-300"
              >
                ‹ 前へ
              </button>
              <span className="text-sm text-slate-500">
                {currentPage} / {pageCount} ページ
                <span className="ml-2 text-xs">(全{filtered.length}名)</span>
              </span>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= pageCount}
                className="rounded-lg px-3 py-1.5 text-sm font-bold text-blue-700 disabled:text-slate-300"
              >
                次へ ›
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            行をタップすると編集できます(名前・ニックネーム・役職)。
          </p>
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
