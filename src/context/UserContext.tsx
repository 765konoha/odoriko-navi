import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadUserSelection,
  saveUserSelection,
  type UserKey,
  type UserSelection,
} from "../lib/storage";

// 利用者(シリアル)の選択状態。
// 本人認証ではなく表示切替のための識別。パスワード等は使わない。

interface UserState {
  /** null = 未選択(初回)。serial=null は「番号指定なし」 */
  selection: UserSelection | null;
  /** 既読管理などのストレージキー用(シリアル or "anonymous") */
  userKey: UserKey;
  /** シリアル選択を確定する(null = 番号指定なし) */
  selectUser: (serial: string | null) => void;
  /** 「変更」ボタンで選択画面を再表示する */
  changeRequested: boolean;
  requestChange: () => void;
  cancelChange: () => void;
}

const UserContext = createContext<UserState | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<UserSelection | null>(() =>
    loadUserSelection(),
  );
  const [changeRequested, setChangeRequested] = useState(false);

  const selectUser = useCallback((serial: string | null) => {
    const next: UserSelection = { serial };
    saveUserSelection(next);
    setSelection(next);
    setChangeRequested(false);
  }, []);

  const value = useMemo<UserState>(
    () => ({
      selection,
      userKey: selection?.serial ?? "anonymous",
      selectUser,
      changeRequested,
      requestChange: () => setChangeRequested(true),
      cancelChange: () => setChangeRequested(false),
    }),
    [selection, selectUser, changeRequested],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserState {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
