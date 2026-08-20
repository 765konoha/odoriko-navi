import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Festival } from "../../types/domain";
import { repository } from "../../repositories";
import {
  loadFestivalListCache,
  saveFestivalListCache,
} from "../../lib/storage";
import { useFestivalData } from "../../context/FestivalDataContext";

/**
 * ヘッダーの祭り切替プルダウン。
 * 切替時は現在開いているタブ(予定・マップ等)を維持したまま slug だけ差し替える。
 */
export default function FestivalSwitcher({ slug }: { slug: string }) {
  const { data } = useFestivalData();
  const navigate = useNavigate();
  const location = useLocation();
  // まずキャッシュを表示し、裏で最新一覧を取得する(オフラインでも表示できる)
  const [festivals, setFestivals] = useState<Festival[]>(() =>
    loadFestivalListCache(),
  );

  useEffect(() => {
    let cancelled = false;
    void repository
      .listActiveFestivals()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setFestivals(list);
        saveFestivalListCache(list);
      })
      .catch(() => {
        // 取得失敗(オフライン等)はキャッシュのまま
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function switchTo(nextSlug: string) {
    if (nextSlug === slug) return;
    // /{slug}/announcements/{id} の id は祭り固有なので一覧まで戻す
    const rest = location.pathname
      .replace(new RegExp(`^/${slug}`), "")
      .replace(/^\/announcements\/.+$/, "/announcements");
    navigate(`/${nextSlug}${rest}`);
  }

  const currentName =
    festivals.find((f) => f.slug === slug)?.name ?? data?.festival.name ?? "";

  // 切替先がない場合は祭り名の表示のみ
  if (festivals.length <= 1) {
    return currentName ? (
      <span className="max-w-40 truncate text-sm font-bold text-slate-700">
        {currentName}
      </span>
    ) : null;
  }

  return (
    <label className="relative flex min-w-0 items-center">
      <span className="sr-only">祭りを切り替える</span>
      <select
        value={slug}
        onChange={(e) => switchTo(e.target.value)}
        className="max-w-44 appearance-none truncate rounded-lg border border-slate-300 bg-slate-50 py-1 pl-2 pr-7 text-sm font-bold text-slate-700"
      >
        {festivals.map((f) => (
          <option key={f.id} value={f.slug}>
            {f.name}
          </option>
        ))}
        {/* 一覧に無い slug を開いている場合も現在地を表示できるようにする */}
        {!festivals.some((f) => f.slug === slug) && (
          <option value={slug}>{currentName || slug}</option>
        )}
      </select>
      <svg
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
