import type { FestivalRepository } from "./types";
import type { FestivalData } from "../types/domain";
import { kochi2026 } from "../data/mock/kochi2026";

const festivals: FestivalData[] = [kochi2026];

export const mockRepository: FestivalRepository = {
  async loadFestivalData(slug: string): Promise<FestivalData | null> {
    return festivals.find((f) => f.festival.slug === slug) ?? null;
  },
};
