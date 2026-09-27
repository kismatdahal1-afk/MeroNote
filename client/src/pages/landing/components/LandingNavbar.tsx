import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
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

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const FOCUS_RING_NO_OFFSET =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const ICON_BUTTON = `flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground ${FOCUS_RING}`;

const STYLES = {
  desktopLink: `rounded-lg px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary active:text-primary ${FOCUS_RING}`,
  mobileLink: `flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-center text-[13px] font-semibold text-foreground transition-colors hover:text-primary active:text-primary ${FOCUS_RING_NO_OFFSET}`,
  loginDesktop: `hidden rounded-lg border border-border bg-surface-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover ${FOCUS_RING} dark:border-white sm:block`,
  registerDesktop: `hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover ${FOCUS_RING} sm:inline-flex`,
  loginMobile:
    "inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border-strong bg-surface text-sm font-bold text-foreground transition-colors hover:bg-surface-hover dark:border-white",
  registerMobile:
    "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover",
} as const;

/**
 * Scroll-aware visibility: visible at the top, hides on scroll down,
 * reappears on scroll up.
 */
function useHideOnScroll() {
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

  return showHeader;
}

interface NavItemProps {
  entry: NavEntry;
  className: string;
  onHome: () => void;
  onSection: (sectionId: string) => (e: MouseEvent) => void;
}

function NavItem({ entry, className, onHome, onSection }: NavItemProps) {
  if (entry.to) {
    return (
      <Link to={entry.to} onClick={onHome} className={className}>
        {entry.label}
      </Link>
    );
  }
  return (
    <a href={`#${entry.sectionId}`} onClick={onSection(entry.sectionId!)} className={className}>
      {entry.label}
    </a>
  );
}

function Brand({ onHome }: { onHome: () => void }) {
  return (
    <div className="flex flex-1 items-center">
      <Link
        to="/"
        onClick={onHome}
        className={`flex items-center gap-2.5 rounded-lg ${FOCUS_RING}`}
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
  );
}

function DesktopNav({ onHome, onSection }: { onHome: () => void; onSection: NavItemProps["onSection"] }) {
  return (
    <div className="hidden items-center justify-center gap-1 md:flex">
      {NAV_LINKS.map((entry) => (
        <NavItem
          key={entry.label}
          entry={entry}
          className={STYLES.desktopLink}
          onHome={onHome}
          onSection={onSection}
        />
      ))}
    </div>
  );
}

interface NavbarActionsProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

function NavbarActions({ menuOpen, onToggleMenu }: NavbarActionsProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-1 items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className={ICON_BUTTON}
      >
        {resolvedTheme === "dark" ? (
          <Sun className="size-4.5" aria-hidden="true" />
        ) : (
          <Moon className="size-4.5" aria-hidden="true" />
        )}
      </button>
      <Link to="/login" className={STYLES.loginDesktop}>
        Login
      </Link>
      <Link to="/register" className={STYLES.registerDesktop}>
        Get Started
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
      <button
        type="button"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        className={`${ICON_BUTTON} md:hidden`}
      >
        {menuOpen ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Menu className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

interface MobileMenuProps {
  open: boolean;
  onHome: () => void;
  onSection: NavItemProps["onSection"];
}

function MobileMenu({ open, onHome, onSection }: MobileMenuProps) {
  return (
    <div
      className={`grid transition-all duration-300 ease-in-out motion-reduce:transition-none md:hidden ${
        open
          ? "grid-rows-[1fr] opacity-100"
          : "invisible grid-rows-[0fr] pointer-events-none opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div
          className={`border-t border-border bg-surface px-4 pb-5 pt-2 transition-transform duration-300 motion-reduce:transform-none ${
            open ? "translate-y-0" : "-translate-y-2"
          }`}
        >
          <div className="flex items-center justify-between gap-1 py-1">
            {NAV_LINKS.map((entry) => (
              <NavItem
                key={entry.label}
                entry={entry}
                className={STYLES.mobileLink}
                onHome={onHome}
                onSection={onSection}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Link to="/login" className={STYLES.loginMobile}>
              Login
            </Link>
            <Link to="/register" className={STYLES.registerMobile}>
              Get Started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dedicated public landing navbar — intentionally separate from the
 * authenticated app Header/Sidebar so the marketing experience never
 * shares navigation chrome with the student dashboard, PWA shell,
 * bottom nav, or Admin CMS.
 */
export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const showHeader = useHideOnScroll();
  const visible = showHeader || open;

  const closeMenu = useCallback(() => setOpen(false), []);
  const toggleMenu = useCallback(() => setOpen((v) => !v), []);

  /**
   * In-page section navigation: smooth-scroll without a new page.
   * The navbar only renders on `/`, so the target is always present —
   * no router navigation needed.
   */
  const handleSectionClick = useCallback(
    (sectionId: string) => (e: MouseEvent) => {
      e.preventDefault();
      closeMenu();
      scrollToLandingSection(sectionId);
      window.history.replaceState(null, "", `#${sectionId}`);
    },
    [closeMenu],
  );

  /** Home: router navigation when elsewhere, smooth scroll-to-top when on `/`. */
  const handleHomeClick = useCallback(() => {
    closeMenu();
    if (pathname === "/") {
      scrollToLandingSection(LANDING_SECTION_IDS.top);
      window.history.replaceState(null, "", "/");
    }
  }, [closeMenu, pathname]);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <nav
        aria-label="Mero Note public site"
        className="flex h-20 w-full items-center gap-3 px-4 sm:px-6 lg:px-8"
      >
        <Brand onHome={handleHomeClick} />
        <DesktopNav onHome={handleHomeClick} onSection={handleSectionClick} />
        <NavbarActions menuOpen={open} onToggleMenu={toggleMenu} />
      </nav>

      <MobileMenu open={open} onHome={handleHomeClick} onSection={handleSectionClick} />
    </header>
  );
}
