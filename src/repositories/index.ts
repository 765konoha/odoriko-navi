import type { FestivalRepository } from "./types";
import { mockRepository } from "./mockRepository";

// Phase 4 で supabaseRepository に差し替える(UI 側は変更しない)。
export const repository: FestivalRepository = mockRepository;
