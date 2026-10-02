/**
 * Step 5 OTP registration flow helpers (UI-only, no network).
 *
 * Only the *pending email* (non-sensitive routing context) may touch browser
 * storage so an OTP-page refresh can recover gracefully. The password, the
 * OTP, and every token are never stored, never placed in URLs, and never
 * logged — the backend pending record already holds the bcrypt password hash.
 */

export const OTP_LENGTH = 6;
export const INITIAL_RESEND_COOLDOWN_SECONDS = 60;
/** OTP validity window in seconds (UX display only; the backend enforces it). */
export const OTP_VALIDITY_SECONDS = 120;

/** sessionStorage key for the pending verification email (non-sensitive). */
const PENDING_EMAIL_KEY = "meronote_pending_email";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function savePendingEmail(email: string): void {
  try {
    storage()?.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // Storage unavailable — location state still carries the email.
  }
}

export function readPendingEmail(): string {
  try {
    return storage()?.getItem(PENDING_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingEmail(): void {
  try {
    storage()?.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Nothing to clean.
  }
}

/** `true` for exactly 6 ASCII digits (client pre-check; backend is authoritative). */
export function isValidOtpFormat(otp: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp);
}

/** Format a countdown as MM:SS (clamped at zero; UX display only). */
export function formatCountdownMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Mask an email for display (`k***@gmail.com`). Never used for lookups —
 * the full email is sent to the API.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const shown = local.slice(0, 1);
  return `${shown}***@${domain}`;
}
