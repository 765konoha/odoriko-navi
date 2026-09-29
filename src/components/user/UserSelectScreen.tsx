import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { repository } from "../../repositories";
import {
  loadSerialListCache,
  loadStayNormalDate,
  saveSerialListCache,
} from "../../lib/storage";
import { useUser } from "../../context/UserContext";
import { useUserSelect } from "../../hooks/useUserSelect";
import { useSerialNicknames } from "../../hooks/useSerialNicknames";
import { useFestivalList } from "../layout/FestivalPicker";
import { compareSerial } from "../../lib/audience";
import { serialOptionLabel } from "../../lib/serialNames";
import { findTodayFestivalSlug } from "../../lib/todayFestival";
import { destinationAfterSelect } from "../../lib/afterSelect";
import { todayString } from "../../lib/time";

/**
 * 利用者(シリアル)選択画面。
 * 初回アクセス時と「変更」タップ時に表示する。
 * 参加者マスターのシリアルから選択する。
 *
 * 祭りモードでも通常モードと同じく、その祭りへの参加・不参加は確かめずに
 * 選んだシリアルを保存する。呼び名は祭りごとの名簿のニックネームを並記する。
 *
 * 選んだあとは、その人にとって今日が祭りの当日ならその祭りモード、
 * 通常の日程なら通常モードで開く(destinationAfterSelect)。
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
  const navigate = useNavigate();
  const { festivalSlug } = useParams();
  const { festivals } = useFestivalList();
  // 開く画面を決めているあいだ(当日の祭りを問い合わせている)
  const [deciding, setDeciding] = useState(false);
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

  /**
   * 選択を保存し、開く画面へ移る。
   * 先に移る先を決めてから保存する(保存した瞬間に今の画面が描き直され、
   * 一瞬だけ別のモードが見えてしまうのを避けるため)。
   */
  async function finish(serial: string | null) {
    if (deciding) return;
    setDeciding(true);
    let destination: string | null = null;
    // 祭りの一覧が無い(初回のオフライン等)と判定できないので、今の画面のまま
    if (festivals.length > 0) {
      try {
        const todaySlug = await findTodayFestivalSlug(festivals, serial);
        destination = destinationAfterSelect({
          currentSlug: festivalSlug ?? null,
          todaySlug,
          stayNormalToday: loadStayNormalDate() === todayString(),
        });
      } catch {
        // 問い合わせに失敗したら、今の画面のまま(手で切り替えれば使える)
      }
    }
    selectUser(serial);
    if (destination) {
      // 選択画面の履歴を置き換えるので、戻る操作で選択画面には戻らない
      navigate(destination, { replace: true });
    } else {
      closeChange();
    }
    setDeciding(false);
  }

  function handleConfirm() {
    if (!picked) return;
    void finish(picked);
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
          disabled={!picked || deciding}
          className="w-full rounded-xl bg-slate-900 py-3.5 text-base font-bold text-white disabled:opacity-40"
        >
          {deciding ? "開いています…" : "この番号で利用する"}
        </button>

        <button
          type="button"
          onClick={() => void finish(null)}
          disabled={deciding}
          className="w-full rounded-xl border border-slate-300 bg-white py-3.5 text-base font-bold text-slate-600 disabled:opacity-40"
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
