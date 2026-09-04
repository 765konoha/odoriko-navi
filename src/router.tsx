import { createHashRouter, Navigate } from "react-router-dom";
import DancerLayout from "./components/layout/DancerLayout";
import SchedulePage from "./pages/dancer/SchedulePage";
import MapPage from "./pages/dancer/MapPage";
import AnnouncementsPage from "./pages/dancer/AnnouncementsPage";
import AnnouncementDetailPage from "./pages/dancer/AnnouncementDetailPage";
import AdminLayout from "./components/layout/AdminLayout";
import CrossFestivalShell from "./components/layout/CrossFestivalShell";
import WorkspaceShell from "./components/layout/WorkspaceShell";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import ScheduleAdminPage from "./pages/admin/ScheduleAdminPage";
import LocationAdminPage from "./pages/admin/LocationAdminPage";
import AnnouncementAdminPage from "./pages/admin/AnnouncementAdminPage";
import ParticipantAdminPage from "./pages/admin/ParticipantAdminPage";
import BaggageAdminPage from "./pages/admin/BaggageAdminPage";
import PropsAdminPage from "./pages/admin/props/PropsAdminPage";
import FestivalListPage from "./pages/admin/festival/FestivalListPage";
import RehearsalAdminPage from "./pages/admin/rehearsal/RehearsalAdminPage";
import FestivalSettingsPage from "./pages/admin/festival/FestivalSettingsPage";
import LegacyAdminRedirect from "./pages/admin/LegacyAdminRedirect";
import HomePage from "./pages/dancer/HomePage";
import NormalLayout from "./components/layout/NormalLayout";
import NormalHomePage from "./pages/normal/NormalHomePage";
import RehearsalPage from "./pages/normal/RehearsalPage";
import PropsPage from "./pages/props/PropsPage";
import FestivalSelectPage from "./pages/FestivalSelectPage";
import LegacyDancerRedirect from "./pages/LegacyDancerRedirect";

export const router = createHashRouter([
  // 通常モード(日常運用)。祭りには紐づかない
  {
    path: "/",
    element: <NormalLayout />,
    children: [
      { index: true, element: <NormalHomePage /> },
      { path: "rehearsal", element: <RehearsalPage /> },
      { path: "props", element: <PropsPage /> },
    ],
  },
  // 祭りモードに入るときだけ祭りを選ぶ
  { path: "/festivals", element: <FestivalSelectPage /> },
  { path: "/admin/login", element: <AdminLoginPage /> },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      // 祭りを選ばずに使う画面
      {
        element: <CrossFestivalShell />,
        children: [
          { index: true, element: <FestivalListPage /> },
          { path: "props", element: <PropsAdminPage /> },
        ],
      },
      // 祭りごとのワークスペース(操作対象は URL の slug で決まる)
      {
        path: "f/:festivalSlug",
        element: <WorkspaceShell />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: "schedule", element: <ScheduleAdminPage /> },
          { path: "rehearsals", element: <RehearsalAdminPage /> },
          { path: "locations", element: <LocationAdminPage /> },
          { path: "announcements", element: <AnnouncementAdminPage /> },
          { path: "participants", element: <ParticipantAdminPage /> },
          { path: "baggage", element: <BaggageAdminPage /> },
          { path: "settings", element: <FestivalSettingsPage /> },
        ],
      },
      // 旧URLの互換(ブックマークからの流入を拾う)
      { path: "schedule", element: <LegacyAdminRedirect sub="schedule" /> },
      { path: "locations", element: <LegacyAdminRedirect sub="locations" /> },
      {
        path: "announcements",
        element: <LegacyAdminRedirect sub="announcements" />,
      },
      {
        path: "participants",
        element: <LegacyAdminRedirect sub="participants" />,
      },
      { path: "baggage", element: <LegacyAdminRedirect sub="baggage" /> },
      { path: "festivals", element: <Navigate to="/admin" replace /> },
    ],
  },
  // 祭りモード(祭り当日)。操作対象は URL の slug で決まる
  {
    path: "/f/:festivalSlug",
    element: <DancerLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "schedule", element: <SchedulePage /> },
      { path: "map", element: <MapPage /> },
      { path: "announcements", element: <AnnouncementsPage /> },
      {
        path: "announcements/:announcementId",
        element: <AnnouncementDetailPage />,
      },
      // 小道具は祭りに紐づかないが、祭りモードのホームからも入れる
      { path: "props", element: <PropsPage /> },
    ],
  },
  // 旧URL(/:festivalSlug/...)の引き取り
  { path: "/:festivalSlug", element: <LegacyDancerRedirect /> },
  { path: "/:festivalSlug/*", element: <LegacyDancerRedirect /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
