import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { MobileDrawer } from "./MobileDrawer";
import { SidebarNav } from "./Sidebar";
import { BrandMark } from "./Header";

/**
 * Page transition wrapper: on route change the page content re-mounts and
 * plays a short (220ms) horizontal slide — from the right on forward
 * navigation, from the left on back (POP) navigation. The persistent app
 * shell (sidebar, header, bottom nav) sits outside this wrapper and never
 * animates. Implemented as a plain CSS animation (not the View Transitions
 * API) so it also works in older Android WebView / PWA environments.
 * (Scroll-to-top on navigation is handled by the router-level ScrollToTop.)
 */
function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    prevPathname.current = pathname;
  }, [pathname]);

  // First app render must not animate (useNavigationType is "POP" on load).
  const pathChanged = prevPathname.current !== null && prevPathname.current !== pathname;
  const animateClass =
    !pathChanged
      ? ""
      : navigationType === "POP"
        ? "animate-page-back"
        : "animate-page-forward";

  return (
    <div className="min-w-0 overflow-x-clip">
      <div key={pathname + navigationType} className={animateClass}>
        {children}
      </div>
    </div>
  );
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  // Reader routes render the full-bleed PDF viewer: the shell's outer
  // gutter and centered column are lifted for these routes only, so the
  // viewer spans the full content width (sidebar boundary to viewport
  // edge) and attaches directly under the slim reader app header. The
  // viewer itself fits the viewport exactly (100dvh minus slim header),
  // so the window never scrolls and only the PDF area scrolls internally.
  const isReaderRoute = /\/reader\//.test(pathname);

  return (
    // Reader routes use a flat bg-background shell (no hero gradient) so a
    // 1px seam at the app-header boundary can never paint hero cream.
    <div className={isReaderRoute ? "bg-background min-h-screen" : "bg-hero-gradient min-h-screen"}>
      {/* Desktop sidebar — dark tint comes from the dark-mode sidebar tokens */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface dark:border-[#20242B] dark:bg-[#0D1015] lg:flex">
        <div className={`flex items-center border-b border-border px-5 ${isReaderRoute ? "h-12" : "h-16"}`}>
          <BrandMark subtitle />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>
        <div className="border-t border-border p-4 text-xs font-medium text-muted-foreground/70">
          Mero Note · v1.0.0
        </div>
      </aside>

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="lg:pl-64">
        <Header onMenuClick={() => setDrawerOpen(true)} />
        {/* pb-28 on mobile clears the fixed bottom nav (74px + safe-area);
            desktop keeps its own spacing (nav is hidden on lg). Reader
            routes are full-bleed at every breakpoint (no gutter, no
            centered column) with true 0px spacing under the app header
            (the header renders its bottom border transparent there). The
            inline paddingBottom holds pb-0 below lg, where a global
            bottom-nav clearance rule would otherwise override the class
            and reintroduce window scroll on reader routes. */}
        <main
          className={
            isReaderRoute
              ? "mx-auto w-full max-w-none px-0 pb-0 pt-0"
              : "mx-auto w-full max-w-7xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12"
          }
          style={isReaderRoute ? { paddingTop: 0, paddingBottom: 0 } : undefined}
        >
          {/* Reader routes bypass the slide animation wrapper: its
              translateX/opacity transform + overflow-x-clip can open a 1px
              bg seam at the app-header boundary. All other routes animate. */}
          {isReaderRoute ? (
            <Outlet />
          ) : (
            <PageTransition>
              <Outlet />
            </PageTransition>
          )}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
