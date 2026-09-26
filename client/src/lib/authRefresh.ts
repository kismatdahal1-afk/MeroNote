/**
 * Single-flight session refresh (F4).
 *
 * When the short-lived access JWT expires, any number of concurrent 401s
 * share ONE POST /api/auth/refresh operation instead of racing the
 * one-time-use refresh token against each other. The server rotates the
 * token and returns the SafeUser identity; each caller still applies its
 * own currency checks (F2 generation / request-id guards) before writing
 * state, so a stale refresh completion can never resurrect an old user.
 *
 * Rules:
 * - Raw fetch only (never useApiQuery/authApi.request): the refresh call
 *   itself must not trigger another refresh — no recursion, no loops.
 * - Throws AuthError with the real status: 401 means the session is truly
 *   dead (callers invalidate); anything else propagates untouched.
 * - No token ever touches JS state, storage, or logs beyond this module's
 *   transient promise (HttpOnly cookies carry both credentials).
 */

import { AuthError, type AuthUser } from "./authApi";
import { csrfHeaders } from "./csrf";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

let pendingRefresh: Promise<AuthUser> | null = null;

async function doRefresh(): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      // F3 proof rides along: refresh is a cookie-authenticated mutation.
      headers: { "content-type": "application/json", ...(await csrfHeaders("POST")) },
      body: "{}",
    });
  } catch {
    throw new AuthError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { data?: AuthUser; message?: string };
  if (!res.ok) {
    throw new AuthError(
      res.status,
      typeof json.message === "string" && json.message ? json.message : "Something went wrong.",
    );
  }
  const user = json.data;
  if (!user || typeof user.id !== "string") {
    throw new AuthError(500, "Something went wrong.");
  }
  return user;
}

/** Shared refresh operation: concurrent callers await the same rotation. */
export function refreshSession(): Promise<AuthUser> {
  if (!pendingRefresh) {
    pendingRefresh = doRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}
