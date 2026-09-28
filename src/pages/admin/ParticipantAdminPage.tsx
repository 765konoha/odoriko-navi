import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import { loadAdminCache, saveAdminCache } from "../../lib/adminCache";
import type { FestivalParticipant, FestivalRole } from "../../types/domain";
import {
  applyParticipantSheet,
  createParticipant,
  createRole,
  deleteAllParticipants,
  deleteParticipant,
  listKnownParticipants,
  listParticipants,
  listRoles,
  setParticipantRoles,
  updateParticipant,
  type ParticipantImportRow,
} from "../../lib/adminApi";
import { cohortLabelOf, groupByCohort } from "../../lib/cohort";
import { parseParticipantPaste } from "../../lib/participantImport";
import { normalizeSerial } from "../../lib/serial";
import {
  diffParticipants,
  hasParticipantChanges,
  type ParticipantDiff,
} from "../../lib/participantDiff";
import { compareSerial } from "../../lib/audience";
import {
  AdminActionError,
  AdminLoadError,
  AdminStaleNotice,
} from "../../components/admin/AdminErrorNotice";
import {
  DELETE_ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  reportAdminError,
} from "../../lib/adminError";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

const PAGE_SIZE = 10;

/** 期での絞り込みボタン */
function CohortChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}

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

/** 参加者の個別編集(名前・ニックネーム・役職・削除) */
function ParticipantForm({
  participant,
  roles,
  onSaved,
  onDeleted,
  onCancel,
}: {
  participant: FestivalParticipant;
  roles: FestivalRole[];
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(participant.name);
  const [nickname, setNickname] = useState(participant.nickname);
  const [roleIds, setRoleIds] = useState<string[]>(participant.roleIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const ok = window.confirm(
      `${participant.serial} / ${participant.nickname}(${participant.name})をこの祭りの参加者から削除しますか?\n\nこの参加者宛ての個人お知らせの紐付けも削除されます。\n(参加者マスターのシリアルは残ります)`,
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await deleteParticipant(participant.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
      setSaving(false);
    }
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

      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={saving}
        className="w-full rounded-xl border-2 border-red-300 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
      >
        この参加者を削除
      </button>
    </form>
  );
}

/** 参加者を1人追加する */
function AddParticipantForm({
  festivalId,
  roles,
  registeredSerials,
  onSaved,
  onCancel,
}: {
  festivalId: string;
  roles: FestivalRole[];
  /** この祭りに登録済みのシリアル(候補から外す) */
  registeredSerials: Set<string>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [serial, setSerial] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  // 過去に登録されたことのある人。選ぶと3つの欄が埋まる
  const [known, setKnown] = useState<ParticipantImportRow[]>([]);
  const [knownFailed, setKnownFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listKnownParticipants()
      .then((list) => {
        if (!cancelled) setKnown(list);
      })
      .catch((err) => {
        // 候補が出せなくても手入力で登録できるので、画面は止めない
        reportAdminError("participants:known", err);
        if (!cancelled) setKnownFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // この祭りに未登録の人だけを、期ごとにまとめて出す
  const candidates = useMemo(() => {
    const rest = known
      .filter((k) => !registeredSerials.has(k.serial))
      .sort((a, b) => compareSerial(a.serial, b.serial));
    return groupByCohort(rest, (k) => k.serial);
  }, [known, registeredSerials]);
  const candidateCount = candidates.reduce((n, g) => n + g.items.length, 0);

  // 候補に無いシリアル(手入力・登録済み)なら選択なしに見せる
  const pickedSerial = candidates.some((g) =>
    g.items.some((k) => k.serial === serial),
  )
    ? serial
    : "";

  function pick(picked: string) {
    const row = known.find((k) => k.serial === picked);
    if (!row) return;
    setSerial(row.serial);
    setName(row.name);
    setNickname(row.nickname);
  }
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
          serial: normalizeSerial(serial),
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
          ? `シリアル「${normalizeSerial(serial)}」は既にこの祭りに登録されています`
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

      {candidateCount > 0 && (
        <label className="block">
          <span className={labelClass}>登録したことのある人から選ぶ</span>
          {/* シリアル欄を手で直したら選択は外れる(実際の値と食い違わせない) */}
          <select
            value={pickedSerial}
            onChange={(e) => pick(e.target.value)}
            className={inputClass}
          >
            <option value="">選択してください({candidateCount}人)</option>
            {candidates.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((k) => (
                  <option key={k.serial} value={k.serial}>
                    {k.serial} / {k.name}({k.nickname})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            選ぶと下の3つが埋まります。直してから追加できます。
            この祭りに登録済みの人は出ません。
          </span>
        </label>
      )}

      {knownFailed && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          登録したことのある人の一覧を取得できませんでした。下の欄に直接入力して追加できます。
        </p>
      )}

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

/** 差分の一覧(見出しつき。長いときは枠の中でスクロール) */
function DiffSection({
  title,
  note,
  tone = "slate",
  children,
}: {
  title: string;
  note?: string;
  tone?: "slate" | "amber";
  children: ReactNode;
}) {
  const head =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-500";
  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        tone === "amber" ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <p className={`border-b px-3 py-1.5 text-xs font-bold ${head}`}>
        {title}
      </p>
      {note && (
        <p className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500">
          {note}
        </p>
      )}
      <div className="max-h-64 overflow-y-auto">{children}</div>
    </div>
  );
}

function DiffRow({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-slate-100 px-3 py-1.5 text-sm last:border-b-0">
      {children}
    </p>
  );
}

function SerialCell({ serial }: { serial: string }) {
  return (
    <span className="inline-block w-16 font-mono font-bold">{serial}</span>
  );
}

const APPLY_ERROR_MESSAGE =
  "反映できませんでした。途中まで反映されている場合があります。もう一度「解析してプレビュー」を押すと、残りだけが表示されます。";

/**
 * Spreadsheet の貼り付けで名簿を登録・更新する。
 * 名簿が空なら初回の一括登録。いれば今の名簿と比べて、追加と
 * 名前・ニックネームの変更だけを反映する(役職・荷物グループはそのまま、
 * シートにいない人も消さない)。
 */
function SheetImport({
  festivalId,
  isEmpty,
  onDone,
}: {
  festivalId: string;
  isEmpty: boolean;
  /** 反映後(失敗して途中まで反映された場合も)。message は完了の案内 */
  onDone: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [diff, setDiff] = useState<ParticipantDiff | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();

  const shown = isEmpty || open;
  const previewing = diff != null || parseErrors.length > 0;

  function reset() {
    setParseErrors([]);
    setDiff(null);
    setError(null);
  }

  async function handlePreview() {
    reset();
    const parsed = parseParticipantPaste(text);
    if (parsed.errors.length > 0) {
      setParseErrors(parsed.errors);
      return;
    }
    setChecking(true);
    try {
      // 画面の一覧は前回の控えのことがあるので、比べる直前に読み直す
      const current = await listParticipants(festivalId);
      setDiff(diffParticipants(current, parsed.rows));
    } catch (err) {
      reportAdminError("participants:sheetPreview", err);
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setChecking(false);
    }
  }

  async function handleApply() {
    if (!diff || diff.errors.length > 0 || !hasParticipantChanges(diff)) {
      return;
    }
    setSaving(true);
    setError(null);
    const wasEmpty = isEmpty;
    try {
      await applyParticipantSheet(
        festivalId,
        diff.added,
        diff.changed.map((c) => ({ id: c.id, ...c.after })),
      );
      const message = wasEmpty
        ? "参加者を一括登録しました(全員に踊り子一般を設定)。"
        : `Spreadsheetの内容を反映しました(追加 ${diff.added.length}名・変更 ${diff.changed.length}名)。`;
      setText("");
      reset();
      setOpen(false);
      onDone(message);
    } catch (err) {
      reportAdminError("participants:sheetApply", err);
      // 途中まで反映されているかもしれないので、差分は作り直させる
      setDiff(null);
      setError(APPLY_ERROR_MESSAGE);
      onDone(null);
    } finally {
      setSaving(false);
    }
  }

  const applyLabel = diff
    ? isEmpty
      ? `${diff.added.length}名を一括登録`
      : `追加 ${diff.added.length}名・変更 ${diff.changed.length}名を反映`
    : "";

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      {isEmpty ? (
        <h2 className="text-base font-bold text-slate-800">参加者の一括登録</h2>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-base font-bold text-slate-800">
            Spreadsheetの貼り付けで更新
          </span>
          <span className="text-sm text-slate-500">{open ? "閉じる" : "開く"}</span>
        </button>
      )}

      <div id={panelId} hidden={!shown} className="space-y-3">
        <p className="text-sm text-slate-500">
          {isEmpty
            ? "Spreadsheetから「シリアルナンバー・名前・ニックネーム」の3列をコピーして、そのまま貼り付けてください(ヘッダー行はあっても構いません)。登録した全員に役職「踊り子一般」が設定されます。"
            : "Spreadsheetの3列(シリアルナンバー・名前・ニックネーム)を全員分コピーして貼り付けてください。今の名簿と比べて、新しい人は追加(踊り子一般)、名前・ニックネームが変わった人は更新します。役職と荷物グループはそのまま残り、シートにいない人も削除しません。"}
        </p>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            reset();
          }}
          rows={8}
          className={`${inputClass} font-mono text-sm`}
          placeholder={"115\t大塚さやか\tさやか\n216\t大渕由貴\tふっちー"}
        />

        {!previewing ? (
          <>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={!text.trim() || checking}
              className="w-full rounded-xl bg-slate-700 py-3 font-bold text-white disabled:opacity-40"
            >
              {checking ? "名簿と照合中…" : "解析してプレビュー"}
            </button>
          </>
        ) : (
          <div className="space-y-3">
            {[...parseErrors, ...(diff?.errors ?? [])].length > 0 && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {[...parseErrors, ...(diff?.errors ?? [])].map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}

            {diff && !isEmpty && (
              <p className="text-sm text-slate-600">
                追加 <b>{diff.added.length}</b>名 ・ 変更{" "}
                <b>{diff.changed.length}</b>名 ・ 変わらず {diff.unchanged}名
                {diff.missing.length > 0 && (
                  <> ・ シートにいない {diff.missing.length}名</>
                )}
              </p>
            )}

            {diff && diff.normalized.length > 0 && (
              <DiffSection
                tone="amber"
                title={`シリアルを読み替えた人: ${diff.normalized.length}名`}
                note="シートでは先頭の0が落ちているなど表記が違うため、名簿の人と同じとして扱いました。"
              >
                {diff.normalized.map((n) => (
                  <DiffRow key={n.sheet}>
                    シートの <span className="font-mono">{n.sheet}</span> →
                    名簿の <span className="font-mono font-bold">{n.roster}</span>
                  </DiffRow>
                ))}
              </DiffSection>
            )}

            {diff && diff.added.length > 0 && (
              <DiffSection
                title={`${isEmpty ? "登録予定" : "追加"}: ${diff.added.length}名`}
              >
                {diff.added.map((r) => (
                  <DiffRow key={r.serial}>
                    <SerialCell serial={r.serial} />
                    {r.name}
                    <span className="ml-2 text-slate-500">{r.nickname}</span>
                  </DiffRow>
                ))}
              </DiffSection>
            )}

            {diff && diff.changed.length > 0 && (
              <DiffSection title={`名前・ニックネームの変更: ${diff.changed.length}名`}>
                {diff.changed.map((c) => (
                  <DiffRow key={c.id}>
                    <SerialCell serial={c.serial} />
                    {c.before.name !== c.after.name && (
                      <span className="mr-3">
                        {c.before.name} → <b>{c.after.name}</b>
                      </span>
                    )}
                    {c.before.nickname !== c.after.nickname && (
                      <span className="text-slate-500">
                        {c.before.nickname} → <b>{c.after.nickname}</b>
                      </span>
                    )}
                  </DiffRow>
                ))}
              </DiffSection>
            )}

            {diff && diff.missing.length > 0 && (
              <DiffSection
                tone="amber"
                title={`シートにいない人: ${diff.missing.length}名`}
                note="自動では削除しません。参加をやめた人は、一覧から個別に削除してください。"
              >
                {diff.missing.map((m) => (
                  <DiffRow key={m.id}>
                    <SerialCell serial={m.serial} />
                    {m.name}
                    <span className="ml-2 text-slate-500">{m.nickname}</span>
                  </DiffRow>
                ))}
              </DiffSection>
            )}

            {diff && diff.errors.length === 0 && !hasParticipantChanges(diff) && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                名簿はシートと同じです。反映するものはありません。
              </p>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              {diff && diff.errors.length === 0 && hasParticipantChanges(diff) && (
                <button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-40"
                >
                  {saving ? "反映中…" : applyLabel}
                </button>
              )}
              <button
                type="button"
                onClick={reset}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-600 disabled:opacity-40"
              >
                修正する
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ParticipantAdminPage() {
  const { festival } = useAdminFestival();
  const [participants, setParticipants] = useState<FestivalParticipant[]>([]);
  const [roles, setRoles] = useState<FestivalRole[]>([]);
  const [query, setQuery] = useState("");
  /** 期での絞り込み("" は全員。"その他" は期を判定できないシリアル) */
  const [cohortFilter, setCohortFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<
    { mode: "add" } | { mode: "edit"; participant: FestivalParticipant } | null
  >(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // キャッシュ即時表示済みの祭りID(祭り切替時はキャッシュから読み直す)
  const hydratedForRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!festival) return;
    interface Cache {
      participants: FestivalParticipant[];
      roles: FestivalRole[];
    }
    // 初回は前回取得分を即表示し、裏で最新を取得する
    if (hydratedForRef.current !== festival.id) {
      hydratedForRef.current = festival.id;
      // 前の祭りの結果を新しい祭りの画面に残さない
      setLoadError(null);
      setActionError(null);
      const cached = loadAdminCache<Cache>(festival.id, "participants");
      if (cached) {
        setParticipants(cached.participants);
        setRoles(cached.roles);
        setLoaded(true);
        setLoading(false);
      } else {
        setLoaded(false);
        setLoading(true);
      }
    }
    try {
      const [participantList, roleList] = await Promise.all([
        listParticipants(festival.id),
        listRoles(festival.id),
      ]);
      const sorted = [...participantList].sort((a, b) =>
        compareSerial(a.serial, b.serial),
      );
      setParticipants(sorted);
      setRoles(roleList);
      saveAdminCache<Cache>(festival.id, "participants", {
        participants: sorted,
        roles: roleList,
      });
      setLoaded(true);
      setLoadError(null);
    } catch (err) {
      // 取得できてもキャッシュは残す。何も無いときだけ画面を止める
      reportAdminError("participants:load", err);
      setLoadError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [festival]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roles) map.set(r.id, r.name);
    return map;
  }, [roles]);

  const registeredSerials = useMemo(
    () => new Set(participants.map((p) => p.serial)),
    [participants],
  );

  // 期の選択肢は、実際に登録されている人から作る(空の期は出さない)
  const cohortOptions = useMemo(
    () =>
      groupByCohort(participants, (p) => p.serial).map((g) => ({
        label: g.label,
        count: g.items.length,
      })),
    [participants],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter((p) => {
      if (cohortFilter && cohortLabelOf(p.serial) !== cohortFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.serial.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q)
      );
    });
  }, [participants, query, cohortFilter]);

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
  if (loadError && !loaded) {
    return <AdminLoadError message={loadError} onRetry={() => void load()} />;
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
        onDeleted={() => {
          setEditing(null);
          setFlash("参加者を削除しました。");
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
        registeredSerials={registeredSerials}
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
    setActionError(null);
    setDeletingAll(true);
    try {
      await deleteAllParticipants(festival!.id);
      setFlash("参加者をすべて削除しました。再登録は一括登録から行えます。");
      await load(); // 消せたときだけ読み直す
    } catch (err) {
      reportAdminError("participants:deleteAll", err);
      setActionError(DELETE_ERROR_MESSAGE);
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">参加者管理</h1>

      {loadError && loaded && (
        <AdminStaleNotice message={loadError} onRetry={() => void load()} />
      )}
      {actionError && <AdminActionError message={actionError} />}

      {flash && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          {flash}
        </p>
      )}

      <SheetImport
        festivalId={festival.id}
        isEmpty={participants.length === 0}
        onDone={(message) => {
          if (message) setFlash(message);
          void load();
        }}
      />

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

          {cohortOptions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <CohortChip
                label={`全員(${participants.length})`}
                active={cohortFilter === ""}
                onClick={() => {
                  setCohortFilter("");
                  setPage(1);
                }}
              />
              {cohortOptions.map((c) => (
                <CohortChip
                  key={c.label}
                  label={`${c.label}(${c.count})`}
                  active={cohortFilter === c.label}
                  onClick={() => {
                    setCohortFilter(c.label);
                    setPage(1);
                  }}
                />
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-3 py-2 font-bold">シリアル</th>
                    <th className="px-3 py-2 font-bold">期</th>
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
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                        {cohortLabelOf(p.serial)}
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
                        colSpan={6}
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
          disabled={deletingAll}
          className="w-full rounded-xl border-2 border-red-300 py-3 font-bold text-red-600 disabled:opacity-50"
        >
          {deletingAll ? "削除中…" : "参加者を一括削除"}
        </button>
      )}
    </div>
  );
}
