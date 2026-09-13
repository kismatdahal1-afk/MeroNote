import { useState } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { MobileDrawer } from "./MobileDrawer";
import { SidebarNav } from "./Sidebar";
import { BrandMark } from "./Header";

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="bg-hero-gradient min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <BrandMark subtitle />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>
        <div className="border-t border-border p-4 text-xs font-medium text-muted-foreground/70">
          v0.2.5 — Phase 2.5 (mock data)
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
