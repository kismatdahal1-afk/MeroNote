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

  return (
    <div className="bg-hero-gradient min-h-screen">
      {/* Desktop sidebar — dark tint comes from the dark-mode sidebar tokens */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface dark:border-[#20242B] dark:bg-[#0D1015] lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <BrandMark subtitle />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>
        <div className="border-t border-border p-4 text-xs font-medium text-muted-foreground/70">
          v0.3.0 — Admin CMS (local data)
        </div>
      </aside>

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="lg:pl-64">
        <Header onMenuClick={() => setDrawerOpen(true)} />
        {/* pb-28 on mobile clears the fixed bottom nav (74px + safe-area);
            desktop keeps its own spacing (nav is hidden on lg). */}
        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
