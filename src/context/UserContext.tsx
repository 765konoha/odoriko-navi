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
import { normalizeSerial } from "../lib/serial";

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
  /** 端末に保存されている選択(選んだときの表記のまま) */
  const [stored, setStored] = useState<UserSelection | null>(() =>
    loadUserSelection(),
  );

  const selectUser = useCallback((serial: string | null) => {
    const next: UserSelection = { serial };
    saveUserSelection(next);
    setStored(next);
  }, []);

  const value = useMemo<UserState>(
    () => ({
      // 名簿との照合には表記をそろえたシリアルを使う。
      // 名簿に全角(Ｋ－０１５)で登録されていた頃に選んだ端末は、
      // 全角のまま保存されているため
      selection:
        stored && {
          serial: stored.serial == null ? null : normalizeSerial(stored.serial),
        },
      // 既読・確認済みの保存先は、選んだときの表記のままにする
      // (キーが変わると、その端末の既読が消えたように見えるため)
      userKey: stored?.serial ?? "anonymous",
      selectUser,
    }),
    [stored, selectUser],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserState {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
