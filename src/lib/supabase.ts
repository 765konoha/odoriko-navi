import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** 環境変数が未設定の場合は null(mock データで動作させる) */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
