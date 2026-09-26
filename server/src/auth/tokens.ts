import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Session tokens (JWT/HMAC — ratified Phase 3 decision).
 * Carried in an HttpOnly cookie, never in localStorage, never logged.
 *
 * F4 lifecycle: the access JWT is short-lived (minutes). Long-lived login
 * duration belongs to the rotating opaque refresh token (see refresh.ts),
 * whose lifetime comes from the remember-me/default day knobs below.
 */

const SESSION_COOKIE = "meronote_session";
const REFRESH_COOKIE = "meronote_refresh";
/** Short-lived access window (minutes): bounds replay, refreshes transparently. */
const ACCESS_TOKEN_MINUTES = 15;
/** Refresh lifetime (days) for "Remember me" logins. */
const REMEMBER_ME_DAYS = 30;

export interface SessionClaims {
  sub: string;
  role: "USER" | "ADMIN";
  /** F1 session epoch, stamped at issuance from users.sessionVersion. */
  v: number;
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function refreshCookieName(): string {
  return REFRESH_COOKIE;
}

export function accessTokenMinutes(): number {
  return ACCESS_TOKEN_MINUTES;
}

export function rememberMeDays(): number {
  return REMEMBER_ME_DAYS;
}

function requireSecret(): string {
  if (!env.jwtSecret) {
    throw new Error(
      "JWT_SECRET is not set. Copy server/.env.example to server/.env and set JWT_SECRET (never commit secrets).",
    );
  }
  return env.jwtSecret;
}

export function signSessionToken(claims: SessionClaims, expiresInMinutes: number): string {
  return jwt.sign(claims, requireSecret(), { expiresIn: `${expiresInMinutes}m` });
}

export function verifySessionToken(token: string): SessionClaims {
  const decoded = jwt.verify(token, requireSecret());
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid session token.");
  }
  const { sub, role, v } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || (role !== "USER" && role !== "ADMIN")) {
    throw new Error("Invalid session claims.");
  }
  // F1 safe deployment: tokens minted before the v claim existed behave as v=0.
  const version = typeof v === "number" ? v : 0;
  return { sub, role, v: version };
}
