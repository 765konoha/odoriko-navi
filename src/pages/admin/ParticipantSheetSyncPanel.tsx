import { useCallback, useEffect, useState } from "react";
import {
  deleteParticipantSheetSync,
  getParticipantSheetSync,
  runParticipantSheetSync,
  saveParticipantSheetSync,
  type ParticipantSheetSync,
} from "../../lib/participantSheetApi";
import { parseSheetUrl } from "../../lib/rehearsalsAdminApi";
import { formatDateLabel, formatTime, toDateString } from "../../lib/time";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

/**
 * 名簿シートとの同期設定。シートのURLはここでだけ扱う。
 * 出欠のシート同期(SheetSyncPanel)と同じ手順で使えるようにしている。
 */
export default function ParticipantSheetSyncPanel({
  festivalId,
  onSynced,
}: {
  festivalId: string;
  onSynced: () => void;
}) {
  const [sync, setSync] = useState<ParticipantSheetSync | null>(null);
  const [url, setUrl] = useState("");
  const [gid, setGid] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await getParticipantSheetSync(festivalId);
    setSync(s);
    if (s) {
      // タブの指定はURLに混ぜず、下のチェックで扱う。
      // #gid= が付いたまま保存し直すと、使えない指定が残り続けるため。
      setUrl(`https://docs.google.com/spreadsheets/d/${s.sheetId}/edit`);
      setGid(s.gid);
    }
  }, [festivalId]);

  useEffect(() => {
    void load().catch(() => setError("設定の読み込みに失敗しました"));
  }, [load]);

  async function handleSave() {
    const parsed = parseSheetUrl(url);
    if (!parsed) {
      setError("スプレッドシートのURLを貼り付けてください。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await saveParticipantSheetSync(
        festivalId,
        parsed.sheetId,
        parsed.gid || gid,
      );
      await load();
      setMessage("保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await runParticipantSheetSync(festivalId);
      setMessage(result);
      await load();
      onSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : "同期に失敗しました");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("シートとの同期設定を削除しますか?")) return;
    setBusy(true);
    try {
      await deleteParticipantSheetSync(festivalId);
      setSync(null);
      setUrl("");
      setMessage("設定を削除しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">
        名簿シートと同期する
      </h2>
      <p className="text-xs leading-relaxed text-slate-500">
        名簿のスプレッドシートを読みに行き、この祭りの参加者に反映します。
        1行目を見出しにして、シリアル・名前・ニックネームの列を作ってください
        (列の並び順は問いません)。シートは「リンクを知っている全員が閲覧可」に
        しておいてください。
      </p>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        同期は<b>足す・直すだけで、消しません</b>。
        シートから消えた人は結果にお名前を出すので、外すかどうかは
        一覧から判断してください
        (自動で消すと個人宛てのお知らせや荷物グループの所属も消えるため)。
        既にいる人の役職はそのままです。
      </p>

      <label className="block">
        <span className={labelClass}>スプレッドシートのURL</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
          className={`${inputClass} text-xs`}
          inputMode="url"
        />
        <span className="mt-1 block text-xs text-slate-500">
          取り込みたいタブを開いた状態のURLを貼ってください。
          URLに #gid= が含まれていればそのタブを、無ければ先頭のタブを読みます。
        </span>
      </label>

      {gid !== "" && (
        <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={gid !== ""}
            onChange={(e) => !e.target.checked && setGid("")}
            className="mt-0.5 h-5 w-5"
          />
          <span className="text-sm text-slate-700">
            タブを指定して読む(gid={gid})
            <span className="mt-0.5 block text-xs text-slate-500">
              外すと先頭のタブを読みます。指定したタブが無いと読み取りに失敗するので、
              うまくいかないときは外してください。
            </span>
          </span>
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
        >
          保存
        </button>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={busy || sync == null}
          className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
        >
          {busy ? "実行中…" : "今すぐ同期"}
        </button>
      </div>

      {/* 結果には取得先のURLが入る。長い1語なので途中でも折り返す */}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 [overflow-wrap:anywhere]">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 [overflow-wrap:anywhere]">
          {error}
        </p>
      )}

      {sync?.lastSyncedAt && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <p className="font-bold text-slate-600">
            最終同期 {formatDateLabel(toDateString(sync.lastSyncedAt))}{" "}
            {formatTime(sync.lastSyncedAt)}
          </p>
          <p
            className={`[overflow-wrap:anywhere] ${
              sync.lastOk === false ? "text-red-700" : "text-slate-600"
            }`}
          >
            {sync.lastResult}
          </p>
        </div>
      )}

      {sync && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="text-xs font-bold text-red-600"
        >
          同期設定を削除する
        </button>
      )}
    </div>
  );
}
