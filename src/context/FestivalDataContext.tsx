import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FestivalData } from "../types/domain";
import { repository } from "../repositories";

// タブ復帰などで連続発火した際の再取得間隔の下限
const MIN_REFRESH_INTERVAL_MS = 10_000;

interface FestivalDataState {
  data: FestivalData | null;
  loading: boolean;
  /** 手動・自動の再取得中(初回読み込みは loading) */
  refreshing: boolean;
  /** 最後にデータ取得に成功した時刻 */
  lastUpdated: Date | null;
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
  const [data, setData] = useState<FestivalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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
      lastFetchRef.current = Date.now();
    } catch {
      // 取得失敗時は前回のデータを保持したまま(オフライン等)
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [slug]);

  // 初回読み込み
  useEffect(() => {
    setLoading(true);
    setData(null);
    void doFetch();
  }, [doFetch]);

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
      value={{ data, loading, refreshing, lastUpdated, refresh: doFetch }}
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
