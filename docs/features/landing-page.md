# Landing Page

## Purpose

Public `/` route: marketing + auth-aware entry. Current implementation
as of commit `da4e0d3`. Rendered outside `AppLayout` (own navbar,
sections, footer — no sidebar, bottom nav, drawer, or reader chrome).

## Current implementation

### Entry behavior

- `landingEntryTarget({ appMode, status, role })` (`lib/site.ts`):
  `loading` → skeleton; `authed` → `/admin` (ADMIN) or `/dashboard`
  (USER); `guest + appMode` → `/login`; `guest + browser` → show
  landing (desktop and mobile — never an auto trip to `/login`).
- App-mode separation is two-layered: manifest `start_url` is
  `/dashboard` (primary — PWA never opens `/`), and `useStandalone`
  redirects app-mode windows on `/` into the auth flow. `useStandalone`
  detects installed PWA (`display-mode: standalone`, iOS standalone
  flag), Capacitor native, or `?pwa`/`?native` — UA/screen size never
  count.
- Section ids (`LANDING_SECTION_IDS`): `top`, `home-hero`, `library`,
  `study`, `how-it-works`. `site.ts` is the single source for anchors,
  protected study destinations, `loginWithNext()`, and the Instagram URL.

### Navbar (`components/LandingNavbar.tsx`)

Clean composition: `Brand | DesktopNav | NavbarActions` + `MobileMenu`,
shared `NavItem`, `useHideOnScroll`, `STYLES` constants.

- Nav links: Home (`to: /`), Library (`#library`), Study (`#study`),
  How It Works (`#how-it-works`). Section clicks smooth-scroll in place
  (`scrollToLandingSection` + `history.replaceState`, no router nav);
  Home scrolls to top on `/`, else router-navigates.
- Scroll-aware header: visible at top, hides on scroll down (`delta >
  6`), returns on scroll up (`delta < -6`); forced visible while the
  mobile menu is open.
- Desktop (`md:`+): muted links with text-only hover
  (`hover:text-primary`: purple `#5B3DF5` light / blue `#22B8F0` dark);
  theme toggle; Login (`sm:`+, `dark:border-white` stroke); Get Started
  (`bg-primary`).
- Mobile (`md:hidden` hamburger): row 1 — four links justified in one
  line (`flex justify-between`, `flex-1 text-center`, same text-only
  hover); row 2 — `[Login] [Get Started]` side-by-side (`flex-1`,
  `h-11`). Panel animates (grid-rows `0fr→1fr` + fade + slight slide,
  300ms; `invisible pointer-events-none` when closed;
  `motion-reduce` respected).

### Sections (in order)

1. **Hero** (`HeroSection.tsx`, `id="home-hero"`): gradient headline,
   supporting copy, dual CTA (Get Started → `/register`, Explore Library
   → `/login?next=/dashboard`), ambient glow + full-width line grid,
   staggered `animate-fade-up`, then `ProductComposition`.
2. **ProductComposition**: three real screenshots (Dashboard front,
   Semester left, note right); hovering/focusing a back image glides it
   front (single `hoveredId` state + flight lock against flicker loops);
   touch tap-to-promote/restore; separate desktop/mobile geometry;
   reduced-motion disables travel.
3. **HierarchySection** (Organization): Semester → Subject → Topic →
   Resource timeline (4 steps, meta chips); desktop 4-col grid with
   edge-to-edge rail segments, mobile vertical rail; stroke-only nodes
   (`border-primary`, white in dark), icon-only hover zoom.
4. **UniverseSection** (`id="library"`, Resource Library): interactive
   8-type radial wheel (Book, Short Notes, Handwritten, Extra Notes,
   Question, Important Question, Past Paper, Practical Lab). Shortest-path
   rotation onto the alignment point (east desktop / south mobile),
   distance-scaled spin time, counter-rotated upright labels, one-time
   360° discovery spin on first view, playing-card stage (open card
   animates in over 7 stacked behind-cards), `Explore Library` CTA.
5. **ReadingSection** (`id="study"`, Study Experience): intro + 5-step
   timeline (Reading, Bookmarks, Progress, Recent, Continue studying).
6. **MobileSection**: 45/55 grid, 3 points (same account, small screens,
   offline downloads), three-phone tilted showcase (`phone1-3.jpeg`).
7. **JourneySection** (`id="how-it-works"`): intro + 5-step timeline
   (semester → subject → resources → open → resume).
8. **FinalCTA**: app icon, “Your CSIT library starts here.”, Get Started
   + Log in link.
9. **LandingFooter** (`Sections.tsx`): brand + Explore (in-page anchors),
   Study (protected destinations; guests → `loginWithNext()`, authed →
   direct), Account (Login/Register/Dashboard), Contact (Instagram from
   `VITE_INSTAGRAM_URL`, custom SVG glyph). Bottom bar `© 2026`.

### Cross-cutting

- `Reveal`: IntersectionObserver (threshold 0.12), once-visible
  fade/slide-in (700ms), optional stagger delay, `as` supports `li`.
- Theme: token-driven (`--color-primary` switches purple/blue); login
  white stroke dark-only; timeline rails/nodes white in dark.
- Responsive: mobile-first hero (left-aligned, 75% measure) → centered
  desktop; `sm:`/`md:`/`lg:` breakpoints; mobile bottom-nav clearance
  explicitly excluded for the landing subtree.
- Accessibility: labelled nav/regions, focus-visible rings, `aria-pressed`
  wheel nodes, sr-only live region for the open card, step positions,
  decorative layers `aria-hidden`.
- Reduced motion: global CSS collapse + per-component
  `motion-reduce:` guards + JS instant paths.
- Assets: `/icon/icon*.png` (brand + PWA), `/images/` (hero screenshots
  + phone shots), all lazy except the hero dashboard shot.

## Important files

- `pages/landing/LandingPage.tsx`, `components/{LandingNavbar,
  HeroSection, Sections, FinalCTA, ProductComposition, Reveal}.tsx`,
  `hooks/useStandalone.ts`, `lib/site.ts`

## Known limitations

- No active-section highlight in the navbar on scroll.
- No landing-specific SEO meta beyond the base `index.html`.

## Change rules

- Keep `site.ts` the single source for anchors/destinations.
- Keep the landing outside `AppLayout`; never mount app chrome here.
- Keep in-page navigation (smooth-scroll + `replaceState`), not router
  pushes, for section links.
