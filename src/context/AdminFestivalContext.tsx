import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import type { Festival } from "../types/domain";
import { listFestivals } from "../lib/adminApi";
import {
  loadAdminFestivalsCache,
  saveAdminFestivalsCache,
} from "../lib/adminCache";

// 操作対象の祭りは URL(/admin/f/{slug}/...)で決まる。
// 端末に保存した選択状態には依存しないので、ブックマークや共有でも同じ画面が開く。
const WORKSPACE_PATH = /^\/admin\/f\/([^/]+)/;

interface AdminFestivalState {
  /** 登録されているすべての祭り(終了したものを含む) */
  festivals: Festival[];
  /** いま開いている祭り。祭りワークスペースの外では null */
  festival: Festival | null;
  loading: boolean;
  /** 祭りの追加・編集後に一覧を再読込する */
  reload: () => Promise<void>;
}

const AdminFestivalContext = createContext<AdminFestivalState | null>(null);

export function AdminFestivalProvider({ children }: { children: ReactNode }) {
  // 前回取得分を即表示し、裏で最新を取得する(初回のみ読み込み待ち)
  const [festivals, setFestivals] = useState<Festival[]>(() =>
    loadAdminFestivalsCache(),
  );
  const [loading, setLoading] = useState<boolean>(
    () => loadAdminFestivalsCache().length === 0,
  );
  const { pathname } = useLocation();

  const reload = useCallback(async () => {
    const list = await listFestivals();
    setFestivals(list);
    saveAdminFestivalsCache(list);
  }, []);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  const slug = WORKSPACE_PATH.exec(pathname)?.[1] ?? null;
  const festival = slug
    ? (festivals.find((f) => f.slug === slug) ?? null)
    : null;

  const value = useMemo<AdminFestivalState>(
    () => ({ festivals, festival, loading, reload }),
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
