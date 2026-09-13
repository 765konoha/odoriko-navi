import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { clearAdminCache } from "../lib/adminCache";
import { runSignOut } from "../lib/adminSignOut";

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** 成功したときだけ管理画面のキャッシュを消す。失敗は呼び出し側へ返す */
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      async signIn(email, password) {
        if (!supabase) return { error: "Supabaseが設定されていません" };
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { error: error ? error.message : null };
      },
      async signOut() {
        // 消してよいのは確かにログアウトできたときだけ。
        // 消すのは管理画面の下書き・一覧キャッシュで、
        // 踊り子側の既読・利用者選択・祭りのスナップショットは残す
        return runSignOut({
          signOut: async () =>
            supabase ? await supabase.auth.signOut() : { error: null },
          clearCache: clearAdminCache,
        });
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
