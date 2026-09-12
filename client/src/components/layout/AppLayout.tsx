import { useState, type ReactNode } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { MobileDrawer } from "./MobileDrawer";
import { SidebarNav } from "./Sidebar";
import { BrandMark } from "./Header";

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-900 lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5 dark:border-slate-700/60">
          <BrandMark subtitle />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>
        <div className="border-t border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
          v0.2.0 — Phase 2 (mock data)
        </div>
      </aside>

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="lg:pl-64">
        <Header onMenuClick={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <ScrollRestoration />
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="animate-in">{children}</div>;
}
