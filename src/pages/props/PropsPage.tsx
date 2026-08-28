import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../context/UserContext";
import { repository } from "../../repositories";
import {
  loadSerialListCache,
  saveSerialListCache,
} from "../../lib/storage";
import { compareSerial } from "../../lib/audience";
import {
  changeTransferTarget,
  completeTransfer,
  loadPropUserData,
  scheduledLabel,
  serialLabel,
  type PropUserData,
} from "../../lib/props";
import { conditionLabel } from "../../types/props";
import RefreshIndicator from "../../components/layout/RefreshIndicator";

/**
 * 小道具リレー(利用者画面)。通常モード・祭りモードの双方から使う。
 * 祭りへの参加・不参加は判定せず、参加者マスターのシリアルだけで利用できる。
 */
export default function PropsPage() {
  const { selection, selectUser } = useUser();
  const serial = selection?.serial ?? null;

  const [serials, setSerials] = useState<string[]>(() => loadSerialListCache());
  const [data, setData] = useState<PropUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [newTarget, setNewTarget] = useState("");

  // 参加者マスターのシリアル(祭り参加チェックはしない)
  useEffect(() => {
    let cancelled = false;
    void repository
      .listParticipantSerials()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        const sorted = [...list].sort(compareSerial);
        setSerials(sorted);
        saveSerialListCache(sorted);
      })
      .catch(() => {
        // 取得失敗時はキャッシュのまま
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!serial) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await loadPropUserData(serial));
      setError(null);
    } catch {
      setError("小道具の情報を取得できませんでした。通信環境を確認してください。");
    } finally {
      setLoading(false);
    }
  }, [serial]);

  useEffect(() => {
    void load();
  }, [load]);

  const names = data?.names ?? new Map<string, string>();
  const targetOptions = useMemo(
    () => serials.filter((s) => s !== serial),
    [serials, serial],
  );

  // ---- シリアル未選択(番号指定なし)の場合 ----
  if (!serial) {
    return (
      <div className="space-y-4 px-4 py-4">
        <h1 className="text-xl font-bold">小道具リレー</h1>
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-base font-bold text-slate-800">
            小道具リレーを利用するにはシリアルを選択してください。
          </p>
          <p className="text-sm text-slate-600">
            保管中の小道具や受け渡し予定は個人ごとの情報のため、シリアルの選択が必要です。
          </p>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) selectUser(e.target.value);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-bold"
          >
            <option value="">シリアルを選択</option>
            {serials.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  async function handleComplete(transferId: string, itemName: string) {
    const ok = window.confirm(
      `${itemName}を受け取りましたか?\n\n受取完了すると、現在の保有者があなたに変更されます。`,
    );
    if (!ok) return;
    setBusyId(transferId);
    setError(null);
    try {
      await completeTransfer(transferId, serial!);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "受取に失敗しました");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleChangeTarget(transferId: string) {
    if (!newTarget) return;
    setBusyId(transferId);
    setError(null);
    try {
      await changeTransferTarget(transferId, serial!, newTarget);
      setChangingId(null);
      setNewTarget("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "変更に失敗しました");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">小道具リレー</h1>
        <RefreshIndicator />
      </div>

      <p className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-600">
        利用者{" "}
        <span className="font-bold text-slate-800">
          {serialLabel(serial, names)}
        </span>
      </p>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      {loading && (
        <p className="py-4 text-center text-slate-500">読み込み中…</p>
      )}

      {/* 受け取る予定 */}
      <section>
        <h2 className="mb-2 text-base font-bold text-slate-700">
          あなたへの受け渡し
        </h2>
        <div className="space-y-2">
          {(data?.incoming ?? []).map(({ transfer, item }) => (
            <div
              key={transfer.id}
              className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
            >
              <p className="text-base font-bold text-slate-900">
                {item.displayName}
              </p>
              <p className="text-sm text-slate-700">
                {serialLabel(transfer.fromSerial, names)} から
              </p>
              {scheduledLabel(transfer.scheduledAt) && (
                <p className="text-sm font-bold text-blue-900">
                  受け渡し予定日: {scheduledLabel(transfer.scheduledAt)}
                </p>
              )}
              {transfer.note && (
                <p className="mt-1 text-sm text-slate-600">
                  メモ: {transfer.note}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleComplete(transfer.id, item.displayName)}
                disabled={busyId === transfer.id}
                className="mt-3 w-full rounded-xl bg-blue-700 py-3 text-base font-bold text-white disabled:opacity-50"
              >
                {busyId === transfer.id ? "処理中…" : "受け取りました"}
              </button>
            </div>
          ))}
          {!loading && (data?.incoming.length ?? 0) === 0 && (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
              受け取る予定はありません。
            </p>
          )}
        </div>
      </section>

      {/* 渡す予定 */}
      <section>
        <h2 className="mb-2 text-base font-bold text-slate-700">
          あなたが渡す予定
        </h2>
        <div className="space-y-2">
          {(data?.outgoing ?? []).map(({ transfer, item }) => (
            <div key={transfer.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-base font-bold text-slate-900">
                {item.displayName}
              </p>
              <p className="text-sm text-slate-700">
                → {serialLabel(transfer.toSerial, names)}
              </p>
              {scheduledLabel(transfer.scheduledAt) && (
                <p className="text-sm font-bold text-slate-700">
                  受け渡し予定日: {scheduledLabel(transfer.scheduledAt)}
                </p>
              )}
              {changingId === transfer.id ? (
                <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
                  <select
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  >
                    <option value="">受け渡し先を選択</option>
                    {targetOptions.map((s) => (
                      <option key={s} value={s}>
                        {serialLabel(s, names)}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleChangeTarget(transfer.id)}
                      disabled={!newTarget || busyId === transfer.id}
                      className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                    >
                      変更する
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChangingId(null);
                        setNewTarget("");
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setChangingId(transfer.id);
                    setNewTarget("");
                  }}
                  className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-blue-700"
                >
                  受け渡し先を変更
                </button>
              )}
            </div>
          ))}
          {!loading && (data?.outgoing.length ?? 0) === 0 && (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
              渡す予定はありません。
            </p>
          )}
        </div>
      </section>

      {/* 保管中 */}
      <section>
        <h2 className="mb-2 text-base font-bold text-slate-700">
          あなたが現在保管中
        </h2>
        <div className="space-y-2">
          {(data?.holding ?? []).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-2xl bg-white p-4 shadow-sm"
            >
              <p className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">
                {item.displayName}
              </p>
              {item.condition !== "normal" && (
                <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                  {conditionLabel(item.condition)}
                </span>
              )}
            </div>
          ))}
          {!loading && (data?.holding.length ?? 0) === 0 && (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
              現在保管中の小道具はありません。
            </p>
          )}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        受け渡し予定の作成は小道具担当が行います。渡す相手が変わった場合は「受け渡し先を変更」から変更してください。
      </p>
    </div>
  );
}
