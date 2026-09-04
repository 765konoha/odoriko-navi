import { Navigate, useLocation, useParams } from "react-router-dom";
import { loadAppMode } from "../lib/storage";

/**
 * 旧URL(/:festivalSlug/...)からの引き取り。
 *
 * 通常モードの画面は祭りに紐づかなくなり、祭りモードは /f/ の下へ移した。
 * ホーム画面に追加済みのPWAやLINEで配ったリンクが切れないよう、
 * 対応する新しいURLへ送る。
 */
export default function LegacyDancerRedirect() {
  const params = useParams();
  const { search } = useLocation();
  const slug = params.festivalSlug ?? "";
  const rest = params["*"] ?? "";
  // 地図の ?loc= / ?route= は行き先そのものなので落とさない

  // 祭りに紐づかなくなった画面
  if (rest.startsWith("rehearsal")) return <Navigate to="/rehearsal" replace />;
  if (rest.startsWith("props")) return <Navigate to="/props" replace />;

  // 祭りのホーム。以前どちらのモードで使っていたかで行き先を分ける
  if (rest === "") {
    return loadAppMode() === "normal" ? (
      <Navigate to="/" replace />
    ) : (
      <Navigate to={`/f/${slug}`} replace />
    );
  }

  // 予定・マップ・お知らせは祭りモードのまま
  return <Navigate to={`/f/${slug}/${rest}${search}`} replace />;
}
