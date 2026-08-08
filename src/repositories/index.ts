import type { FestivalRepository } from "./types";
import { mockRepository } from "./mockRepository";
import { supabaseRepository } from "./supabaseRepository";
import { supabase } from "../lib/supabase";

// Supabase の接続情報(環境変数)があれば Supabase、なければ mock データで動作する。
export const repository: FestivalRepository = supabase
  ? supabaseRepository
  : mockRepository;
