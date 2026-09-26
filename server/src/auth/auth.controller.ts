import type { Request, Response } from "express";
import { User } from "../models";
import { hashPassword, verifyPassword } from "./password";
import {
  accessTokenMinutes,
  refreshCookieName,
  rememberMeDays,
  sessionCookieName,
  signSessionToken,
  verifySessionToken,
  type SessionClaims,
} from "./tokens";
import {
  consumeRefreshToken,
  findRefreshTokenOwner,
  issueRefreshToken,
  newRefreshFamilyId,
  revokeUserRefreshFamilies,
} from "./refresh";
import { clearCsrfCookie, issueCsrfToken } from "./csrf";
import { env } from "../config/env";

/**
 * Auth endpoints: register / login / logout / me / refresh.
 *
 * F4 lifecycle: the session cookie holds a short-lived access JWT (minutes);
 * login duration lives in the rotating opaque refresh token (HttpOnly
 * `meronote_refresh` cookie, SHA-256 hashes in MongoDB). Login/register mint
 * a fresh family; refresh rotates one-time-use records; logout bumps the F1
 * epoch AND revokes every family, so neither credential can resurrect the
 * session.
 *
 * Conventions:
 * - Register always creates USER (admin promotion is a guarded dev script).
 * - Login failures return one generic message (no user enumeration).
 * - passwordHash is never selected except for the login comparison and is
 *   never present in any response. Passwords/tokens are never logged.
 * - Raw refresh tokens never appear in JSON, logs, or the database.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

function toSafeUser(user: { _id: unknown; name: string; email: string; role: "USER" | "ADMIN" }): SafeUser {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

function setSessionCookie(res: Response, userId: string, role: "USER" | "ADMIN", version: number): void {
  const token = signSessionToken({ sub: userId, role, v: version }, accessTokenMinutes());
  res.cookie(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: accessTokenMinutes() * 60 * 1000,
  });
}

function setRefreshCookie(res: Response, rawToken: string, expiresAt: Date): void {
  res.cookie(refreshCookieName(), rawToken, {
    httpOnly: true,
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(refreshCookieName(), {
    httpOnly: true,
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: "/",
  });
}

/** Mint + attach a fresh refresh family for a new authenticated transition. */
async function attachRefreshFamily(
  res: Response,
  userId: string,
  sessionVersion: number,
  lifetimeDays: number,
): Promise<void> {
  const { raw, expiresAt } = await issueRefreshToken({ userId, familyId: newRefreshFamilyId(), sessionVersion, lifetimeDays });
  setRefreshCookie(res, raw, expiresAt);
}

function readString(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function register(req: Request, res: Response): Promise<void> {
  const email = readString(req.body, "email").toLowerCase();
  const password = readString(req.body, "password");
  const confirmPassword = readString(req.body, "confirmPassword");

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    res.status(400).json({ status: "error", message: "Enter a valid email address." });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ status: "error", message: "Password must be at least 8 characters." });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ status: "error", message: "Passwords do not match." });
    return;
  }

  const existing = await User.findOne({ email }).exec();
  if (existing) {
    res.status(409).json({ status: "error", message: "An account with this email already exists." });
    return;
  }

  // Display name defaults to the email local-part; editable in Settings.
  const name = email.split("@")[0].slice(0, 80) || "Student";
  let user;
  try {
    user = await User.create({ name, email, passwordHash: await hashPassword(password), role: "USER" });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ status: "error", message: "An account with this email already exists." });
      return;
    }
    throw err;
  }

  // F1: stamp the current session epoch into the access JWT.
  setSessionCookie(res, String(user._id), "USER", user.sessionVersion ?? 0);
  // Fresh CSRF token per session (rotates any pre-login value).
  issueCsrfToken(res);
  // Registration has no remember-me UI: default refresh lifetime. A storage
  // failure here must not hang (unwrapped async handler) nor claim success:
  // the access session stays usable and a later refresh attempt re-reports.
  try {
    await attachRefreshFamily(res, String(user._id), user.sessionVersion ?? 0, env.jwtExpiresDays);
  } catch {
    res.status(500).json({ status: "error", message: "Internal server error." });
    return;
  }
  res.status(201).json({ status: "ok", data: toSafeUser(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const email = readString(req.body, "email").toLowerCase();
  const password = readString(req.body, "password");
  const remember = (req.body as Record<string, unknown> | null)?.remember === true;

  const fail = (): void => {
    res.status(401).json({ status: "error", message: "Invalid email or password." });
  };

  if (!EMAIL_PATTERN.test(email) || !password) {
    fail();
    return;
  }

  const user = await User.findOne({ email }).select("+passwordHash").exec();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    fail();
    return;
  }

  // F1: stamp the current session epoch into the access JWT.
  setSessionCookie(res, String(user._id), user.role, user.sessionVersion ?? 0);
  // Fresh CSRF token per session (rotates any pre-login value).
  issueCsrfToken(res);
  // Long-lived duration lives here: normal login 7d, remember-me 30d. Same
  // hang/success honesty as register above on storage failure.
  try {
    await attachRefreshFamily(res, String(user._id), user.sessionVersion ?? 0, remember ? rememberMeDays() : env.jwtExpiresDays);
  } catch {
    res.status(500).json({ status: "error", message: "Internal server error." });
    return;
  }
  res.json({ status: "ok", data: toSafeUser(user) });
}

/**
 * POST /api/auth/refresh — rotate the refresh token (CSRF-guarded route).
 *
 * 1. Read the opaque token from its HttpOnly cookie (generic 401 if absent).
 * 2. Atomically consume it: exactly one concurrent request can win.
 * 3. Reuse/expiry/unknown hash → family revoked where applicable, generic 401.
 * 4. Winner with live user + current F1 epoch → fresh short-lived access JWT
 *    + child refresh token, SafeUser body. No raw token ever in JSON.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const denied = (): void => {
    res.status(401).json({ status: "error", message: "Authentication required." });
  };
  const raw: unknown = req.cookies?.[refreshCookieName()];
  if (typeof raw !== "string" || !raw) {
    denied();
    return;
  }
  let result;
  try {
    result = await consumeRefreshToken(raw);
  } catch {
    res.status(500).json({ status: "error", message: "Internal server error." });
    return;
  }
  if (result.status !== "rotated") {
    denied();
    return;
  }
  let user;
  try {
    user = await User.findById(result.userId).exec();
  } catch {
    res.status(500).json({ status: "error", message: "Internal server error." });
    return;
  }
  if (!user) {
    denied();
    return;
  }
  // F1: the rotated access JWT carries the live session epoch.
  setSessionCookie(res, String(user._id), user.role, user.sessionVersion ?? 0);
  setRefreshCookie(res, result.newRaw, result.newExpiresAt);
  res.json({ status: "ok", data: toSafeUser(user) });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const clearAll = (): void => {
    res.clearCookie(sessionCookieName(), {
      httpOnly: true,
      sameSite: env.nodeEnv === "production" ? "none" : "lax",
      secure: env.nodeEnv === "production",
      path: "/",
    });
    clearRefreshCookie(res);
    clearCsrfCookie(res);
  };

  // Identify the session owner: live access claims first, refresh record as
  // fallback (expired access must still revoke its refresh family — otherwise
  // an orphaned active record would linger until expiry).
  const sessionToken: unknown = req.cookies?.[sessionCookieName()];
  let claims: SessionClaims | null = null;
  if (typeof sessionToken === "string" && sessionToken) {
    try {
      claims = verifySessionToken(sessionToken);
    } catch {
      claims = null;
    }
  }

  let userId: string | null = claims ? claims.sub : null;
  if (!userId) {
    const refreshRaw: unknown = req.cookies?.[refreshCookieName()];
    if (typeof refreshRaw === "string" && refreshRaw) {
      try {
        userId = await findRefreshTokenOwner(refreshRaw);
      } catch {
        userId = null;
      }
    }
  }

  if (!userId) {
    // No identifiable credential: nothing server-side to invalidate.
    clearAll();
    res.json({ status: "ok", message: "Logged out." });
    return;
  }

  if (claims) {
    // F1: kill every access JWT of this user. A DB failure must not pretend
    // success while the old tokens stay valid — no cookie is cleared.
    try {
      await User.updateOne({ _id: claims.sub }, { $inc: { sessionVersion: 1 } }).exec();
    } catch {
      res.status(500).json({ status: "error", message: "Internal server error." });
      return;
    }
  }

  // F4: kill every refresh family of this user. Same failure safety: a live
  // refresh token could otherwise mint a fresh access JWT after logout.
  try {
    await revokeUserRefreshFamilies(userId);
  } catch {
    res.status(500).json({ status: "error", message: "Internal server error." });
    return;
  }

  clearAll();
  res.json({ status: "ok", message: "Logged out." });
}

/**
 * GET /api/auth/csrf — public CSRF bootstrap (no session required).
 *
 * Sets the readable `meronote_csrf` cookie and returns its value. Clients
 * read the cookie per mutating request; this endpoint covers first-ever
 * visits, cleared cookies, and sessions created before this rollout.
 * Issues no session and authenticates nothing.
 */
export function getCsrfToken(_req: Request, res: Response): void {
  const csrfToken = issueCsrfToken(res);
  res.json({ status: "ok", data: { csrfToken } });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ status: "error", message: "Authentication required." });
    return;
  }
  const user = await User.findById(req.user.id).exec();
  if (!user) {
    res.status(401).json({ status: "error", message: "Authentication required." });
    return;
  }
  res.json({ status: "ok", data: toSafeUser(user) });
}

/**
 * PATCH /api/auth/me — Edit Profile (name only).
 *
 * Updates ONLY the authenticated user's display name in the `users`
 * collection. The email is immutable here: even if the client sends an
 * `email` field (manipulated request), it is ignored and never written.
 * Ownership always derives from req.user (never from client userId), so
 * another user's profile can never be affected.
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ status: "error", message: "Authentication required." });
    return;
  }
  const name = readString(req.body, "name");
  if (!name) {
    res.status(400).json({ status: "error", message: "Name cannot be empty." });
    return;
  }
  if (name.length > 80) {
    res.status(400).json({ status: "error", message: "Name must be at most 80 characters." });
    return;
  }

  // NOTE: only `name` is written. Any `email` (or other) field in the
  // request body is deliberately ignored to keep the email immutable.
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { name } },
    { returnDocument: "after", runValidators: true },
  ).exec();
  if (!user) {
    res.status(401).json({ status: "error", message: "Authentication required." });
    return;
  }
  res.json({ status: "ok", data: toSafeUser(user) });
}
