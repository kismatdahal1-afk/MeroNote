/**
 * Frontend Google OAuth entry (Step 6: redirect-based flow).
 *
 * The browser only navigates to the backend OAuth endpoint — the backend
 * owns authorization, state, code exchange, identity verification, and the
 * session. No Google SDK, no client secret, no token handling here.
 * Error codes below mirror the backend allowlist in
 * `server/src/auth/auth.controller.ts` (GOOGLE_FAILURE_CODES).
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

/** Backend Google OAuth entry point — the only URL the frontend needs. */
export function googleOAuthUrl(): string {
  return `${API_URL}/api/auth/google`;
}

/** Backend OAuth failure codes the frontend knows how to explain. */
export const GOOGLE_ERROR_CODES = [
  "google_denied",
  "google_failed",
  "google_invalid_state",
  "google_unverified_email",
  "google_email_registered",
  "google_conflict",
] as const;

export type GoogleErrorCode = (typeof GOOGLE_ERROR_CODES)[number];

const GOOGLE_ERROR_MESSAGES: Record<GoogleErrorCode, string> = {
  google_denied: "Google sign-in was cancelled. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_invalid_state: "Your Google sign-in session expired. Please try again.",
  google_unverified_email: "Your Google email address is not verified. Please verify it with Google and try again.",
  google_email_registered: "This email is already registered. Please log in with your password.",
  google_conflict: "This Google account can't be used with your MeroNote account. Please try a different account.",
};

/** User-facing message for a backend `?error=` code, or null when unknown. */
export function googleErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return (GOOGLE_ERROR_MESSAGES as Record<string, string>)[code] ?? null;
}
