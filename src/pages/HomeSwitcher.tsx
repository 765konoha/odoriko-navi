import { useMode } from "../context/ModeContext";
import HomePage from "./dancer/HomePage";
import NormalHomePage from "./normal/NormalHomePage";

/** 選択中のモードに応じてホーム画面を切り替える */
export default function HomeSwitcher() {
  const { mode } = useMode();
  return mode === "normal" ? <NormalHomePage /> : <HomePage />;
}
