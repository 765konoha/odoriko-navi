import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Festival } from "../types/domain";
import { listFestivals } from "../lib/adminApi";

const STORAGE_KEY = "odoriko:admin:festivalId";

interface AdminFestivalState {
  festivals: Festival[];
  festival: Festival | null;
  loading: boolean;
  selectFestival: (id: string) => void;
  /** 祭りの追加・編集後に一覧を再読込する */
  reload: () => Promise<void>;
}

const AdminFestivalContext = createContext<AdminFestivalState | null>(null);

export function AdminFestivalProvider({ children }: { children: ReactNode }) {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setFestivals(await listFestivals());
  }, []);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  const festival =
    festivals.find((f) => f.id === selectedId) ?? festivals[0] ?? null;

  const value = useMemo<AdminFestivalState>(
    () => ({
      festivals,
      festival,
      loading,
      selectFestival(id) {
        setSelectedId(id);
        localStorage.setItem(STORAGE_KEY, id);
      },
      reload,
    }),
    [festivals, festival, loading, reload],
  );

  return (
    <AdminFestivalContext.Provider value={value}>
      {children}
    </AdminFestivalContext.Provider>
  );
}

export function useAdminFestival(): AdminFestivalState {
  const ctx = useContext(AdminFestivalContext);
  if (!ctx) {
    throw new Error(
      "useAdminFestival must be used within AdminFestivalProvider",
    );
  }
  return ctx;
}
