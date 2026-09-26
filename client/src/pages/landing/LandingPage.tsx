import { Navigate } from "react-router-dom";
import { useUser } from "../../state/UserProvider";
import { useStandalone } from "./hooks/useStandalone";
import { LANDING_SECTION_IDS, landingEntryTarget } from "../../lib/site";
import { LandingNavbar } from "./components/LandingNavbar";
import { HeroSection } from "./components/HeroSection";
import { FinalCTA } from "./components/FinalCTA";
import {
  HierarchySection,
  JourneySection,
  LandingFooter,
  MobileSection,
  ReadingSection,
  UniverseSection,
} from "./components/Sections";

/**
 * Public welcome/landing page (route "/") with app-entry routing.
 *
 * Deliberately rendered OUTSIDE `AppLayout`: no sidebar, no bottom nav,
 * no drawer, no reader chrome — with its own navbar, sections and footer.
 * Separation from the installed PWA is guaranteed two ways:
 *  1. manifest `start_url` is "/dashboard" (primary — PWA never opens "/");
 *  2. `useStandalone` redirects an app-mode window on "/" into the
 *     existing auth flow (guest → /login, authed → role home).
 *
 * Normal browser tabs (desktop AND mobile) always see the landing while
 * guest — never an automatic trip to /login. Authenticated visitors are
 * sent to their existing home (ADMIN → /admin, USER → /dashboard) so the
 * landing never sits in front of the app for signed-in users.
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

  const entryTarget = landingEntryTarget({ appMode: standalone, status, role });
  if (entryTarget) {
    return <Navigate to={entryTarget} replace />;
  }

  return (
    <div id={LANDING_SECTION_IDS.top} className="landing-page bg-hero-gradient flex min-h-screen flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <HierarchySection />
        <UniverseSection />
        <ReadingSection />
        <MobileSection />
        <JourneySection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
