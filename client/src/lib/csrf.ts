/**
 * Double-submit CSRF helper (F3).
 *
 * The server sets a readable `meronote_csrf` cookie (rotated on login /
 * register, bootstrappable via GET /api/auth/csrf). Every cookie-
 * authenticated state-changing request (POST/PUT/PATCH/DELETE) sends that
 * value back in the `x-csrf-token` header. A cross-site form or navigation
 * cannot read the cookie value, so the session cookie alone is no longer
 * sufficient to mutate server state.
 *
 * Rules:
 * - The cookie is the single source of truth — read fresh per request, never
 *   cached, so concurrent tabs can never disagree after a rotation.
 * - The bootstrap endpoint is hit only when the cookie is absent (first-ever
 *   visit, cleared storage, pre-rollout session); concurrent callers share
 *   the single in-flight bootstrap so they can never disagree on the token.
 * - GET/HEAD/OPTIONS (and unknown methods) yield no header.
 * - Never throws: without a token the request simply goes out header-less
 *   and the server decides (read-only requests are unaffected).
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export const CSRF_COOKIE = "meronote_csrf";
export const CSRF_HEADER = "x-csrf-token";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      return value || null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Current CSRF token: cookie first, public bootstrap when absent. */
export async function getCsrfToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  return sharedBootstrap();
}

/**
 * Single in-flight bootstrap shared by concurrent callers. Without this,
 * N simultaneous mutations on a missing cookie would issue N tokens and
 * last-writer-wins the cookie — every request but one would then 403
 * against its own stale body token (e.g. the post-rollout hydration
 * storm: session alive, CSRF cookie absent, merge PUTs firing together).
 */
let pendingBootstrap: Promise<string | null> | null = null;

async function sharedBootstrap(): Promise<string | null> {
  if (!pendingBootstrap) {
    pendingBootstrap = fetchBootstrap().finally(() => {
      pendingBootstrap = null;
    });
  }
  return pendingBootstrap;
}

async function fetchBootstrap(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/csrf`, { credentials: "include" });
    if (!res.ok) return readCookie(CSRF_COOKIE);
    const json = (await res.json().catch(() => null)) as { data?: { csrfToken?: unknown } } | null;
    const token = json?.data?.csrfToken;
    if (typeof token === "string" && token) return token;
    return readCookie(CSRF_COOKIE);
  } catch {
    return readCookie(CSRF_COOKIE);
  }
}

/** Extra headers for a request init: CSRF proof for mutating methods only. */
export async function csrfHeaders(method: string | undefined): Promise<Record<string, string>> {
  if (!method || !MUTATING_METHODS.has(method.toUpperCase())) return {};
  const token = await getCsrfToken();
  return token ? { [CSRF_HEADER]: token } : {};
}
