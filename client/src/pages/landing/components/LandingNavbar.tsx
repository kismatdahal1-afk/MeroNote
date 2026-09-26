import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "../../../state/ThemeProvider";
import { LANDING_SECTION_IDS, scrollToLandingSection } from "../../../lib/site";

interface NavEntry {
  label: string;
  /** Router destination (Home). Set when `sectionId` is absent. */
  to?: string;
  /** Landing section anchor. Set when `to` is absent. */
  sectionId?: string;
}

const NAV_LINKS: NavEntry[] = [
  { label: "Home", to: "/" },
  { label: "Library", sectionId: LANDING_SECTION_IDS.library },
  { label: "Study", sectionId: LANDING_SECTION_IDS.study },
  { label: "How It Works", sectionId: LANDING_SECTION_IDS.howItWorks },
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
  const { pathname } = useLocation();
  const closeMenu = () => setOpen(false);

  /**
   * Scroll-aware header: fully visible at the top, slides away upward
   * while scrolling down, slides back down into view while scrolling
   * up. Forced visible while the mobile menu is open.
   */
  const [showHeader, setShowHeader] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      lastY.current = y;
      if (y <= 8) {
        setShowHeader(true);
        return;
      }
      if (delta > 6) setShowHeader(false);
      else if (delta < -6) setShowHeader(true);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * In-page section navigation: smooth-scroll without a new page.
   * The navbar only renders on `/`, so the target is always present —
   * no router navigation needed.
   */
  const handleSectionClick = (sectionId: string) => (e: MouseEvent) => {
    e.preventDefault();
    closeMenu();
    scrollToLandingSection(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);
  };

  /** Home: router navigation when elsewhere, smooth scroll-to-top when on `/`. */
  const handleHomeClick = () => {
    closeMenu();
    if (pathname === "/") {
      scrollToLandingSection(LANDING_SECTION_IDS.top);
      window.history.replaceState(null, "", "/");
    }
  };

  const linkClass =
    "rounded-lg px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const mobileLinkClass =
    "block rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <header
      className={`sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none ${showHeader || open ? "translate-y-0" : "-translate-y-full"}`}
    >
      <nav
        aria-label="Mero Note public site"
        className="flex h-20 w-full items-center gap-3 px-4 sm:px-6 lg:px-8"
      >
        <div className="flex flex-1 items-center">
          <Link
            to="/"
            onClick={handleHomeClick}
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
        </div>

        <div className="hidden items-center justify-center gap-1 md:flex">
          {NAV_LINKS.map((link) =>
            link.to ? (
              <Link
                key={link.label}
                to={link.to}
                onClick={handleHomeClick}
                className={linkClass}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={`#${link.sectionId}`}
                onClick={handleSectionClick(link.sectionId!)}
                className={linkClass}
              >
                {link.label}
              </a>
            ),
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-1.5">
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
            className="hidden rounded-lg border border-border bg-surface-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:block"
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
          {NAV_LINKS.map((link) =>
            link.to ? (
              <Link
                key={link.label}
                to={link.to}
                onClick={handleHomeClick}
                className={mobileLinkClass}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={`#${link.sectionId}`}
                onClick={handleSectionClick(link.sectionId!)}
                className={mobileLinkClass}
              >
                {link.label}
              </a>
            ),
          )}
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
