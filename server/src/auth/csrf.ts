import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { refreshCookieName, sessionCookieName } from "./tokens";

/**
 * CSRF defense for the cookie-authenticated API (F3, double-submit cookie).
 *
 * The session cookie is SameSite=None (Vercel origin → Render origin is
 * cross-site, so Lax/Strict would silently break authentication). CORS alone
 * cannot stop simple cross-site form POSTs, so state-changing requests need
 * an explicit proof the browser had to read first: the client sends the
 * `meronote_csrf` cookie value back in the `x-csrf-token` header, which an
 * attacker-controlled origin can neither read (same-origin policy + CORS)
 * nor reproduce in a plain form/navigation request (custom headers need a
 * CORS preflight the API never grants to untrusted origins).
 *
 * Rules:
 * - Tokens are 256-bit crypto-random, unrelated to the JWT, never logged.
 * - The CSRF cookie is readable client-side (never HttpOnly); the session
 *   cookie stays HttpOnly. Cookie attributes mirror the session cookie.
 * - Only state-changing methods are checked; GET/HEAD/OPTIONS pass through.
 * - Requests without a session cookie carry no victim session, so there is
 *   nothing to forge — they pass (logout stays idempotent when anonymous).
 * - Failure is 403 (never 401): the session may be perfectly valid, so F2
 *   401-invalidation must not trigger.
 */

export const CSRF_COOKIE = "meronote_csrf";
export const CSRF_HEADER = "x-csrf-token";
const TOKEN_BYTES = 32;

export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

/** Issue (or rotate) the CSRF cookie; returns the token for convenience. */
export function issueCsrfToken(res: Response): string {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: "/",
  });
  return token;
}

/** Remove the CSRF cookie (logout hygiene). */
export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: false,
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: "/",
  });
}

function tokensMatch(headerToken: string, cookieToken: string): boolean {
  const a = Buffer.from(headerToken, "utf8");
  const b = Buffer.from(cookieToken, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeOrigin(value: string): string {
  return value.endsWith("/") && value.length > 1 ? value.slice(0, -1) : value;
}

/**
 * Defense in depth: when a browser sends Origin, it must be this app's
 * frontend origin. Absent Origin (non-browser clients, test scripts) falls
 * through to the token check. Exact match against CLIENT_URL after trailing
 * slash normalization — previews/aliens never match.
 */
function originAllowed(req: Request): boolean {
  const origin: unknown = req.headers.origin;
  if (origin === undefined) return true;
  if (typeof origin !== "string" || !origin) return false;
  return normalizeOrigin(origin) === normalizeOrigin(env.clientUrl);
}

/** True when the request carries a valid double-submit CSRF proof. */
export function hasValidCsrfProof(req: Request): boolean {
  const cookieToken: unknown = req.cookies?.[CSRF_COOKIE];
  const headerToken: unknown = req.headers[CSRF_HEADER];
  if (typeof cookieToken !== "string" || !cookieToken) return false;
  if (typeof headerToken !== "string" || !headerToken) return false;
  if (!originAllowed(req)) return false;
  return tokensMatch(headerToken, cookieToken);
}

/**
 * Enforce CSRF proof on state-changing requests that carry credentials.
 * Mount AFTER requireAuth on authenticated routers (so dead sessions still
 * 401 first), or standalone on logout/refresh (anonymous callers pass: no
 * victim credential exists to forge).
 *
 * F4: both the session cookie and the refresh cookie count as victim
 * credentials — the skip applies only when neither is present.
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const method = (req.method || "").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    next();
    return;
  }
  const session: unknown = req.cookies?.[sessionCookieName()];
  const refresh: unknown = req.cookies?.[refreshCookieName()];
  const hasSession = typeof session === "string" && session.length > 0;
  const hasRefresh = typeof refresh === "string" && refresh.length > 0;
  if (!hasSession && !hasRefresh) {
    next();
    return;
  }
  if (!hasValidCsrfProof(req)) {
    res.status(403).json({ status: "error", message: "Invalid CSRF token." });
    return;
  }
  next();
}
