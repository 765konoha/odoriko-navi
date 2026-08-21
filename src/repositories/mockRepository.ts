import type { FestivalRepository } from "./types";
import type { Festival, FestivalData } from "../types/domain";
import { kochi2026 } from "../data/mock/kochi2026";
import { harajuku2026 } from "../data/mock/harajuku2026";

const festivals: FestivalData[] = [kochi2026, harajuku2026];

export const mockRepository: FestivalRepository = {
  async loadFestivalData(slug: string): Promise<FestivalData | null> {
    return festivals.find((f) => f.festival.slug === slug) ?? null;
  },
  async listActiveFestivals(): Promise<Festival[]> {
    return festivals.map((f) => f.festival);
  },
  async listParticipantSerials(): Promise<string[]> {
    // マスターには祭りに不参加のシリアルも存在する("406" "s1321" は不参加テスト用)
    const master = new Set<string>(["406", "s1321"]);
    for (const f of festivals) {
      for (const p of f.participants) master.add(p.serial);
    }
    return [...master].sort((a, b) =>
      a.localeCompare(b, "ja", { numeric: true }),
    );
  },
};
