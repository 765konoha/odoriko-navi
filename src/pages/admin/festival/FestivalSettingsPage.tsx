import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminFestival } from "../../../context/AdminFestivalContext";
import { useAuth } from "../../../context/AuthContext";
import { setFestivalActive } from "../../../lib/adminApi";
import FestivalForm from "./FestivalForm";

/** 祭りワークスペースの「設定」。名前・天気予報地点・演舞回数・開催状態 */
export default function FestivalSettingsPage() {
  const { festival, reload } = useAdminFestival();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!festival) return null;

  if (editing) {
    return (
      <FestivalForm
        festival={festival}
        onSaved={() => {
          setEditing(false);
          void reload();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  async function toggleActive() {
    if (!festival) return;
    setBusy(true);
    try {
      await setFestivalActive(festival.id, !festival.isActive);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const weatherSet =
    festival.weatherLat != null && festival.weatherLng != null;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <Row label="祭りの名前" value={festival.name} />
        <Row label="ID(共有URLの一部)" value={festival.slug} />
        <Row
          label="天気予報地点"
          value={weatherSet ? "設定済み" : "未設定"}
          warn={!weatherSet}
        />
        <Row
          label="演舞回数の集計"
          value={festival.danceCountEnabled ? "使う" : "使わない"}
        />
        <Row
          label="状態"
          value={festival.isActive ? "開催中" : "終了"}
        />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white"
        >
          編集する
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-800">
          {festival.isActive ? "祭りを終了する" : "開催中に戻す"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          終了にすると、この祭りは一覧と踊り子側の切替で「過去の祭り」にまとまります。
          データは消えず、URLを直接開けば今までどおり見返せます。
        </p>
        <button
          type="button"
          onClick={() => void toggleActive()}
          disabled={busy}
          className="mt-2 w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50"
        >
          {festival.isActive ? "終了にする" : "開催中に戻す"}
        </button>
      </div>

      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="w-full py-2 text-center text-sm font-medium text-slate-500"
        >
          祭り一覧へ戻る
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full py-2 text-center text-sm font-medium text-slate-500"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 border-b border-slate-100 pb-2 last:border-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-right text-sm font-bold ${
          warn ? "text-amber-700" : "text-slate-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
