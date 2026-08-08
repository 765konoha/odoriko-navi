import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadAckedIds,
  loadReadIds,
  saveAckedIds,
  saveReadIds,
} from "../lib/storage";

interface ReadStatusState {
  /** 既読にしたお知らせID */
  readIds: ReadonlySet<string>;
  /** 「確認しました」を押した緊急連絡ID */
  ackedIds: ReadonlySet<string>;
  markRead: (id: string) => void;
  /** 緊急連絡の確認。既読にもする。 */
  markAcked: (id: string) => void;
}

const ReadStatusContext = createContext<ReadStatusState | null>(null);

export function ReadStatusProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(loadReadIds(slug)),
  );
  const [ackedIds, setAckedIds] = useState<Set<string>>(
    () => new Set(loadAckedIds(slug)),
  );

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        saveReadIds(slug, [...next]);
        return next;
      });
    },
    [slug],
  );

  const markAcked = useCallback(
    (id: string) => {
      setAckedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        saveAckedIds(slug, [...next]);
        return next;
      });
      markRead(id);
    },
    [slug, markRead],
  );

  const value = useMemo(
    () => ({ readIds, ackedIds, markRead, markAcked }),
    [readIds, ackedIds, markRead, markAcked],
  );

  return (
    <ReadStatusContext.Provider value={value}>
      {children}
    </ReadStatusContext.Provider>
  );
}

export function useReadStatus(): ReadStatusState {
  const ctx = useContext(ReadStatusContext);
  if (!ctx) {
    throw new Error("useReadStatus must be used within ReadStatusProvider");
  }
  return ctx;
}
