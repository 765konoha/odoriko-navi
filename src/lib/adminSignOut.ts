// ログアウトの手順(成功したときだけ管理画面のキャッシュを消す)。
//
// 消してよいのは「確かにログアウトできた」ときだけ。
// エラーが返ったときも、通信エラー等で例外になったときも、
// ログイン状態のままなのでキャッシュは残す。
// 例外はここで受け止め、呼び出し側へは必ず戻り値で伝える
// (未処理の Promise にしない)。

export interface SignOutDeps {
  /** Supabase のサインアウト。error を返すか、例外を投げることがある */
  signOut: () => Promise<{ error: { message: string } | null }>;
  /** 管理画面のキャッシュ削除 */
  clearCache: () => void;
}

export async function runSignOut({
  signOut,
  clearCache,
}: SignOutDeps): Promise<{ error: string | null }> {
  try {
    const { error } = await signOut();
    if (error) return { error: error.message };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "ログアウトに失敗しました",
    };
  }
  clearCache();
  return { error: null };
}
