import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "../../state/ThemeProvider";
import { useUser } from "../../state/UserProvider";
import { HeaderSearch } from "../common/SearchBar";
import { IconButton } from "../common/IconButton";
import { OfflineBadge } from "../common/OfflineBadge";

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
  const { name, role } = useUser();
  const { pathname } = useLocation();
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  // Same portal detection as BrandMark/SidebarNav: inside /admin stay in
  // Admin (Admin Settings), everywhere else go to Student Settings.
  const settingsPath = role === "ADMIN" && pathname.startsWith("/admin") ? "/admin/settings" : "/settings";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md lg:px-6">
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
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden text-sm font-semibold text-foreground lg:block">
            {name}
          </span>
        </Link>
      </div>
    </header>
  );
}
