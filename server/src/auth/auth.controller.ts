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
import {
  buildGoogleAuthUrl,
  clearOAuthState,
  exchangeGoogleCode,
  googleOAuthEnabled,
  issueOAuthState,
  readOAuthState,
  verifyGoogleIdentity,
} from "./google";
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
  /** Google profile image URL when the account has one; omitted otherwise. */
  profileImageUrl?: string;
}

function toSafeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  profileImageUrl?: string;
}): SafeUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.profileImageUrl ? { profileImageUrl: user.profileImageUrl } : {}),
  };
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

/**
 * Issue the full MeroNote session after identity is proven (Step 4: shared
 * by password login/register and Google OAuth callback).
 *
 * Performs the existing session creation work in the existing order:
 * short-lived access JWT cookie + fresh CSRF token + fresh refresh family.
 * Throws on refresh-storage failure; callers map that to 500 without
 * claiming success (the access session stays usable on retry).
 */
export async function issueSession(
  res: Response,
  userId: string,
  role: "USER" | "ADMIN",
  sessionVersion: number,
  lifetimeDays: number,
): Promise<void> {
  // F1: stamp the current session epoch into the access JWT.
  setSessionCookie(res, userId, role, sessionVersion);
  // Fresh CSRF token per session (rotates any pre-login value).
  issueCsrfToken(res);
  await attachRefreshFamily(res, userId, sessionVersion, lifetimeDays);
}

function readString(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function register(req: Request, res: Response): Promise<void> {
  const name = readString(req.body, "name");
  const email = readString(req.body, "email").toLowerCase();
  const password = readString(req.body, "password");
  const confirmPassword = readString(req.body, "confirmPassword");

  // Display name is client-supplied and required (same limits as the user
  // model and profile edit). readString already trims and rejects
  // non-strings, so missing/empty/whitespace-only values land here as "".
  if (!name) {
    res.status(400).json({ status: "error", message: "Name cannot be empty." });
    return;
  }
  if (name.length > 80) {
    res.status(400).json({ status: "error", message: "Name must be at most 80 characters." });
    return;
  }
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
  // Registration has no remember-me UI: default refresh lifetime. A storage
  // failure here must not hang (unwrapped async handler) nor claim success:
  // the access session stays usable and a later refresh attempt re-reports.
  try {
    await issueSession(res, String(user._id), "USER", user.sessionVersion ?? 0, env.jwtExpiresDays);
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
  // Step 3: passwordHash is optional (Google-only accounts have none) — a
  // Google account on the password path fails cleanly with generic 401.
  if (!user || !(await verifyPassword(password, user.passwordHash ?? ""))) {
    fail();
    return;
  }

  // F1: stamp the current session epoch into the access JWT.
  // Long-lived duration lives here: normal login 7d, remember-me 30d. Same
  // hang/success honesty as register above on storage failure.
  try {
    await issueSession(res, String(user._id), user.role, user.sessionVersion ?? 0, remember ? rememberMeDays() : env.jwtExpiresDays);
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

/**
 * Google OAuth (Step 4: backend authorization-code flow).
 *
 * Google only proves identity. Afterwards the SAME MeroNote session is
 * issued via `issueSession` — no parallel session system, no Google token
 * stored/logged/returned. Frontend wiring belongs to a later step.
 */

/** Allowlisted failure codes for the `?error=` login redirect (no open redirect). */
const GOOGLE_FAILURE_CODES = [
  "google_denied",
  "google_failed",
  "google_invalid_state",
  "google_unverified_email",
  "google_email_registered",
  "google_conflict",
] as const;

type GoogleFailureCode = (typeof GOOGLE_FAILURE_CODES)[number];

function frontendBase(): string {
  return env.clientUrl.replace(/\/+$/, "");
}

function googleFail(res: Response, code: GoogleFailureCode): void {
  res.redirect(302, `${frontendBase()}/login?error=${code}`);
}

function googlePicture(value: string | undefined): string | undefined {
  if (!value || value.length > 2048) return undefined;
  try {
    if (new URL(value).protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return value;
}

/**
 * GET /api/auth/google — start the OAuth flow (public).
 *
 * Validates configuration, binds a fresh single-use state to this browser
 * via cookie, and redirects to Google. Requests only openid/email/profile.
 */
export function googleAuth(_req: Request, res: Response): void {
  if (!googleOAuthEnabled()) {
    res.status(503).json({ status: "error", message: "Google sign-in is not available right now." });
    return;
  }
  const state = issueOAuthState(res);
  res.redirect(302, buildGoogleAuthUrl(state));
}

/**
 * GET /api/auth/google/callback — finish the OAuth flow (public, no
 * requireAuth/requireCsrf: Google redirects here cross-site without any
 * MeroNote credential, and the single-use state cookie is the CSRF proof).
 */
export async function googleCallback(req: Request, res: Response): Promise<void> {
  const denied = typeof req.query.error === "string" && req.query.error ? req.query.error : "";
  if (denied) {
    // User denied access (or Google refused): state is spent, never reused.
    clearOAuthState(res);
    googleFail(res, "google_denied");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const stored = readOAuthState(req);
  // Single-use: consume before anything else, so a replay finds no state.
  clearOAuthState(res);
  if (!code || !state || !stored || state !== stored) {
    googleFail(res, "google_invalid_state");
    return;
  }

  let identity;
  try {
    identity = await verifyGoogleIdentity(await exchangeGoogleCode(code));
  } catch {
    googleFail(res, "google_failed");
    return;
  }

  const email = identity.email.trim().toLowerCase();
  if (!identity.emailVerified || !EMAIL_PATTERN.test(email) || email.length > 254) {
    googleFail(res, "google_unverified_email");
    return;
  }

  // Case A — stable Google identity already known: authenticate, no duplicate.
  const byGoogleId = await User.findOne({ googleId: identity.sub }).exec();
  if (byGoogleId) {
    try {
      await issueSession(res, String(byGoogleId._id), byGoogleId.role, byGoogleId.sessionVersion ?? 0, env.jwtExpiresDays);
    } catch {
      res.status(500).json({ status: "error", message: "Internal server error." });
      return;
    }
    res.redirect(302, `${frontendBase()}/`);
    return;
  }

  const byEmail = await User.findOne({ email }).exec();
  if (byEmail) {
    // Case C — password account: never link/convert. Case D — Google account
    // with a different sub: never reassign the ID. Reject, account untouched.
    googleFail(res, byEmail.googleId ? "google_conflict" : "google_email_registered");
    return;
  }

  // Case B — new Google user: one normal MeroNote document, no password.
  const fallbackName = email.split("@")[0] ?? "";
  const name = (identity.name.trim() || fallbackName || "Student").slice(0, 80);
  const picture = googlePicture(identity.picture);
  let user;
  try {
    user = await User.create({
      name,
      email,
      authProvider: "google",
      googleId: identity.sub,
      ...(picture ? { profileImageUrl: picture } : {}),
      role: "USER",
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      // Lost a creation race (same sub or same email): re-resolve by the
      // stable Google identity instead of creating a duplicate.
      const raced = await User.findOne({ googleId: identity.sub }).exec();
      if (raced && raced.email === email) {
        try {
          await issueSession(res, String(raced._id), raced.role, raced.sessionVersion ?? 0, env.jwtExpiresDays);
        } catch {
          res.status(500).json({ status: "error", message: "Internal server error." });
          return;
        }
        res.redirect(302, `${frontendBase()}/`);
        return;
      }
      googleFail(res, "google_conflict");
      return;
    }
    throw err;
  }

  try {
    await issueSession(res, String(user._id), user.role, user.sessionVersion ?? 0, env.jwtExpiresDays);
  } catch {
    res.status(500).json({ status: "error", message: "Internal server error." });
    return;
  }
  res.redirect(302, `${frontendBase()}/`);
}
