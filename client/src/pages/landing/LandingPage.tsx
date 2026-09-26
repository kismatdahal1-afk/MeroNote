import { Navigate } from "react-router-dom";
import { useUser } from "../../state/UserProvider";
import { useStandalone } from "./hooks/useStandalone";
import { LandingNavbar } from "./components/LandingNavbar";
import { HeroSection } from "./components/HeroSection";
import {
  FeatureGrid,
  FinalCTA,
  HowItWorks,
  LandingFooter,
  MobileShowcase,
  OrgHierarchy,
  ResourceLibrary,
} from "./components/Sections";

/**
 * Public browser-only welcome/landing page (route "/").
 *
 * Deliberately rendered OUTSIDE `AppLayout`: no sidebar, no bottom nav,
 * no drawer, no reader chrome — with its own navbar, sections and footer.
 * Separation from the installed PWA is guaranteed two ways:
 *  1. manifest `start_url` is "/dashboard" (primary — PWA never opens "/");
 *  2. `useStandalone` redirects a standalone window on "/" into the app.
 *
 * Authenticated visitors are sent to their existing home
 * (ADMIN → /admin, USER → /dashboard) so the landing never sits
 * in front of the app for signed-in users.
 */
export default function LandingPage() {
  const { status, role } = useUser();
  const standalone = useStandalone();

  if (status === "loading") {
    return (
      <div className="bg-hero-gradient flex min-h-screen items-center justify-center" aria-label="Loading">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    );
  }

  if (standalone) {
    return <Navigate to="/dashboard" replace />;
  }

  if (status === "authed") {
    return <Navigate to={role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  }

  return (
    <div className="landing-page bg-hero-gradient flex min-h-screen flex-col">
      <LandingNavbar />
      <main className="flex-1 pb-4">
        <HeroSection />
        <OrgHierarchy />
        <ResourceLibrary />
        <MobileShowcase />
        <HowItWorks />
        <FeatureGrid />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
