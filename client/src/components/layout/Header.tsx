import { Link } from "react-router-dom";
import { NotebookPen, Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "../../state/ThemeProvider";
import { HeaderSearch } from "../common/SearchBar";
import { IconButton } from "../common/IconButton";
import { mockUser } from "../../data/mock";

export function BrandMark({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <Link
      to="/dashboard"
      className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label="Mero Note home"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <NotebookPen className="size-5" aria-hidden="true" />
      </span>
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
        <IconButton
          icon={resolvedTheme === "dark" ? Sun : Moon}
          label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        />
        <Link
          to="/settings"
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={`Account: ${mockUser.name}`}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            AS
          </span>
          <span className="hidden text-sm font-semibold text-foreground lg:block">
            {mockUser.name}
          </span>
        </Link>
      </div>
    </header>
  );
}
