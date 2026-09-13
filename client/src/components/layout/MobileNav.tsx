import { NavLink } from "react-router-dom";
import { Home, GraduationCap, FileStack, Download, Bookmark } from "lucide-react";
import { cx } from "../../lib/utils";
import { useLibrary } from "../../state/LibraryProvider";

/** Fixed mobile bottom navigation with download count badge. */
export function MobileNav() {
  const { downloads, bookmarks } = useLibrary();
  const completedDownloads = downloads.filter((d) => d.status === "completed").length;

  const items = [
    { to: "/dashboard", label: "Home", icon: Home, badge: 0 },
    { to: "/semesters", label: "Semesters", icon: GraduationCap, badge: 0 },
    { to: "/resources", label: "Resources", icon: FileStack, badge: 0 },
    { to: "/downloads", label: "Downloads", icon: Download, badge: completedDownloads },
    { to: "/bookmarks", label: "Saved", icon: Bookmark, badge: bookmarks.length },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
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
