import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { useAdminFestival } from "../../context/AdminFestivalContext";
import { supabase } from "../../lib/supabase";
import type { Announcement, AnnouncementPriority } from "../../types/domain";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAllAnnouncements,
  updateAnnouncement,
  type AnnouncementInput,
} from "../../lib/adminApi";
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

export interface AnnouncementTemplate {
  title: string;
  body: string;
  priority: AnnouncementPriority;
}

function AnnouncementForm({
  festivalId,
  festivalSlug,
  announcement,
  initial,
  onSaved,
  onCancel,
}: {
  festivalId: string;
  festivalSlug: string;
  announcement: Announcement | null;
  initial: AnnouncementTemplate | null;
  onSaved: (pushInfo: string | null) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(announcement?.title ?? initial?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? initial?.body ?? "");
  const [priority, setPriority] = useState<AnnouncementPriority>(
    announcement?.priority ?? initial?.priority ?? "normal",
  );
  const [publishedAt, setPublishedAt] = useState(() =>
    isoToDatetimeLocal(announcement?.publishedAt ?? new Date().toISOString()),
  );
  const [expiresAt, setExpiresAt] = useState(
    announcement?.expiresAt ? isoToDatetimeLocal(announcement.expiresAt) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: AnnouncementInput = {
      festivalId,
      title: title.trim(),
      body: body.trim(),
      priority,
      publishedAt: datetimeLocalToIso(publishedAt),
      expiresAt: expiresAt ? datetimeLocalToIso(expiresAt) : null,
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
            const { data, error: fnError } = await supabase.functions.invoke(
              "send-push",
              {
                body: {
                  title: input.title,
                  body: input.body,
                  // 通知タップでこのお知らせの詳細を開く
                  url: `${import.meta.env.BASE_URL}#/${festivalSlug}/announcements/${newId}`,
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
  const location = useLocation();
  // スケジュール管理から遷移してきた場合の定型文(予定変更のお知らせ)
  const [pendingTemplate, setPendingTemplate] =
    useState<AnnouncementTemplate | null>(
      (location.state as { template?: AnnouncementTemplate } | null)
        ?.template ?? null,
    );
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; announcement: Announcement } | null
  >(pendingTemplate ? { mode: "new" } : null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 定型文はリロード時に再適用されないよう履歴stateから除去
  useEffect(() => {
    if (pendingTemplate) window.history.replaceState({}, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!festival) return;
    setLoading(true);
    setAnnouncements(await listAllAnnouncements(festival.id));
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
        initial={editing.mode === "new" ? pendingTemplate : null}
        onSaved={(pushInfo) => {
          setEditing(null);
          setPendingTemplate(null);
          setFlash(pushInfo);
          void load();
        }}
        onCancel={() => {
          setEditing(null);
          setPendingTemplate(null);
        }}
      />
    );
  }

  async function handleDelete(a: Announcement) {
    if (!window.confirm(`「${a.title}」を削除しますか?`)) return;
    await deleteAnnouncement(a.id);
    await load();
  }

  const now = new Date();

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
