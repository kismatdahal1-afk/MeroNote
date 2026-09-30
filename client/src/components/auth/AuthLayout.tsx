import { Link, Outlet, useLocation } from "react-router-dom";
import { useToast } from "../../state/ToastProvider";

const ILLUSTRATION_SRC =
  "https://res.cloudinary.com/gcnv50p7/image/upload/v1790789711/object.png";

type AuthMode = "login" | "signup";

/** Inline Google "G" mark (lucide has no brand icons; no new dependency). */
function GoogleMark() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/** Minimal loading placeholder for the lazily-loaded auth forms. */
export function AuthFormFallback() {
  return (
    <div className="mx-auto w-full max-w-sm" aria-hidden="true">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-surface-muted" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-surface-muted" />
      <div className="mt-6 space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    </div>
  );
}

/**
 * Persistent centered authentication card shell (UI-only).
 * No auth logic, no API calls — purely presentational. Mounted once above the
 * /login and /register routes: 60% locked-height illustration section with a
 * top-anchored copy overlay | 40% auth panel. The illustration never remounts
 * and its box never resizes (no blink) when switching between Login and
 * Sign Up — only the Outlet form content swaps, with a subtle entrance
 * transition. Follows the app theme via tokens, with pinned light-mode tones
 * for the overlay copy and a theme-split card aura.
 */
export function AuthLayout() {
  const { toast } = useToast();
  const { pathname } = useLocation();
  const mode: AuthMode = pathname.startsWith("/register") ? "signup" : "login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[73.5rem]">
        <div className="card-glow grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-border bg-surface dark:border-white/20 shadow-[var(--shadow-card),0_0_80px_-12px_rgba(0,0,0,0.38)] dark:shadow-[var(--shadow-card),0_0_80px_-12px_rgba(255,255,255,0.22)] md:grid-cols-[minmax(0,60fr)_minmax(360px,40fr)] md:min-h-[665px]">
          {/* LEFT — fixed-height illustration section: locked to 665px on
              desktop so Login ↔ Sign Up (or error text) can never resize it */}
          <div className="relative flex h-56 min-w-0 items-stretch justify-center overflow-hidden sm:h-72 md:h-[665px]">
            <img
              src={ILLUSTRATION_SRC}
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              className="block h-full w-full object-cover object-left"
            />
            <div className="absolute inset-x-0 top-0 px-6 pt-4 sm:px-8 sm:pt-8 md:px-10">
              <div key={mode} className="animate-fade-up motion-reduce:animate-none">
                {mode === "login" ? (
                  <>
                    <p className="text-xs font-bold tracking-[0.18em] text-[#5b3df5] sm:text-sm">
                      WELCOME BACK TO MERONOTE
                    </p>
                    <p className="mt-2 hidden text-balance text-2xl font-bold leading-snug tracking-tight text-[#0f172a] sm:block sm:text-3xl">
                      Your CSIT resources, all in one place.
                    </p>
                    <p className="mt-1 text-balance text-xl font-bold leading-snug tracking-tight text-[#0f172a] sm:hidden">
                      CSIT resources, all in one place.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold tracking-[0.18em] text-[#5b3df5] sm:text-sm">
                      WELCOME TO MERONOTE
                    </p>
                    <p className="mt-2 hidden text-balance text-2xl font-bold leading-snug tracking-tight text-[#0f172a] sm:block sm:text-3xl">
                      Start your CSIT learning journey.
                    </p>
                    <p className="mt-1 text-balance text-xl font-bold leading-snug tracking-tight text-[#0f172a] sm:hidden">
                      Start learning with MeroNote.
                    </p>
                  </>
                )}
              </div>
              {/* No transition on the lines below: copy swaps instantly (or is
                  identical) when changing pages. Full versions double as the
                  laptop layout; short justified versions show on mobile only */}
              <p className="mt-2 hidden max-w-lg text-pretty text-sm leading-relaxed text-[#64748b] sm:block sm:text-base">
                {mode === "login"
                  ? "Access your subjects, notes, books, and study resources and continue your learning journey with MeroNote."
                  : "Create your account and keep your subjects, notes, books, and study resources organized in one place."}
              </p>
              <p className="mt-1 max-w-lg text-justify text-xs leading-relaxed text-[#64748b] sm:hidden">
                {mode === "login"
                  ? "Continue learning with MeroNote."
                  : "Create your account and organize your study resources."}
              </p>
              <p className="mt-3 hidden text-xs font-semibold tracking-wide text-[#64748b] sm:block sm:text-sm">
                Subjects • Notes • Books • Resources
              </p>
            </div>
          </div>

          {/* RIGHT — auth content; only this swaps on Login ↔ Sign Up.
              lg:p-8 (not p-10) keeps signup inside the 665px lock */}
          <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-8">
            <div
              key={pathname}
              className="animate-fade-up mx-auto w-full max-w-sm motion-reduce:animate-none"
            >
              <Outlet />

              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold tracking-wide text-muted-foreground">OR</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <button
                type="button"
                onClick={() => toast("Google sign-in is coming soon", "info")}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <GoogleMark />
                {mode === "login" ? "Continue with Google" : "Sign up with Google"}
              </button>

              <p className="mt-5 text-center text-sm font-medium text-muted-foreground">
                {mode === "login" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <Link to="/register" className="font-semibold text-primary hover:underline">
                      Sign Up
                    </Link>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <Link to="/login" className="font-semibold text-primary hover:underline">
                      Login
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-muted-foreground/70">
          <Link to="/" className="hover:underline">
            ← Back to welcome page
          </Link>
        </p>
      </div>
    </div>
  );
}
