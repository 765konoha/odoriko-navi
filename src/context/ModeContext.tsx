import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadAppMode, saveAppMode, type AppMode } from "../lib/storage";

// 通常モード / 祭りモード。
// データを分離する概念ではなく、何を優先して見せるか(ナビ・ホーム)を切り替える。

interface ModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeState | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => loadAppMode());

  const setMode = useCallback((next: AppMode) => {
    saveAppMode(next);
    setModeState(next);
  }, []);

  const value = useMemo<ModeState>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode(mode === "normal" ? "festival" : "normal"),
    }),
    [mode, setMode],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeState {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
