import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import { supabase } from "../../lib/supabase";
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
  FestivalParticipant,
  FestivalRole,
} from "../../types/domain";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAllAnnouncements,
  listParticipants,
  listRoles,
  updateAnnouncement,
  type AnnouncementInput,
} from "../../lib/adminApi";
import { compareSerial } from "../../lib/audience";
import {
  datetimeLocalToIso,
  formatTime,
  isoToDatetimeLocal,
  toDateString,
  todayString,
} from "../../lib/time";
import PriorityBadge from "../../components/announcements/PriorityBadge";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

function statusLabel(a: Announcement, now: Date): string {
  if (new Date(a.publishedAt) > now) return "配信予約";
  if (a.expiresAt && new Date(a.expiresAt) <= now) return "配信終了";
  return "配信中";
}

function AnnouncementForm({
  festivalId,
  festivalSlug,
  announcement,
  roles,
  participants,
  onSaved,
  onCancel,
}: {
  festivalId: string;
  festivalSlug: string;
  announcement: Announcement | null;
  roles: FestivalRole[];
  participants: FestivalParticipant[];
  onSaved: (pushInfo: string | null) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [priority, setPriority] = useState<AnnouncementPriority>(
    announcement?.priority ?? "normal",
  );
  const [publishedAt, setPublishedAt] = useState(() =>
    isoToDatetimeLocal(announcement?.publishedAt ?? new Date().toISOString()),
  );
  const [expiresAt, setExpiresAt] = useState(
    announcement?.expiresAt ? isoToDatetimeLocal(announcement.expiresAt) : "",
  );
  const [audienceType, setAudienceType] = useState<AnnouncementAudience>(
    announcement?.audienceType ?? "all",
  );
  const [audienceRoleIds, setAudienceRoleIds] = useState<string[]>(
    announcement?.audienceRoleIds ?? [],
  );
  const [audienceParticipantIds, setAudienceParticipantIds] = useState<
    string[]
  >(announcement?.audienceParticipantIds ?? []);
  const [participantQuery, setParticipantQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => compareSerial(a.serial, b.serial)),
    [participants],
  );
  const filteredParticipants = useMemo(() => {
    const q = participantQuery.trim().toLowerCase();
    if (!q) return sortedParticipants;
    return sortedParticipants.filter(
      (p) =>
        p.serial.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q),
    );
  }, [sortedParticipants, participantQuery]);

  function toggleRole(roleId: string, checked: boolean) {
    setAudienceRoleIds((prev) =>
      checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
    );
  }

  function toggleParticipant(id: string, checked: boolean) {
    setAudienceParticipantIds((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id),
    );
  }

  /** プッシュ通知の送信対象シリアル(全員向けは null=全端末) */
  function pushTargetSerials(): string[] | null {
    if (audienceType === "all") return null;
    if (audienceType === "roles") {
      return participants
        .filter((p) => p.roleIds.some((id) => audienceRoleIds.includes(id)))
        .map((p) => p.serial);
    }
    return participants
      .filter((p) => audienceParticipantIds.includes(p.id))
      .map((p) => p.serial);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (audienceType === "roles" && audienceRoleIds.length === 0) {
      setError("配信対象の役職を1つ以上選択してください");
      return;
    }
    if (
      audienceType === "participants" &&
      audienceParticipantIds.length === 0
    ) {
      setError("配信対象の参加者を1名以上選択してください");
      return;
    }
    setSaving(true);
    setError(null);
    const input: AnnouncementInput = {
      festivalId,
      title: title.trim(),
      body: body.trim(),
      priority,
      publishedAt: datetimeLocalToIso(publishedAt),
      expiresAt: expiresAt ? datetimeLocalToIso(expiresAt) : null,
      audienceType,
      audienceRoleIds: audienceType === "roles" ? audienceRoleIds : [],
      audienceParticipantIds:
        audienceType === "participants" ? audienceParticipantIds : [],
    };
    try {
      let pushInfo: string | null = null;
      if (announcement) {
        await updateAnnouncement(announcement.id, input);
      } else {
        const newId = await createAnnouncement(input);
        // 即時公開かつ重要度が「重要」「緊急」の新規お知らせのみプッシュ通知を送信
        const isPublishedNow =
          new Date(input.publishedAt).getTime() <= Date.now() + 60_000;
        if (input.priority === "normal") {
          pushInfo = isPublishedNow
            ? "お知らせを配信しました(通常のためプッシュ通知は送信していません)。"
            : null;
        } else if (isPublishedNow && supabase) {
          try {
            const serials = pushTargetSerials();
            const { data, error: fnError } = await supabase.functions.invoke(
              "send-push",
              {
                body: {
                  title: input.title,
                  body: input.body,
                  // 通知タップでこのお知らせの詳細を開く
                  url: `${import.meta.env.BASE_URL}#/${festivalSlug}/announcements/${newId}`,
                  // 配信対象のシリアルにのみ通知(null=全端末)
                  serials,
                },
              },
            );
            const result = data as {
              total?: number;
              sent?: number;
              removed?: number;
              errors?: string[];
            } | null;
            if (fnError) {
              pushInfo =
                "お知らせは配信しましたが、プッシュ通知の送信に失敗しました。";
            } else if (result?.total === undefined) {
              // 旧版の関数は total を返さない
              pushInfo =
                "お知らせを配信しました。※send-push関数が旧版のようです。最新のコードで再デプロイしてください。";
            } else if (result.total === 0) {
              pushInfo =
                "お知らせを配信しました(プッシュ通知をオンにしている端末はまだありません)。";
            } else if (result.errors?.length) {
              pushInfo = `プッシュ通知: ${result.sent ?? 0}/${result.total}台に送信。失敗理由: ${result.errors[0]}`;
            } else {
              pushInfo = `プッシュ通知を送信しました(${result.sent ?? 0}台)。`;
            }
          } catch {
            pushInfo =
              "お知らせは配信しましたが、プッシュ通知の送信に失敗しました。";
          }
        }
      }
      onSaved(pushInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">
        {announcement ? "お知らせを編集" : "お知らせを作成"}
      </h2>

      <label className="block">
        <span className={labelClass}>タイトル *</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>本文 *</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={5}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>重要度</span>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
          className={inputClass}
        >
          <option value="normal">通常(プッシュ通知なし)</option>
          <option value="important">重要(プッシュ通知あり)</option>
          <option value="emergency">緊急(プッシュ通知+ホームに強制表示)</option>
        </select>
      </label>

      <div>
        <span className={labelClass}>配信対象</span>
        <div className="mt-1 flex gap-3">
          {(
            [
              ["all", "全員"],
              ["roles", "役職"],
              ["participants", "個人"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="audienceType"
                checked={audienceType === value}
                onChange={() => setAudienceType(value)}
                className="h-5 w-5"
              />
              <span className="text-base">{label}</span>
            </label>
          ))}
        </div>

        {audienceType === "roles" && (
          <div className="mt-2 space-y-2 rounded-lg bg-slate-50 px-3 py-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={audienceRoleIds.includes(role.id)}
                  onChange={(e) => toggleRole(role.id, e.target.checked)}
                  className="h-5 w-5"
                />
                <span className="text-base">{role.name}</span>
              </label>
            ))}
            <p className="text-xs text-slate-500">
              選択した役職の利用者にのみ表示・通知されます。
            </p>
          </div>
        )}

        {audienceType === "participants" && (
          <div className="mt-2 space-y-2 rounded-lg bg-slate-50 px-3 py-2">
            <input
              value={participantQuery}
              onChange={(e) => setParticipantQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
              placeholder="🔍 シリアル・名前・ニックネームで検索"
            />
            <p className="text-xs font-bold text-slate-600">
              選択中: {audienceParticipantIds.length}名
            </p>
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {filteredParticipants.map((p) => (
                <label key={p.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={audienceParticipantIds.includes(p.id)}
                    onChange={(e) => toggleParticipant(p.id, e.target.checked)}
                    className="h-5 w-5 shrink-0"
                  />
                  <span className="min-w-0 truncate text-base">
                    {p.serial} / {p.nickname}
                    <span className="ml-1.5 text-sm text-slate-500">
                      {p.name}
                    </span>
                  </span>
                </label>
              ))}
              {filteredParticipants.length === 0 && (
                <p className="text-sm text-slate-500">
                  {participants.length === 0
                    ? "参加者が未登録です。参加者タブから登録してください。"
                    : "該当する参加者がいません。"}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500">
              選択した本人にのみ表示・通知されます(番号指定なしの利用者には表示されません)。
            </p>
          </div>
        )}
      </div>

      <label className="block">
        <span className={labelClass}>公開日時</span>
        <input
          type="datetime-local"
          value={publishedAt}
          onChange={(e) => setPublishedAt(e.target.value)}
          required
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>公開終了日時(空欄で無期限)</span>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className={inputClass}
        />
      </label>

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
          {saving ? "保存中…" : announcement ? "保存" : "配信する"}
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

export default function AnnouncementAdminPage() {
  const { festival } = useAdminFestival();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [roles, setRoles] = useState<FestivalRole[]>([]);
  const [participants, setParticipants] = useState<FestivalParticipant[]>([]);
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; announcement: Announcement } | null
  >(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!festival) return;
    setLoading(true);
    const [announcementList, roleList, participantList] = await Promise.all([
      listAllAnnouncements(festival.id),
      listRoles(festival.id),
      listParticipants(festival.id),
    ]);
    setAnnouncements(announcementList);
    setRoles(roleList);
    setParticipants(participantList);
    setLoading(false);
  }, [festival]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!festival) return null;
  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  if (editing) {
    return (
      <AnnouncementForm
        festivalId={festival.id}
        festivalSlug={festival.slug}
        announcement={editing.mode === "edit" ? editing.announcement : null}
        roles={roles}
        participants={participants}
        onSaved={(pushInfo) => {
          setEditing(null);
          setFlash(pushInfo);
          void load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  async function handleDelete(a: Announcement) {
    if (!window.confirm(`「${a.title}」を削除しますか?`)) return;
    await deleteAnnouncement(a.id);
    await load();
  }

  const now = new Date();

  function audienceLabel(a: Announcement): string {
    const type = a.audienceType ?? "all";
    if (type === "all") return "全員";
    if (type === "roles") {
      const names = (a.audienceRoleIds ?? []).map(
        (id) => roles.find((r) => r.id === id)?.name ?? "?",
      );
      return `役職: ${names.join("・")}`;
    }
    return `個人: ${(a.audienceParticipantIds ?? []).length}名`;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">お知らせ管理</h1>

      {flash && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          {flash}
        </p>
      )}

      <button
        type="button"
        onClick={() => setEditing({ mode: "new" })}
        className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
      >
        + お知らせを作成
      </button>

      <div className="space-y-2">
        {announcements.map((a) => {
          const status = statusLabel(a, now);
          const publishedDate = toDateString(a.publishedAt);
          const dateLabel =
            publishedDate === todayString()
              ? formatTime(a.publishedAt)
              : `${publishedDate.slice(5).replace("-", "/")} ${formatTime(a.publishedAt)}`;
          return (
            <div key={a.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <PriorityBadge priority={a.priority} />
                <span
                  className={`text-xs font-bold ${
                    status === "配信中"
                      ? "text-emerald-600"
                      : status === "配信予約"
                        ? "text-blue-600"
                        : "text-slate-400"
                  }`}
                >
                  {status}
                </span>
                <span className="ml-auto text-sm tabular-nums text-slate-500">
                  {dateLabel}
                </span>
              </div>
              <p className="mt-1 text-base font-bold text-slate-900">
                {a.title}
              </p>
              {(a.audienceType ?? "all") !== "all" && (
                <p className="mt-0.5 text-xs font-bold text-violet-700">
                  {audienceLabel(a)}
                </p>
              )}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditing({ mode: "edit", announcement: a })}
                  className="text-sm font-bold text-blue-700"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(a)}
                  className="text-sm font-bold text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          );
        })}
        {announcements.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            お知らせはまだありません。
          </p>
        )}
      </div>
    </div>
  );
}
