import { Link } from "react-router-dom";
import { Heart, Bookmark as BookmarkIcon, GraduationCap } from "lucide-react";
import { cx } from "../../lib/utils";

interface QuickNavItem {
  to: string;
  label: string;
  icon: typeof GraduationCap;
  count?: number;
}

interface QuickNavigationProps {
  items: QuickNavItem[];
}

/** Compact horizontally scrollable pill/tab row (never overflows). */
export function QuickNavigation({ items }: QuickNavigationProps) {
  return (
    <nav
      aria-label="Quick navigation"
      className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map(({ to, label, icon: Icon, count }) => (
        <Link
          key={to}
          to={to}
          className={cx(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "border border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
          {count !== undefined && (
            <span className="rounded-full bg-primary-muted px-1.5 py-px text-[10px] font-bold text-primary">
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
