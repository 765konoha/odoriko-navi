import { createHashRouter, Navigate } from "react-router-dom";
import { DEFAULT_FESTIVAL_SLUG } from "./config";
import DancerLayout from "./components/layout/DancerLayout";
import HomePage from "./pages/dancer/HomePage";
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

export const router = createHashRouter([
  {
    path: "/",
    element: <Navigate to={`/${DEFAULT_FESTIVAL_SLUG}`} replace />,
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
    ],
  },
  {
    path: "/:festivalSlug",
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
    ],
  },
  {
    path: "*",
    element: <Navigate to={`/${DEFAULT_FESTIVAL_SLUG}`} replace />,
  },
]);
