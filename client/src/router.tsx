import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { SkeletonCards } from "./components/common/Skeleton";
import Dashboard from "./pages/Dashboard";

const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const Semesters = lazy(() => import("./pages/Semesters"));
const SemesterSubjects = lazy(() => import("./pages/Semesters").then((m) => ({ default: m.SemesterSubjects })));
const Subjects = lazy(() => import("./pages/Subjects"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const ResourceDetail = lazy(() => import("./pages/ResourceDetail"));
const Reader = lazy(() => import("./pages/Reader"));
const Search = lazy(() => import("./pages/Search"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Recent = lazy(() => import("./pages/Recent"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUpload = lazy(() => import("./pages/admin/AdminUpload"));
const AdminResources = lazy(() => import("./pages/admin/AdminResources"));
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
      { path: "resources/:resourceId", element: withSuspense(<ResourceDetail />) },
      { path: "reader/:resourceId", element: withSuspense(<Reader />) },
      { path: "search", element: withSuspense(<Search />) },
      { path: "favorites", element: withSuspense(<Favorites />) },
      { path: "bookmarks", element: withSuspense(<Bookmarks />) },
      { path: "downloads", element: withSuspense(<Downloads />) },
      { path: "recent", element: withSuspense(<Recent />) },
      { path: "settings", element: withSuspense(<Settings />) },
      { path: "admin", element: withSuspense(<AdminDashboard />) },
      { path: "admin/upload", element: withSuspense(<AdminUpload />) },
      { path: "admin/resources", element: withSuspense(<AdminResources />) },
      { path: "*", element: withSuspense(<NotFound />) },
    ],
  },
]);
