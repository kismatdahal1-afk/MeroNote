import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { RequireAdmin, RequireAuth } from "./components/auth/RequireAuth";
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

const LandingPage = lazy(() => import("./pages/landing/LandingPage"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Semesters = lazy(() => import("./pages/Semesters"));
const SemesterSubjects = lazy(() => import("./pages/Semesters").then((m) => ({ default: m.SemesterSubjects })));
const Resources = lazy(() => import("./pages/Resources"));
const Search = lazy(() => import("./pages/Search"));
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

/**
 * Route table, exported for verification (see publicEntry tests).
 *
 * Entry design:
 * - "/" is a PUBLIC parent whose index child is the browser-only
 *   LandingPage. It must outrank every authenticated branch for "/",
 *   so the protected layout is pathless and carries NO index route —
 *   the old duplicate-`path: "/"` layout + index redirect outranked the
 *   public route and sent every "/" visit to Login via RequireAuth.
 * - LandingPage itself redirects authed users (role-aware) and genuine
 *   standalone PWA windows into the app; guests in browser tabs always
 *   see the landing, including on refresh (no redirect while guest).
 * - PWA entry is unchanged: manifest start_url is "/dashboard", which
 *   stays behind RequireAuth (Login when unauthenticated).
 */
export const appRoutes: RouteObject[] = [
  // Every page opens at the top of the viewport on navigation.
  {
    element: <ScrollToTop />,
    children: [
      {
        path: "/",
        children: [
          { index: true, element: withSuspense(<LandingPage />) },
          { path: "login", element: withSuspense(<Login />) },
          { path: "register", element: withSuspense(<Register />) },
          {
            element: (
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            ),
            children: [
              { path: "dashboard", element: withSuspense(<Dashboard />, <DashboardSkeleton />) },
          { path: "semesters", element: withSuspense(<Semesters />, <SemestersSkeleton />) },
          { path: "semesters/:semesterId", element: withSuspense(<SemesterSubjects />, <SemesterSubjectsSkeleton />) },
          { path: "subjects/:subjectId", element: withSuspense(<SubjectDetail />, <SubjectDetailSkeleton />) },
          { path: "resources", element: withSuspense(<Resources />, <ResourcesSkeleton />) },
          { path: "search", element: withSuspense(<Search />, <ResourcesSkeleton />) },
          { path: "resources/:resourceId", element: withSuspense(<ResourceDetail />, <ResourceDetailSkeleton />) },
          { path: "reader/:resourceId", element: withSuspense(<Reader />, <ReaderSkeleton />) },
          { path: "favorites", element: withSuspense(<Favorites />, <FavoritesSkeleton />) },
          { path: "bookmarks", element: withSuspense(<Bookmarks />, <BookmarksSkeleton />) },
          { path: "downloads", element: withSuspense(<Downloads />, <DownloadsSkeleton />) },
          { path: "notices", element: withSuspense(<Notices />, <NoticesSkeleton />) },
          { path: "settings", element: withSuspense(<Settings />, <SettingsSkeleton />) },
          { path: "help", element: withSuspense(<HelpSupport />) },
          // Admin CMS (ADMIN role only — server enforces via requireAdmin)
          { path: "admin", element: withSuspense(<RequireAdmin><AdminDashboard /></RequireAdmin>, <AdminDashboardSkeleton />) },
          { path: "admin/notices", element: withSuspense(<RequireAdmin><AdminNotices /></RequireAdmin>, <AdminNoticesSkeleton />) },
          { path: "admin/semesters", element: withSuspense(<RequireAdmin><AdminSemesters /></RequireAdmin>, <AdminSemestersSkeleton />) },
          { path: "admin/resources", element: withSuspense(<RequireAdmin><AdminResources /></RequireAdmin>, <AdminResourcesSkeleton />) },
          { path: "admin/resources/:resourceId", element: withSuspense(<RequireAdmin><ResourceDetail /></RequireAdmin>, <AdminResourceDetailSkeleton />) },
          { path: "admin/reader/:resourceId", element: withSuspense(<RequireAdmin><AdminReader /></RequireAdmin>, <ReaderSkeleton />) },
          { path: "admin/drafts", element: withSuspense(<RequireAdmin><AdminDrafts /></RequireAdmin>, <AdminDraftsSkeleton />) },
          { path: "admin/trash", element: withSuspense(<RequireAdmin><AdminTrash /></RequireAdmin>, <AdminTrashSkeleton />) },
          { path: "admin/settings", element: withSuspense(<RequireAdmin><AdminSettings /></RequireAdmin>, <AdminSettingsSkeleton />) },
          { path: "*", element: withSuspense(<NotFound />) },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
