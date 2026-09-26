import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "../../../state/ThemeProvider";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Library", href: "#library" },
];

/**
 * Dedicated public landing navbar — intentionally separate from the
 * authenticated app Header/Sidebar so the marketing experience never
 * shares navigation chrome with the student dashboard, PWA shell,
 * bottom nav, or Admin CMS.
 */
export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
      <nav
        aria-label="Mero Note public site"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6"
      >
        <Link
          to="/"
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
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-foreground">Mero Note</span>
            <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              CSIT Study Library
            </span>
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:ml-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4.5" aria-hidden="true" />
            ) : (
              <Moon className="size-4.5" aria-hidden="true" />
            )}
          </button>
          <Link
            to="/login"
            className="hidden rounded-lg px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:block"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
          >
            Get Started
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border bg-surface px-4 pb-5 pt-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 flex gap-2">
            <Link
              to="/login"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border-strong bg-surface text-sm font-bold text-foreground transition-colors hover:bg-surface-hover"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Get Started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
