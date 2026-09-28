import { useEffect, useMemo, useState } from "react";
import { repository } from "../../repositories";
import {
  loadSerialListCache,
  saveSerialListCache,
} from "../../lib/storage";
import { useUser } from "../../context/UserContext";
import { useUserSelect } from "../../hooks/useUserSelect";
import { useSerialNicknames } from "../../hooks/useSerialNicknames";
import { compareSerial } from "../../lib/audience";
import { serialOptionLabel } from "../../lib/serialNames";

/**
 * 利用者(シリアル)選択画面。
 * 初回アクセス時と「変更」タップ時に表示する。
 * 参加者マスターのシリアルから選択する。
 *
 * 祭りモードでも通常モードと同じく、その祭りへの参加・不参加は確かめずに
 * 選んだシリアルを保存する。呼び名は祭りごとの名簿のニックネームを並記する。
 */
export default function UserSelectScreen({
  festivalName = null,
}: {
  /** 祭りモードで開いたときの祭りの名前(案内に出すだけ) */
  festivalName?: string | null;
}) {
  const { names: nicknamesBySerial, loading: loadingNames } =
    useSerialNicknames();
  const { selection, selectUser } = useUser();
  const { changeRequested, closeChange } = useUserSelect();
  const isChange = changeRequested; // 選択済み→「変更」で開いた場合

  const [serials, setSerials] = useState<string[]>(() =>
    loadSerialListCache(),
  );
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string>(selection?.serial ?? "");

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
        // 取得失敗(オフライン等)はキャッシュのまま
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return serials;
    return serials.filter(
      (s) =>
        s.toLowerCase().includes(q) ||
        (nicknamesBySerial.get(s) ?? []).some((n) =>
          n.toLowerCase().includes(q),
        ),
    );
  }, [serials, query, nicknamesBySerial]);

  function handleConfirm() {
    if (!picked) return;
    selectUser(picked);
    closeChange();
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-8">
      <h1 className="text-center text-xl font-bold text-slate-800">
        あなたのシリアルを選択してください
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        {festivalName != null
          ? "選択すると、あなたの役職に合わせた予定とお知らせが表示されます。"
          : "選択すると、あなたのリハの出欠や小道具の受け渡しが表示されます。"}
      </p>
      {festivalName && (
        <p className="mt-1 text-center text-sm font-bold text-slate-600">
          対象のお祭り: {festivalName}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {serials.length > 8 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
            placeholder="🔍 シリアルを検索(例: 615)"
            autoCapitalize="none"
            autoCorrect="off"
          />
        )}

        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-bold"
        >
          <option value="">選択してください</option>
          {filtered.map((s) => (
            <option key={s} value={s}>
              {serialOptionLabel(s, nicknamesBySerial)}
            </option>
          ))}
        </select>

        {serials.length === 0 && (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
            {loadingNames
              ? "参加者情報を読み込み中…"
              : "参加者が登録されていません。「番号指定なし」でご利用ください。"}
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!picked}
          className="w-full rounded-xl bg-slate-900 py-3.5 text-base font-bold text-white disabled:opacity-40"
        >
          この番号で利用する
        </button>

        <button
          type="button"
          onClick={() => {
            selectUser(null);
            closeChange();
          }}
          className="w-full rounded-xl border border-slate-300 bg-white py-3.5 text-base font-bold text-slate-600"
        >
          番号指定なしで利用する
        </button>

        {isChange && (
          <button
            type="button"
            onClick={closeChange}
            className="w-full py-2 text-center text-sm font-medium text-slate-400"
          >
            キャンセル
          </button>
        )}
      </div>
    </div>
  );
}
