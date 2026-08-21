import { useMemo } from "react";
import { useFestivalData } from "../context/FestivalDataContext";
import { useUser } from "../context/UserContext";
import { resolveViewer, type Viewer } from "../lib/audience";

/** 現在の利用者(シリアル選択)を祭りデータに照らして解決する */
export function useViewer(): Viewer {
  const { data } = useFestivalData();
  const { selection } = useUser();
  return useMemo<Viewer>(() => {
    if (!data) {
      // データ読み込み前(ページ側は data 有無でガード済み)
      return {
        participant: null,
        roleIds: [],
        notParticipating: false,
        serial: selection?.serial ?? null,
      };
    }
    return resolveViewer(data, selection);
  }, [data, selection]);
}
