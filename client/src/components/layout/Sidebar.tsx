import { LayoutDashboard, BookMarked, GraduationCap, Heart, Bookmark, Download, FileStack, Settings, Bell, ListTree, FileEdit, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cx } from "../../lib/utils";
import { useUser } from "../../state/UserProvider";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/semesters", label: "Semesters", icon: GraduationCap },
  { to: "/subjects", label: "Subjects", icon: BookMarked },
  { to: "/resources", label: "Resources", icon: FileStack },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/notices", label: "Notices", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Admin CMS sidebar — shown while browsing /admin (admins only). */
const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/notices", label: "Notices", icon: Bell },
  { to: "/admin/semesters", label: "Semesters", icon: GraduationCap },
  { to: "/admin/subjects", label: "Subjects", icon: BookMarked },
  { to: "/admin/topics", label: "Topics", icon: ListTree },
  { to: "/admin/resources", label: "Resources", icon: FileStack },
  { to: "/admin/drafts", label: "Drafts", icon: FileEdit },
  { to: "/admin/trash", label: "Trash", icon: Trash2 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function SidebarNavItem({
  item,
  onClick,
  activeOverride,
}: {
  item: NavItem;
  onClick?: () => void;
  /** When set, this item is highlighted instead of the URL-matched one
   *  (shared Admin detail page opened via Topics highlights Topics). */
  activeOverride?: string;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          (activeOverride ? item.to === activeOverride : isActive)
            ? "bg-primary-muted font-semibold text-primary"
            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
        )
      }
    >
      <item.icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useUser();
  const { pathname, state } = useLocation();
  const inAdmin = role === "ADMIN" && pathname.startsWith("/admin");
  const items = inAdmin ? ADMIN_NAV : PRIMARY_NAV;
  /** Shared Admin pages (detail /admin/resources/:id, reader
   *  /admin/reader/:id) opened from Admin → Topics carry via:"topics" in
   *  history state — keep Topics highlighted through the whole flow,
   *  including while the PDF reader is open. */
  const activeOverride =
    inAdmin &&
    (pathname.startsWith("/admin/resources/") || pathname.startsWith("/admin/reader/")) &&
    (state as { via?: string } | null)?.via === "topics"
      ? "/admin/topics"
      : undefined;

  return (
    <nav aria-label={inAdmin ? "Admin navigation" : "Main navigation"} className="flex flex-col gap-1">
      {items.map((item) => (
        <SidebarNavItem key={item.to} item={item} onClick={onNavigate} activeOverride={activeOverride} />
      ))}
      {inAdmin ? (
        <>
          <div className="my-3 border-t border-border" />
          <NavLink
            to="/dashboard"
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isActive
                  ? "bg-primary-muted font-semibold text-primary"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )
            }
          >
            <LayoutDashboard className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">Back to Student View</span>
          </NavLink>
        </>
      ) : (
        role === "ADMIN" && (
          <>
            <div className="my-3 border-t border-border" />
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Admin
            </p>
            <SidebarNavItem item={{ to: "/admin", label: "Admin CMS", icon: Settings }} onClick={onNavigate} />
          </>
        )
      )}
    </nav>
  );
}
