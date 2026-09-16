import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { SkeletonCards } from "./components/common/Skeleton";
import {
  BookmarksSkeleton,
  DashboardSkeleton,
  DownloadsSkeleton,
  FavoritesSkeleton,
  NoticesSkeleton,
  ReaderSkeleton,
  ResourceDetailSkeleton,
  ResourcesSkeleton,
  SemesterSubjectsSkeleton,
  SemestersSkeleton,
  SettingsSkeleton,
  SubjectDetailSkeleton,
} from "./components/skeletons/pages";
import {
  AdminDashboardSkeleton,
  AdminDraftsSkeleton,
  AdminNoticesSkeleton,
  AdminResourceDetailSkeleton,
  AdminResourcesSkeleton,
  AdminSemestersSkeleton,
  AdminSettingsSkeleton,
  AdminTrashSkeleton,
} from "./components/skeletons/admin";

const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Semesters = lazy(() => import("./pages/Semesters"));
const SemesterSubjects = lazy(() => import("./pages/Semesters").then((m) => ({ default: m.SemesterSubjects })));
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
const AdminResources = lazy(() => import("./pages/admin/AdminResources"));
const AdminReader = lazy(() => import("./pages/admin/AdminReader"));
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

function withSuspense(node: ReactNode, fallback?: ReactNode) {
  return <Suspense fallback={fallback ?? <PageFallback />}>{node}</Suspense>;
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
          { path: "dashboard", element: withSuspense(<Dashboard />, <DashboardSkeleton />) },
          { path: "semesters", element: withSuspense(<Semesters />, <SemestersSkeleton />) },
          { path: "semesters/:semesterId", element: withSuspense(<SemesterSubjects />, <SemesterSubjectsSkeleton />) },
          { path: "subjects/:subjectId", element: withSuspense(<SubjectDetail />, <SubjectDetailSkeleton />) },
          { path: "resources", element: withSuspense(<Resources />, <ResourcesSkeleton />) },
          { path: "resources/:resourceId", element: withSuspense(<ResourceDetail />, <ResourceDetailSkeleton />) },
          { path: "reader/:resourceId", element: withSuspense(<Reader />, <ReaderSkeleton />) },
          { path: "favorites", element: withSuspense(<Favorites />, <FavoritesSkeleton />) },
          { path: "bookmarks", element: withSuspense(<Bookmarks />, <BookmarksSkeleton />) },
          { path: "downloads", element: withSuspense(<Downloads />, <DownloadsSkeleton />) },
          { path: "notices", element: withSuspense(<Notices />, <NoticesSkeleton />) },
          { path: "settings", element: withSuspense(<Settings />, <SettingsSkeleton />) },
          { path: "help", element: withSuspense(<HelpSupport />) },
          // Admin CMS
          { path: "admin", element: withSuspense(<AdminDashboard />, <AdminDashboardSkeleton />) },
          { path: "admin/notices", element: withSuspense(<AdminNotices />, <AdminNoticesSkeleton />) },
          { path: "admin/semesters", element: withSuspense(<AdminSemesters />, <AdminSemestersSkeleton />) },
          { path: "admin/resources", element: withSuspense(<AdminResources />, <AdminResourcesSkeleton />) },
          { path: "admin/resources/:resourceId", element: withSuspense(<ResourceDetail />, <AdminResourceDetailSkeleton />) },
          { path: "admin/reader/:resourceId", element: withSuspense(<AdminReader />, <ReaderSkeleton />) },
          { path: "admin/drafts", element: withSuspense(<AdminDrafts />, <AdminDraftsSkeleton />) },
          { path: "admin/trash", element: withSuspense(<AdminTrash />, <AdminTrashSkeleton />) },
          { path: "admin/settings", element: withSuspense(<AdminSettings />, <AdminSettingsSkeleton />) },
          { path: "*", element: withSuspense(<NotFound />) },
        ],
      },
    ],
  },
]);
