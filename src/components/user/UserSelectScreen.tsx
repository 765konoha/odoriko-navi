import { useEffect, useMemo, useState } from "react";
import { repository } from "../../repositories";
import {
  loadSerialListCache,
  saveSerialListCache,
} from "../../lib/storage";
import { useFestivalData } from "../../context/FestivalDataContext";
import { useUser } from "../../context/UserContext";
import { compareSerial } from "../../lib/audience";

/**
 * 利用者(シリアル)選択画面。
 * 初回アクセス時と「変更」タップ時に表示する。
 * 参加者マスターのシリアルから選択し、今回の祭りに不参加なら保存しない。
 */
export default function UserSelectScreen() {
  const { data, loading } = useFestivalData();
  const { selection, selectUser, cancelChange } = useUser();
  const isChange = selection != null; // 選択済み→「変更」で開いた場合

  const [serials, setSerials] = useState<string[]>(() =>
    loadSerialListCache(),
  );
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string>(selection?.serial ?? "");
  const [notice, setNotice] = useState<string | null>(null);

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

  // 今回の祭りの参加者(シリアル→ニックネーム)。選びやすさのために表示に使う
  const nicknameBySerial = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.participants ?? []) map.set(p.serial, p.nickname);
    return map;
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return serials;
    return serials.filter(
      (s) =>
        s.toLowerCase().includes(q) ||
        (nicknameBySerial.get(s) ?? "").toLowerCase().includes(q),
    );
  }, [serials, query, nicknameBySerial]);

  function handleConfirm() {
    if (!picked) return;
    if (!data) {
      setNotice(
        "祭りの参加者情報を読み込めませんでした。通信環境を確認してください。",
      );
      return;
    }
    const isParticipant = data.participants.some((p) => p.serial === picked);
    if (!isParticipant) {
      setNotice("今回のお祭りには不参加です");
      return; // 保存しない
    }
    selectUser(picked);
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-8">
      <h1 className="text-center text-xl font-bold text-slate-800">
        あなたのシリアルを選択してください
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        選択すると、あなたの役職に合わせた予定とお知らせが表示されます。
      </p>

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
          onChange={(e) => {
            setPicked(e.target.value);
            setNotice(null);
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-bold"
        >
          <option value="">選択してください</option>
          {filtered.map((s) => {
            const nickname = nicknameBySerial.get(s);
            return (
              <option key={s} value={s}>
                {nickname ? `${s} / ${nickname}` : s}
              </option>
            );
          })}
        </select>

        {serials.length === 0 && (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
            {loading
              ? "参加者情報を読み込み中…"
              : "参加者が登録されていません。「番号指定なし」でご利用ください。"}
          </p>
        )}

        {notice && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-base font-bold text-amber-900">{notice}</p>
            {notice === "今回のお祭りには不参加です" && (
              <p className="mt-1 text-sm text-amber-800">
                別のシリアルを選択するか、「番号指定なし」でご利用ください。
              </p>
            )}
          </div>
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
          onClick={() => selectUser(null)}
          className="w-full rounded-xl border border-slate-300 bg-white py-3.5 text-base font-bold text-slate-600"
        >
          番号指定なしで利用する
        </button>

        {isChange && (
          <button
            type="button"
            onClick={cancelChange}
            className="w-full py-2 text-center text-sm font-medium text-slate-400"
          >
            キャンセル
          </button>
        )}
      </div>
    </div>
  );
}
