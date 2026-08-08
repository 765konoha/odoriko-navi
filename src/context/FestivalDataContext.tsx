import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { FestivalData } from "../types/domain";
import { repository } from "../repositories";

interface FestivalDataState {
  data: FestivalData | null;
  loading: boolean;
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

  const refresh = useCallback(async () => {
    const result = await repository.loadFestivalData(slug);
    setData(result);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  return (
    <FestivalDataContext.Provider value={{ data, loading, refresh }}>
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
