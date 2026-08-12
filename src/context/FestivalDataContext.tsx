import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import type { FestivalData } from "../types/domain";
import { repository } from "../repositories";
import { loadDataCache, saveDataCache } from "../lib/storage";

// タブ復帰などで連続発火した際の再取得間隔の下限
const MIN_REFRESH_INTERVAL_MS = 10_000;

interface FestivalDataState {
  data: FestivalData | null;
  loading: boolean;
  /** 手動・自動の再取得中(初回読み込みは loading) */
  refreshing: boolean;
  /** 最後にデータ取得に成功した時刻(キャッシュ表示中はその取得時刻) */
  lastUpdated: Date | null;
  /** 現在キャッシュ(前回取得分)を表示中か */
  isStale: boolean;
  /** 手動更新(強制再取得) */
  refresh: () => Promise<void>;
}

const FestivalDataContext = createContext<FestivalDataState | null>(null);

export function FestivalDataProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  // 起動時はまず端末内スナップショットを即表示し、裏で最新を取得する
  const [data, setData] = useState<FestivalData | null>(() => {
    return loadDataCache(slug)?.data ?? null;
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    const cached = loadDataCache(slug);
    return cached ? new Date(cached.fetchedAt) : null;
  });
  const [loading, setLoading] = useState(data == null);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(data != null);
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      const result = await repository.loadFestivalData(slug);
      setData(result);
      setLastUpdated(new Date());
      setIsStale(false);
      lastFetchRef.current = Date.now();
      if (result) saveDataCache(slug, result);
    } catch {
      // 取得失敗時(オフライン等)は前回のデータを保持したまま
      setIsStale(true);
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [slug]);

  // slug 変更時: キャッシュを反映してから取得
  useEffect(() => {
    const cached = loadDataCache(slug);
    setData(cached?.data ?? null);
    setLastUpdated(cached ? new Date(cached.fetchedAt) : null);
    setIsStale(cached != null);
    setLoading(cached == null);
    void doFetch();
  }, [doFetch, slug]);

  // タブ切替(画面遷移)時にも再取得する。アプリを開きっぱなしでも
  // 予定タブ等を開いたタイミングで最新化される(10秒間引き付き)。
  const location = useLocation();
  useEffect(() => {
    if (Date.now() - lastFetchRef.current < MIN_REFRESH_INTERVAL_MS) return;
    void doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 画面表示・アプリ復帰・オンライン復帰時の自動再取得(連続発火は間引く)
  useEffect(() => {
    const maybeRefresh = () => {
      if (Date.now() - lastFetchRef.current < MIN_REFRESH_INTERVAL_MS) return;
      void doFetch();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", maybeRefresh);
    window.addEventListener("online", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", maybeRefresh);
      window.removeEventListener("online", maybeRefresh);
    };
  }, [doFetch]);

  return (
    <FestivalDataContext.Provider
      value={{ data, loading, refreshing, lastUpdated, isStale, refresh: doFetch }}
    >
      {children}
    </FestivalDataContext.Provider>
  );
}

export function useFestivalData(): FestivalDataState {
  const ctx = useContext(FestivalDataContext);
  if (!ctx) {
    throw new Error("useFestivalData must be used within FestivalDataProvider");
  }
  return ctx;
}
