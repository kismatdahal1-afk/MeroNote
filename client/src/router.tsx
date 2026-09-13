import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { SkeletonCards } from "./components/common/Skeleton";
import Dashboard from "./pages/Dashboard";

const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const Semesters = lazy(() => import("./pages/Semesters"));
const SemesterSubjects = lazy(() => import("./pages/Semesters").then((m) => ({ default: m.SemesterSubjects })));
const Subjects = lazy(() => import("./pages/Subjects"));
const Resources = lazy(() => import("./pages/Resources"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const ResourceDetail = lazy(() => import("./pages/ResourceDetail"));
const Reader = lazy(() => import("./pages/Reader"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Notices = lazy(() => import("./pages/Notices"));
const Settings = lazy(() => import("./pages/Settings"));
const HelpSupport = lazy(() => import("./pages/HelpSupport"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminNotices = lazy(() => import("./pages/admin/AdminNotices"));
const AdminSemesters = lazy(() => import("./pages/admin/AdminSemesters"));
const AdminSubjects = lazy(() => import("./pages/admin/AdminSubjects"));
const AdminTopics = lazy(() => import("./pages/admin/AdminTopics"));
const AdminBooks = lazy(() => import("./pages/admin/AdminBooks"));
const AdminResources = lazy(() => import("./pages/admin/AdminResources"));
const AdminFeatured = lazy(() => import("./pages/admin/AdminFeatured"));
const AdminDrafts = lazy(() => import("./pages/admin/AdminDrafts"));
const AdminTrash = lazy(() => import("./pages/admin/AdminTrash"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageFallback() {
  return (
    <div>
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
      <SkeletonCards />
    </div>
  );
}

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  // Every page opens at the top of the viewport on navigation.
  {
    element: <ScrollToTop />,
    children: [
      { path: "/", element: withSuspense(<Welcome />) },
      { path: "/login", element: withSuspense(<Login />) },
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <Dashboard /> },
          { path: "semesters", element: withSuspense(<Semesters />) },
          { path: "semesters/:semesterId", element: withSuspense(<SemesterSubjects />) },
          { path: "subjects", element: withSuspense(<Subjects />) },
          { path: "subjects/:subjectId", element: withSuspense(<SubjectDetail />) },
          { path: "resources", element: withSuspense(<Resources />) },
          { path: "resources/:resourceId", element: withSuspense(<ResourceDetail />) },
          { path: "reader/:resourceId", element: withSuspense(<Reader />) },
          { path: "favorites", element: withSuspense(<Favorites />) },
          { path: "bookmarks", element: withSuspense(<Bookmarks />) },
          { path: "downloads", element: withSuspense(<Downloads />) },
          { path: "notices", element: withSuspense(<Notices />) },
          { path: "settings", element: withSuspense(<Settings />) },
          { path: "help", element: withSuspense(<HelpSupport />) },
          // Admin CMS
          { path: "admin", element: withSuspense(<AdminDashboard />) },
          { path: "admin/notices", element: withSuspense(<AdminNotices />) },
          { path: "admin/semesters", element: withSuspense(<AdminSemesters />) },
          { path: "admin/subjects", element: withSuspense(<AdminSubjects />) },
          { path: "admin/topics", element: withSuspense(<AdminTopics />) },
          { path: "admin/books", element: withSuspense(<AdminBooks />) },
          { path: "admin/resources", element: withSuspense(<AdminResources />) },
          { path: "admin/featured", element: withSuspense(<AdminFeatured />) },
          { path: "admin/drafts", element: withSuspense(<AdminDrafts />) },
          { path: "admin/trash", element: withSuspense(<AdminTrash />) },
          { path: "admin/settings", element: withSuspense(<AdminSettings />) },
          { path: "*", element: withSuspense(<NotFound />) },
        ],
      },
    ],
  },
]);
