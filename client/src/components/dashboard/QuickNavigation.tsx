import { Link } from "react-router-dom";
import { Heart, Bookmark as BookmarkIcon, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";

interface QuickNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface QuickNavigationProps {
  items: QuickNavItem[];
}

/** Compact pill/tab row: equal thirds on mobile (never scrolls), natural widths on desktop. */
export function QuickNavigation({ items }: QuickNavigationProps) {
  return (
    <nav
      aria-label="Quick navigation"
      className="flex gap-1.5 overflow-x-auto sm:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map(({ to, label, icon: Icon, count }) => (
        <Link
          key={to}
          to={to}
          className={cx(
            "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "border border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            "sm:flex-none sm:px-3.5 sm:text-xs",
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{label}</span>
          {count !== undefined && (
            <span className="shrink-0 rounded-full bg-primary-muted px-1.5 py-px text-[10px] font-bold text-primary">
              {count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Default dashboard quick tabs. */
export function defaultQuickNav(favorites: number, bookmarks: number): QuickNavItem[] {
  return [
    { to: "/semesters", label: "Semesters", icon: GraduationCap },
    { to: "/favorites", label: "Favorites", icon: Heart, count: favorites },
    { to: "/bookmarks", label: "Bookmarks", icon: BookmarkIcon, count: bookmarks },
  ];
}
