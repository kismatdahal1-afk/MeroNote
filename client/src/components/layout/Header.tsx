import { Link } from "react-router-dom";
import { NotebookPen, Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "../../state/ThemeProvider";
import { useLibrary } from "../../state/LibraryProvider";
import { HeaderSearch } from "../common/SearchBar";
import { IconButton } from "../common/IconButton";
import { mockUser } from "../../data/mock";

export function BrandMark({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <Link
      to="/dashboard"
      className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      aria-label="Mero Note home"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
        <NotebookPen className="size-5" aria-hidden="true" />
      </span>
      <span className={subtitle ? "flex flex-col" : ""}>
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          Mero Note
        </span>
        {subtitle && (
          <span className="text-xs text-slate-500 dark:text-slate-400">CSIT Study Library</span>
        )}
      </span>
    </Link>
  );
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { favorites } = useLibrary();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/80 lg:px-6">
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
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        />
        <Link
          to="/settings"
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          aria-label={`Account: ${mockUser.name}`}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
            AS
          </span>
          <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 lg:block">
            {mockUser.name}
          </span>
        </Link>
        <span className="sr-only">{favorites.length} favorites</span>
      </div>
    </header>
  );
}
