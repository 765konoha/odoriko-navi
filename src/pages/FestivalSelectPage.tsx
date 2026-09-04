import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import type { Festival } from "../types/domain";
import { repository } from "../repositories";
import {
  loadFestivalListCache,
  loadLastFestivalSlug,
  saveFestivalListCache,
} from "../lib/storage";

/**
 * 祭りモードに入るときの祭り選び。
 * 通常モードは祭りに紐づかないので、祭りを決めるのはここだけになる。
 * 開催中が1つだけなら選ばせずにそのまま入る。
 */
export default function FestivalSelectPage() {
  // まずキャッシュを表示し、裏で最新一覧を取得する(オフラインでも選べる)
  const [festivals, setFestivals] = useState<Festival[]>(() =>
    loadFestivalListCache(),
  );
  const [loading, setLoading] = useState(festivals.length === 0);

  useEffect(() => {
    let cancelled = false;
    void repository
      .listFestivals()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setFestivals(list);
        saveFestivalListCache(list);
      })
      .catch(() => {
        // 取得失敗(オフライン等)はキャッシュのまま
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 前に見ていた祭りを先頭に出す(当日は同じ祭りを何度も開くため)
  const last = loadLastFestivalSlug();
  const byLastUsed = (a: Festival, b: Festival) =>
    Number(b.slug === last) - Number(a.slug === last);
  const active = festivals.filter((f) => f.isActive).sort(byLastUsed);
  const past = festivals.filter((f) => !f.isActive).sort(byLastUsed);

  // 開催中が1つだけなら選ぶ意味が無いので素通しする。
  // replace で置き換えるので、祭りホームからの「戻る」は通常モードに戻る
  if (active.length === 1) {
    return <Navigate to={`/f/${active[0].slug}`} replace />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100 px-4 py-6">
      <h1 className="text-xl font-bold text-slate-800">どの祭りを見ますか</h1>
      <p className="mt-1 text-sm text-slate-500">
        祭りモードでは、選んだ祭りの当日の予定・マップ・お知らせを表示します。
      </p>

      {loading && festivals.length === 0 && (
        <p className="py-8 text-center text-slate-500">読み込み中…</p>
      )}

      {!loading && festivals.length === 0 && (
        <p className="mt-4 rounded-xl bg-white p-4 text-slate-600">
          祭りが登録されていません。
        </p>
      )}

      {active.length > 0 && (
        <section className="mt-4 space-y-2">
          <h2 className="text-xs font-bold text-slate-500">開催中の祭り</h2>
          {active.map((f) => (
            <Link
              key={f.id}
              to={`/f/${f.slug}`}
              className="block rounded-2xl bg-white p-4 text-base font-bold text-slate-900 shadow-sm"
            >
              {f.name}
            </Link>
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-xs font-bold text-slate-500">過去の祭り</h2>
          {past.map((f) => (
            <Link
              key={f.id}
              to={`/f/${f.slug}`}
              className="block rounded-2xl bg-white p-4 text-sm font-medium text-slate-600 shadow-sm"
            >
              {f.name}
            </Link>
          ))}
        </section>
      )}

      <Link
        to="/"
        className="mt-8 text-center text-sm font-bold text-slate-500"
      >
        通常モードに戻る
      </Link>
    </div>
  );
}
