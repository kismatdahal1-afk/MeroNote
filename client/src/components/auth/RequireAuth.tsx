import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "../../state/UserProvider";
import { DashboardSkeleton } from "../skeletons/pages";

/**
 * Phase 3 route guards. Server session is the authority:
 * - RequireAuth: guests → /login (remembers where they were headed).
 * - RequireAdmin: non-admin authed users → /dashboard (USER portal).
 * Admin CMS pages additionally need server-side enforcement (already in
 * the API via requireAdmin) — these guards are navigation UX only.
 */

function loginTarget(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname)}`;
}

export function RequireAuth({ children }: { children: ReactElement }) {
  const { status } = useUser();
  const location = useLocation();

  if (status === "loading") return <DashboardSkeleton />;
  if (status === "guest") return <Navigate to={loginTarget(location.pathname)} replace />;
  return children;
}

export function RequireAdmin({ children }: { children: ReactElement }) {
  const { status, role } = useUser();
  const location = useLocation();

  if (status === "loading") return <DashboardSkeleton />;
  if (status === "guest") return <Navigate to={loginTarget(location.pathname)} replace />;
  if (role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return children;
}
