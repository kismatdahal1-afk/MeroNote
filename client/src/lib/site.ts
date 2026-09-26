/**
 * Shared landing-site navigation config.
 *
 * Single source of truth for Header/Footer section anchors, protected
 * study destinations, and the Instagram URL — so no routing logic is
 * duplicated across the navbar and footer.
 *
 * Instagram: the configured Mero Note profile URL, overridable via
 * `VITE_INSTAGRAM_URL` in the deployment environment.
 */

/** In-page anchors on the landing page (`/`). */
export const LANDING_SECTION_IDS = {
  top: "top",
  hero: "home-hero",
  library: "library",
  study: "study",
  howItWorks: "how-it-works",
} as const;

/** Protected study destinations (all behind `RequireAuth`). */
export const STUDY_DESTINATIONS = {
  semesters: "/semesters",
  /** Subjects are browsed through the semester library. */
  subjects: "/semesters",
  resources: "/resources",
  books: "/resources?type=book",
  questions: "/resources?type=questions",
  pastPapers: "/resources?type=past_paper",
} as const;

/**
 * Actual Instagram URL configured for Mero Note.
 * `VITE_INSTAGRAM_URL` overrides this when set — otherwise the
 * configured Mero Note profile URL below is used.
 */
export const INSTAGRAM_URL: string = (
  import.meta.env.VITE_INSTAGRAM_URL ?? "https://www.instagram.com/kisma_tt07/"
).trim();

/** Login URL preserving the intended protected destination (`?next=`). */
export function loginWithNext(destination: string): string {
  return `/login?next=${encodeURIComponent(destination)}`;
}

export type EntryAuthStatus = "loading" | "guest" | "authed";
export type EntryRole = "USER" | "ADMIN";

/**
 * Pure `/` entry decision shared by LandingPage and regression tests.
 *
 * - Normal browser (desktop AND mobile) + guest → `null` (show landing).
 * - Installed PWA / APK wrapper + guest → `/login` (no `next`, so the
 *   existing post-login role-based destination is preserved).
 * - Authenticated (any entry) → existing role home (`/admin` / `/dashboard`).
 * - `loading` → `null`; the caller keeps its skeleton until resolved.
 */
export function landingEntryTarget(state: {
  appMode: boolean;
  status: EntryAuthStatus;
  role: EntryRole;
}): string | null {
  if (state.status === "loading") return null;
  if (state.status === "authed") {
    return state.role === "ADMIN" ? "/admin" : "/dashboard";
  }
  return state.appMode ? "/login" : null;
}

/**
 * Smooth-scroll to a landing section. `html { scroll-behavior: smooth }`
 * already handles the animation; this helper only resolves the element
 * (used when already on `/` so no new page/navigation occurs).
 */
export function scrollToLandingSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
