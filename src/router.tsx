import { createHashRouter, Navigate } from "react-router-dom";
import { DEFAULT_FESTIVAL_SLUG } from "./config";
import { loadLastFestivalSlug } from "./lib/storage";
import DancerLayout from "./components/layout/DancerLayout";
import SchedulePage from "./pages/dancer/SchedulePage";
import MapPage from "./pages/dancer/MapPage";
import AnnouncementsPage from "./pages/dancer/AnnouncementsPage";
import AnnouncementDetailPage from "./pages/dancer/AnnouncementDetailPage";
import AdminLayout from "./components/layout/AdminLayout";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import ScheduleAdminPage from "./pages/admin/ScheduleAdminPage";
import LocationAdminPage from "./pages/admin/LocationAdminPage";
import AnnouncementAdminPage from "./pages/admin/AnnouncementAdminPage";
import FestivalAdminPage from "./pages/admin/FestivalAdminPage";
import ParticipantAdminPage from "./pages/admin/ParticipantAdminPage";
import BaggageAdminPage from "./pages/admin/BaggageAdminPage";
import PropsAdminPage from "./pages/admin/props/PropsAdminPage";
import HomeSwitcher from "./pages/HomeSwitcher";
import RehearsalPage from "./pages/normal/RehearsalPage";
import PropsPage from "./pages/props/PropsPage";

// 最後に表示した祭りがあればそこへ(初回はデフォルトの祭りへ)
function RootRedirect() {
  const slug = loadLastFestivalSlug() ?? DEFAULT_FESTIVAL_SLUG;
  return <Navigate to={`/${slug}`} replace />;
}

export const router = createHashRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  { path: "/admin/login", element: <AdminLoginPage /> },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "schedule", element: <ScheduleAdminPage /> },
      { path: "locations", element: <LocationAdminPage /> },
      { path: "announcements", element: <AnnouncementAdminPage /> },
      { path: "participants", element: <ParticipantAdminPage /> },
      { path: "baggage", element: <BaggageAdminPage /> },
      { path: "props", element: <PropsAdminPage /> },
      { path: "festivals", element: <FestivalAdminPage /> },
    ],
  },
  {
    path: "/:festivalSlug",
    element: <DancerLayout />,
    children: [
      // ホームは選択中のモード(通常/祭り)で切り替える
      { index: true, element: <HomeSwitcher /> },
      { path: "schedule", element: <SchedulePage /> },
      // 通常モードの画面(小道具は両モード共通)
      { path: "rehearsal", element: <RehearsalPage /> },
      { path: "props", element: <PropsPage /> },
      { path: "map", element: <MapPage /> },
      { path: "announcements", element: <AnnouncementsPage /> },
      {
        path: "announcements/:announcementId",
        element: <AnnouncementDetailPage />,
      },
    ],
  },
  {
    path: "*",
    element: <RootRedirect />,
  },
]);
