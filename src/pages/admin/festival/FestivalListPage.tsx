import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminFestival } from "../../../context/AdminFestivalContext";
import { setFestivalActive } from "../../../lib/adminApi";
import type { Festival } from "../../../types/domain";
import FestivalForm from "./FestivalForm";

/** 準備の抜けを一目で分かるようにする */
function SetupHints({ festival }: { festival: Festival }) {
  const hints: string[] = [];
  if (festival.weatherLat == null || festival.weatherLng == null) {
    hints.push("天気予報地点が未設定");
  }
  if (hints.length === 0) return null;
  return (
    <p className="mt-1 text-xs font-bold text-amber-700">
      ⚠ {hints.join(" / ")}
    </p>
  );
}

function FestivalCard({ festival }: { festival: Festival }) {
  const { reload } = useAdminFestival();
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      await setFestivalActive(festival.id, !festival.isActive);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-base font-bold text-slate-900">
          {festival.name}
        </p>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
            festival.isActive
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-200 text-slate-600"
          }`}
        >
          {festival.isActive ? "開催中" : "終了"}
        </span>
      </div>
      <p className="text-sm text-slate-500">ID: {festival.slug}</p>
      <SetupHints festival={festival} />

      <div className="mt-3 flex items-center gap-2">
        <Link
          to={`/admin/f/${festival.slug}`}
          className="flex-1 rounded-xl bg-slate-900 py-2.5 text-center text-sm font-bold text-white"
        >
          開く
        </Link>
        <button
          type="button"
          onClick={() => void toggleActive()}
          disabled={busy}
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50"
        >
          {festival.isActive ? "終了にする" : "開催中に戻す"}
        </button>
      </div>
    </div>
  );
}

/** 運営の起点。まず祭りを選んでからワークスペースに入る */
export default function FestivalListPage() {
  const { festivals, loading, reload } = useAdminFestival();
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <FestivalForm
        festival={null}
        onSaved={() => {
          setAdding(false);
          void reload();
        }}
        onCancel={() => setAdding(false)}
      />
    );
  }

  if (loading) {
    return <p className="py-8 text-center text-slate-500">読み込み中…</p>;
  }

  const active = festivals.filter((f) => f.isActive);
  const past = festivals.filter((f) => !f.isActive);

  return (
    <div className="space-y-4">
      {festivals.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-slate-600">
          祭りが登録されていません。まずは祭りを追加してください。
        </p>
      )}

      <div className="space-y-2">
        {active.map((f) => (
          <FestivalCard key={f.id} festival={f} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
      >
        + 祭りを追加
      </button>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-500">過去の祭り</h2>
          <div className="space-y-2">
            {past.map((f) => (
              <FestivalCard key={f.id} festival={f} />
            ))}
          </div>
        </section>
      )}

      <p className="pt-2 text-xs text-slate-500">
        「終了」にした祭りは、この一覧と踊り子側の切替で「過去の祭り」にまとまります。
        URLを直接開けば今までどおり見返せます。
      </p>
    </div>
  );
}
