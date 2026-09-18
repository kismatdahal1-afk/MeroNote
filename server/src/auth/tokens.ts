import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Session tokens (JWT/HMAC — ratified Phase 3 decision).
 * Carried in an HttpOnly cookie, never in localStorage, never logged.
 */

const SESSION_COOKIE = "meronote_session";
const REMEMBER_ME_DAYS = 30;

export interface SessionClaims {
  sub: string;
  role: "USER" | "ADMIN";
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
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

export function signSessionToken(claims: SessionClaims, expiresInDays: number): string {
  return jwt.sign(claims, requireSecret(), { expiresIn: `${expiresInDays}d` });
}

export function verifySessionToken(token: string): SessionClaims {
  const decoded = jwt.verify(token, requireSecret());
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid session token.");
  }
  const { sub, role } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || (role !== "USER" && role !== "ADMIN")) {
    throw new Error("Invalid session claims.");
  }
  return { sub, role };
}
