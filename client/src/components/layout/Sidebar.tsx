import { LayoutDashboard, BookMarked, GraduationCap, Heart, Bookmark, Download, History, Settings, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cx } from "../../lib/utils";
import { useLibrary } from "../../state/LibraryProvider";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/semesters", label: "Semesters", icon: GraduationCap },
  { to: "/subjects", label: "Subjects", icon: BookMarked },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/recent", label: "Recent", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Admin", icon: ShieldCheck },
];

export function SidebarNavItem({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
          isActive
            ? "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
        )
      }
    >
      <item.icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {PRIMARY_NAV.map((item) => (
        <SidebarNavItem key={item.to} item={item} onClick={onNavigate} />
      ))}
      <div className="my-3 border-t border-slate-200 dark:border-slate-700/60" />
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Admin
      </p>
      {ADMIN_NAV.map((item) => (
        <SidebarNavItem key={item.to} item={item} onClick={onNavigate} />
      ))}
    </nav>
  );
}

export function SidebarBadge({ to, count }: { to: string; count: number }) {
  if (count === 0) return null;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium",
          isActive
            ? "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
        )
      }
    >
      <span>Downloads</span>
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        {count}
      </span>
    </NavLink>
  );
}

/** Small helper used by the drawer to show download count. */
export function useDownloadCount(): number {
  const { downloads } = useLibrary();
  return downloads.filter((d) => d.status === "completed").length;
}
