import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  GraduationCap,
  FileStack,
  Download,
  Bookmark,
  Bell,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";
import { useLibrary } from "../../state/LibraryProvider";
import { useUser } from "../../state/UserProvider";

interface MobileNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  end?: boolean;
}

/** Centralized mobile navigation configs — portal-aware, no duplicated route logic. */
const STUDENT_MOBILE_NAV: Omit<MobileNavItem, "badge">[] = [
  { to: "/dashboard", label: "Home", icon: Home, end: true },
  { to: "/semesters", label: "Semester", icon: GraduationCap },
  { to: "/resources", label: "Resources", icon: FileStack },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
];

const ADMIN_MOBILE_NAV: Omit<MobileNavItem, "badge">[] = [
  { to: "/admin", label: "Home", icon: Home, end: true },
  { to: "/admin/semesters", label: "Semester", icon: GraduationCap },
  { to: "/admin/resources", label: "Resources", icon: FileStack },
  { to: "/admin/notices", label: "Notice", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

/**
 * Portal-aware mobile bottom navigation.
 * - Student portal → Student routes (Home/Semester/Resources/Downloads/Saved)
 * - Admin portal (role ADMIN + /admin prefix) → Admin routes (Home/Semester/Resources/Notice/Settings)
 * Portal detection matches SidebarNav: role === "ADMIN" && pathname.startsWith("/admin")
 * Visual design preserved, active state isolated per portal.
 */
export function MobileNav() {
  const { downloads, bookmarks } = useLibrary();
  const { role } = useUser();
  const { pathname } = useLocation();

  const isAdminPortal = role === "ADMIN" && pathname.startsWith("/admin");

  const completedDownloads = downloads.filter((d) => d.status === "completed").length;

  // Build portal-specific items with dynamic badges (student only)
  const items: MobileNavItem[] = isAdminPortal
    ? ADMIN_MOBILE_NAV.map((it) => ({ ...it }))
    : STUDENT_MOBILE_NAV.map((it) => {
        if (it.to === "/downloads") return { ...it, badge: completedDownloads };
        if (it.to === "/bookmarks") return { ...it, badge: bookmarks.length };
        return { ...it, badge: 0 };
      });

  return (
    <nav
      aria-label={isAdminPortal ? "Admin mobile navigation" : "Student mobile navigation"}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon, badge = 0, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className="size-5" aria-hidden="true" />
                  {badge > 0 && (
                    <span
                      aria-label={`${badge} ${label}`}
                      className="absolute -right-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                    >
                      {badge}
                    </span>
                  )}
                </span>
                <span>{label}</span>
                <span
                  aria-hidden="true"
                  className={cx("h-0.5 w-6 rounded-full", isActive ? "bg-primary" : "bg-transparent")}
                />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
