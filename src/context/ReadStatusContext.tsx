import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useEffect } from "react";
import {
  loadAckedIds,
  loadReadIds,
  saveAckedIds,
  saveReadIds,
  type UserKey,
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
  userKey,
  children,
}: {
  slug: string;
  /** 既読状態は利用者(シリアル)単位で分離する */
  userKey: UserKey;
  children: ReactNode;
}) {
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(loadReadIds(slug, userKey)),
  );
  const [ackedIds, setAckedIds] = useState<Set<string>>(
    () => new Set(loadAckedIds(slug, userKey)),
  );

  // 利用者変更時は、その利用者の既読状態を読み直す
  useEffect(() => {
    setReadIds(new Set(loadReadIds(slug, userKey)));
    setAckedIds(new Set(loadAckedIds(slug, userKey)));
  }, [slug, userKey]);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        saveReadIds(slug, userKey, [...next]);
        return next;
      });
    },
    [slug, userKey],
  );

  const markAcked = useCallback(
    (id: string) => {
      setAckedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        saveAckedIds(slug, userKey, [...next]);
        return next;
      });
      markRead(id);
    },
    [slug, userKey, markRead],
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
