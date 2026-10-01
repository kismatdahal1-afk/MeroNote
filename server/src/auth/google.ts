import crypto from "crypto";
import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";

/**
 * Google OAuth provider logic (Step 4: backend authorization-code flow).
 *
 * Google only proves identity. The MeroNote session is issued separately
 * via `issueSession` in auth.controller.ts — Google never becomes the
 * session mechanism, and no Google token is ever stored, logged, or
 * returned to the client.
 */

const STATE_BYTES = 32;
/** OAuth state lifetime: short — the callback must arrive within minutes. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/** Minimum identity scopes: OpenID + verified email + display name/photo. */
export const GOOGLE_SCOPES = ["openid", "email", "profile"] as const;

/** Single-use OAuth state cookie, scoped to the callback path. */
export const OAUTH_STATE_COOKIE = "meronote_oauth_state";

export interface GoogleIdentity {
  /** Google stable subject identifier → MeroNote `googleId`. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/** True when all three Google variables are configured. */
export function googleOAuthEnabled(): boolean {
  return Boolean(env.googleClientId && env.googleClientSecret && env.googleCallbackUrl);
}

function newOAuthClient(): OAuth2Client {
  return new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleCallbackUrl);
}

/** Authorization URL for `GET /api/auth/google`. Exact configured callback. */
export function buildGoogleAuthUrl(state: string): string {
  return newOAuthClient().generateAuthUrl({
    access_type: "online",
    scope: [...GOOGLE_SCOPES],
    state,
  });
}

function stateCookieFlags(): { httpOnly: true; sameSite: "none" | "lax"; secure: boolean; path: string } {
  return {
    httpOnly: true,
    // The callback is a cross-site GET from Google: production requires
    // None+Secure, mirroring the existing auth cookie ternaries.
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: "/api/auth/google/callback",
  };
}

/** Mint a fresh opaque state and bind it to this browser via cookie. */
export function issueOAuthState(res: Response): string {
  const state = crypto.randomBytes(STATE_BYTES).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, { ...stateCookieFlags(), maxAge: STATE_MAX_AGE_MS });
  return state;
}

export function readOAuthState(req: Request): string {
  const value: unknown = req.cookies?.[OAUTH_STATE_COOKIE];
  return typeof value === "string" ? value : "";
}

/** Single-use: consume (clear) before exchanging the authorization code. */
export function clearOAuthState(res: Response): void {
  res.clearCookie(OAUTH_STATE_COOKIE, stateCookieFlags());
}

/** Exchange the authorization code for tokens. Returns the ID token only. */
export async function exchangeGoogleCode(code: string): Promise<string> {
  const { tokens } = await newOAuthClient().getToken(code);
  const idToken = tokens.id_token;
  if (!idToken) throw new Error("Google did not return an identity token.");
  return idToken;
}

/**
 * Cryptographically verify the Google ID token (signature via Google certs,
 * audience, expiry, issuer — handled by the library) and extract identity.
 * Never trust browser-supplied identity fields; everything comes from here.
 */
export async function verifyGoogleIdentity(idToken: string): Promise<GoogleIdentity> {
  const ticket = await newOAuthClient().verifyIdToken({ idToken, audience: env.googleClientId });
  const payload = ticket.getPayload();
  const sub = payload?.sub;
  const email = payload?.email;
  if (!payload || typeof sub !== "string" || !sub || typeof email !== "string" || !email) {
    throw new Error("Invalid Google identity.");
  }
  const name = typeof payload.name === "string" ? payload.name : "";
  const picture = typeof payload.picture === "string" && payload.picture ? payload.picture : undefined;
  return { sub, email, emailVerified: payload.email_verified === true, name, picture };
}
