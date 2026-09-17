import { useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  GraduationCap,
  FileStack,
  Download,
  Bookmark,
  Bell,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";
import { studentNavHighlight, adminNavHighlight } from "../../lib/resourceNavigation";
import { useUser } from "../../state/UserProvider";

interface MobileNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** Centralized mobile navigation configs — portal-aware, no duplicated route logic. */
const STUDENT_MOBILE_NAV: MobileNavItem[] = [
  { to: "/dashboard", label: "Home", icon: Home, end: true },
  { to: "/semesters", label: "Semester", icon: GraduationCap },
  { to: "/resources", label: "Resources", icon: FileStack },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
];

const ADMIN_MOBILE_NAV: MobileNavItem[] = [
  { to: "/admin", label: "Home", icon: Home, end: true },
  { to: "/admin/semesters", label: "Semester", icon: GraduationCap },
  { to: "/admin/resources", label: "Resources", icon: FileStack },
  { to: "/admin/notices", label: "Notice", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

/**
 * Which tab owns the current URL — mirrors NavLink matching (exact for
 * `end` routes, prefix for section roots). Shared detail/reader pages keep
 * their entry point highlighted via `highlightOverride` when it maps to a
 * tab; otherwise default URL matching applies.
 */
function resolveActiveTo(
  items: MobileNavItem[],
  pathname: string,
  highlightOverride: string | undefined,
  overrideApplies: boolean,
): string {
  if (overrideApplies && highlightOverride) return highlightOverride;
  for (const it of items) {
    if (it.end) {
      if (pathname === it.to) return it.to;
    } else if (pathname === it.to || pathname.startsWith(`${it.to}/`)) {
      return it.to;
    }
  }
  return items[0].to;
}

/**
 * Floating bottom navigation — template port: full-width bar pinned to
 * the lowest part of the screen with an SVG notch that dips around a
 * white floating circle carrying the active icon. The bar fill and label
 * colors come from the app theme (surface / foreground tokens) so it
 * belongs in both Light and Dark Mode. Only the icon glyphs come from
 * the app's Lucide set (per-portal mapping); layout, notch geometry and
 * timing follow the template 1:1.
 */
function LiquidBottomNav({
  ariaLabel,
  items,
  activeTo,
}: {
  ariaLabel: string;
  items: MobileNavItem[];
  activeTo: string;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const btnRef = useRef<HTMLDivElement | null>(null);
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tweenRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const prevXRef = useRef<number | null>(null);

  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.to === activeTo),
  );
  const ActiveIcon = items[activeIndex].icon;

  // ---- Template path builder (verbatim geometry) ----
  function buildPath(w: number, h: number, notchX: number): string {
    const rt = 10; // small curve on upper corners only; bottom stays square to the viewport edge
    const halfNotch = 44;
    const depth = 28;
    const x0 = notchX - halfNotch;
    const x1 = notchX - halfNotch * 0.45;
    const x2 = notchX;
    const x3 = notchX + halfNotch * 0.45;
    const x4 = notchX + halfNotch;

    return [
      `M ${rt} 0`,
      `L ${x0} 0`,
      `C ${x1} 0 ${x1} ${depth} ${x2} ${depth}`,
      `C ${x3} ${depth} ${x3} 0 ${x4} 0`,
      `L ${w - rt} 0`,
      `A ${rt} ${rt} 0 0 1 ${w} ${rt}`,
      `L ${w} ${h}`,
      `L 0 ${h}`,
      `L 0 ${rt}`,
      `A ${rt} ${rt} 0 0 1 ${rt} 0`,
      "Z",
    ].join(" ");
  }

  function centerXFor(index: number): number {
    const nav = navRef.current;
    const icon = iconRefs.current[index];
    if (!nav || !icon) return 0;
    const iconRect = icon.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    return iconRect.left + iconRect.width / 2 - navRect.left;
  }

  function drawPathAt(x: number): void {
    const nav = navRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    if (!nav || !svg || !path) return;
    const { width: w, height: h } = nav.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", `${w}`);
    svg.setAttribute("height", `${h}`);
    path.setAttribute("d", buildPath(w, h, x));
  }

  function paintImmediate(): void {
    const btn = btnRef.current;
    if (!btn) return;
    const x = centerXFor(activeIndex);
    btn.style.left = `${x}px`;
    drawPathAt(x);
    prevXRef.current = x;
  }

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  function tweenNotch(fromX: number, toX: number): void {
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
    const btn = btnRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (btn) btn.style.left = `${toX}px`;
      drawPathAt(toX);
      prevXRef.current = toX;
      tweenRef.current = null;
      return;
    }
    const duration = 380;
    const start = performance.now();

    // One shared loop drives BOTH the bubble (`left`) and the bar notch
    // (SVG path) from the same eased value, so they glide as a single
    // synchronized liquid element — no drift, no wobble.
    function step(now: number): void {
      const t = Math.min((now - start) / duration, 1);
      const x = fromX + (toX - fromX) * easeOutCubic(t);
      if (btn) btn.style.left = `${x}px`;
      drawPathAt(x);
      if (t < 1) {
        tweenRef.current = requestAnimationFrame(step);
      } else {
        prevXRef.current = toX;
        tweenRef.current = null;
      }
    }
    tweenRef.current = requestAnimationFrame(step);
  }

  // Paint synchronously on mount (before first browser paint) so the bar
  // + notch are visible from the very first frame — never hidden on load.
  useLayoutEffect(() => {
    paintImmediate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Glide the notch + floating circle when the active tab changes.
  // Both are driven by the same rAF loop (see tweenNotch) so they move
  // together as one element. The bar itself stays fixed — only the
  // indicator travels horizontally.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const toX = centerXFor(activeIndex);
    const fromX = prevXRef.current ?? toX;
    if (fromX === toX) {
      const btn = btnRef.current;
      if (btn) btn.style.left = `${toX}px`;
      drawPathAt(toX);
      prevXRef.current = toX;
    } else {
      tweenNotch(fromX, toX);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Re-layout on width changes (rotation, resize, font load shifts).
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      const onResize = (): void => paintImmediate();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    const ro = new ResizeObserver(() => paintImmediate());
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Permanently fixed to the viewport bottom: independent of document
  // height and scroll position. No scroll listener, no hide/show logic —
  // page content scrolls behind/above while this stays stationary.
  // overflow-x-clip guarantees no horizontal overflow at any width.
  return (
    <div className="liq-bottom-nav-root fixed inset-x-0 bottom-0 z-40 overflow-x-clip lg:hidden">
      <nav ref={navRef} aria-label={ariaLabel} className="liq-bottom-nav">
        <div aria-hidden="true" className="liq-nav-fallback" />
        <svg ref={svgRef} aria-hidden="true" focusable="false" className="liq-nav-bg">
          <path ref={pathRef} />
        </svg>

        <div className="liq-nav-items">
          {items.map(({ to, label, icon: Icon, end }, i) => {
            const active = i === activeIndex;
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-current={active ? "page" : undefined}
                className={cx("liq-nav-item", active && "active")}
              >
                <span
                  ref={(el) => {
                    iconRefs.current[i] = el;
                  }}
                  className="liq-nav-icon"
                >
                  <Icon className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="liq-nav-label">{label}</span>
              </NavLink>
            );
          })}
        </div>

        <div ref={btnRef} aria-hidden="true" className="liq-floating-btn">
          <span className="liq-floating-icon">
            <ActiveIcon className="size-6" strokeWidth={1.8} aria-hidden="true" />
          </span>
        </div>
      </nav>
    </div>
  );
}

/**
 * Portal-aware mobile bottom navigation.
 * - Student portal → Home/Semester/Resources/Downloads/Saved
 * - Admin portal (role ADMIN + /admin prefix) → Home/Semester/Resources/Notice/Settings
 * Portal detection matches SidebarNav: role === "ADMIN" && pathname.startsWith("/admin")
 * Both portals share the same floating template design; only routes/labels differ.
 */
export function MobileNav() {
  const { role } = useUser();
  const { pathname, state } = useLocation();

  const isAdminPortal = role === "ADMIN" && pathname.startsWith("/admin");

  const highlightOverride = isAdminPortal
    ? adminNavHighlight(pathname, state)
    : studentNavHighlight(pathname, state);

  if (isAdminPortal) {
    const overrideApplies =
      !!highlightOverride && ADMIN_MOBILE_NAV.some((it) => it.to === highlightOverride);
    const activeTo = resolveActiveTo(ADMIN_MOBILE_NAV, pathname, highlightOverride, overrideApplies);
    return (
      <LiquidBottomNav
        ariaLabel="Admin mobile navigation"
        items={ADMIN_MOBILE_NAV}
        activeTo={activeTo}
      />
    );
  }

  const overrideApplies =
    !!highlightOverride && STUDENT_MOBILE_NAV.some((it) => it.to === highlightOverride);
  const activeTo = resolveActiveTo(STUDENT_MOBILE_NAV, pathname, highlightOverride, overrideApplies);
  return (
    <LiquidBottomNav
      ariaLabel="Student mobile navigation"
      items={STUDENT_MOBILE_NAV}
      activeTo={activeTo}
    />
  );
}
