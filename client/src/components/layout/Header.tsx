import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "../../state/ThemeProvider";
import { useUser } from "../../state/UserProvider";
import { HeaderSearch } from "../common/SearchBar";
import { IconButton } from "../common/IconButton";
import { OfflineBadge } from "../common/OfflineBadge";
import { UserAvatar } from "../common/UserAvatar";

export function BrandMark({ subtitle = false }: { subtitle?: boolean }) {
  const { role } = useUser();
  const { pathname } = useLocation();
  // Preserve the current portal context (same detection as SidebarNav):
  // inside /admin stay in Admin (Admin Dashboard), everywhere else go to
  // the Student Dashboard. Never cross-navigate between portals.
  const inAdmin = role === "ADMIN" && pathname.startsWith("/admin");
  const homePath = inAdmin ? "/admin" : "/dashboard";

  return (
    <Link
      to={homePath}
      className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label="Mero Note home"
    >
      <img
        src="/icon/icon.png"
        alt="Mero Note"
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-xl object-cover"
      />
      <span className={subtitle ? "flex flex-col" : ""}>
        <span className="text-lg font-bold tracking-tight text-foreground">
          Mero Note
        </span>
        {subtitle && (
          <span className="text-xs font-medium text-muted-foreground">CSIT Study Library</span>
        )}
      </span>
    </Link>
  );
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { name, role, user } = useUser();
  const { pathname } = useLocation();
  // Same portal detection as BrandMark/SidebarNav: inside /admin stay in
  // Admin (Admin Settings), everywhere else go to Student Settings.
  const settingsPath = role === "ADMIN" && pathname.startsWith("/admin") ? "/admin/settings" : "/settings";

  // Reader routes attach the PDF header flush below with zero gap, so the
  // app header's own 1px bottom border is rendered transparent there only.
  // Every other route keeps border-border; layout/content untouched.
  // The reader also gets a slimmer app header (h-12) so the PDF keeps more
  // vertical room; every other route keeps h-16. On reader routes the
  // header is fixed and overlays the top of the full-height viewer.
  const isReaderRoute = /\/reader\//.test(pathname);
  const readerBorder = isReaderRoute ? "border-transparent" : "border-border";

  return (
    <header className={isReaderRoute
      ? `fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-3 border-b px-4 backdrop-blur-md lg:left-64 lg:px-6 bg-surface/80 ${readerBorder}`
      : `sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-6 bg-surface/80 ${readerBorder}`}>
      <IconButton
        icon={Menu}
        label="Open navigation menu"
        className="lg:hidden"
        onClick={onMenuClick}
      />
      <div className="lg:hidden">
        <BrandMark />
      </div>
      <HeaderSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <OfflineBadge />
        <IconButton
          icon={resolvedTheme === "dark" ? Sun : Moon}
          label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        />
        <Link
          to={settingsPath}
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={`Account: ${name}`}
        >
          <UserAvatar name={name} imageUrl={user?.profileImageUrl} size="sm" />
          <span className="hidden text-sm font-semibold text-foreground lg:block">
            {name}
          </span>
        </Link>
      </div>
    </header>
  );
}
