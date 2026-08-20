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
};
