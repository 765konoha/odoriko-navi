import type { Festival, FestivalData } from "../types/domain";

// データ取得層のインターフェース。
// Phase 2〜3 は mockRepository、Phase 4 で supabaseRepository に差し替える。
export interface FestivalRepository {
  /** slug に対応する祭りの全データを取得する。存在しなければ null。 */
  loadFestivalData(slug: string): Promise<FestivalData | null>;
  /** 公開中(is_active)の祭り一覧。ヘッダーの祭り切替プルダウンに使う。 */
  listActiveFestivals(): Promise<Festival[]>;
}
