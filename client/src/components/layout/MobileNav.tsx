import { NavLink } from "react-router-dom";
import { Home, GraduationCap, Search, Download } from "lucide-react";
import { cx } from "../../lib/utils";

const ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/semesters", label: "Semesters", icon: GraduationCap },
  { to: "/search", label: "Search", icon: Search },
  { to: "/downloads", label: "Downloads", icon: Download },
];

export function MobileNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/95 lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx(
                "flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs font-medium",
                isActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" aria-hidden="true" />
                <span>{label}</span>
                <span
                  aria-hidden="true"
                  className={cx(
                    "h-1 w-1 rounded-full",
                    isActive ? "bg-indigo-600 dark:bg-indigo-400" : "bg-transparent",
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
