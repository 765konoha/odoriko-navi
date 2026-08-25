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
// 選択画面の開閉は履歴で管理するため useUserSelect(hooks)側に持たせている。

interface UserState {
  /** null = 未選択(初回)。serial=null は「番号指定なし」 */
  selection: UserSelection | null;
  /** 既読管理などのストレージキー用(シリアル or "anonymous") */
  userKey: UserKey;
  /** シリアル選択を確定する(null = 番号指定なし) */
  selectUser: (serial: string | null) => void;
}

const UserContext = createContext<UserState | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<UserSelection | null>(() =>
    loadUserSelection(),
  );

  const selectUser = useCallback((serial: string | null) => {
    const next: UserSelection = { serial };
    saveUserSelection(next);
    setSelection(next);
  }, []);

  const value = useMemo<UserState>(
    () => ({
      selection,
      userKey: selection?.serial ?? "anonymous",
      selectUser,
    }),
    [selection, selectUser],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserState {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
