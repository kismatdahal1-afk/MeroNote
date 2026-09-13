import { LayoutDashboard, BookMarked, GraduationCap, Heart, Bookmark, Download, History, Settings, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cx } from "../../lib/utils";

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
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          isActive
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
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {PRIMARY_NAV.map((item) => (
        <SidebarNavItem key={item.to} item={item} onClick={onNavigate} />
      ))}
      <div className="my-3 border-t border-border" />
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        Admin
      </p>
      {ADMIN_NAV.map((item) => (
        <SidebarNavItem key={item.to} item={item} onClick={onNavigate} />
      ))}
    </nav>
  );
}
