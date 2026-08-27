import { Navigate } from "react-router-dom";
import { loadAdminFestivalSlug } from "../../lib/adminCache";

/**
 * 旧URL(/admin/schedule など)の互換。
 * 最後に開いた祭りのワークスペースへ送り、無ければ祭り一覧へ。
 */
export default function LegacyAdminRedirect({ sub }: { sub: string }) {
  const slug = loadAdminFestivalSlug();
  const to = slug ? `/admin/f/${slug}${sub ? `/${sub}` : ""}` : "/admin";
  return <Navigate to={to} replace />;
}
