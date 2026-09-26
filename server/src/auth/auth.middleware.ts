import type { NextFunction, Request, Response } from "express";
import { User } from "../models";
import { sessionCookieName, verifySessionToken, type SessionClaims } from "./tokens";

/** Authenticated identity attached by requireAuth. Minimal by design. */
export interface AuthIdentity {
  id: string;
  role: "USER" | "ADMIN";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthIdentity;
    }
  }
}

/**
 * requireAuth: valid session cookie → req.user, else 401.
 * Role is always re-read from the database (never trusts token claims alone).
 * F1: the JWT session version must still match users.sessionVersion —
 * logout bumps the epoch, so replayed pre-logout tokens fail here with 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token: unknown = req.cookies?.[sessionCookieName()];
    if (typeof token !== "string" || !token) {
      res.status(401).json({ status: "error", message: "Authentication required." });
      return;
    }
    let claims: SessionClaims;
    try {
      claims = verifySessionToken(token);
    } catch {
      res.status(401).json({ status: "error", message: "Authentication required." });
      return;
    }
    const user = await User.findById(claims.sub).exec();
    if (!user) {
      res.status(401).json({ status: "error", message: "Authentication required." });
      return;
    }
    // F1: reject tokens from a superseded session epoch (e.g. logged out
    // elsewhere). Generic 401 — never populated into req.user.
    const dbVersion = user.sessionVersion ?? 0;
    if (claims.v !== dbVersion) {
      res.status(401).json({ status: "error", message: "Authentication required." });
      return;
    }
    req.user = { id: String(user._id), role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

/** requireAdmin: ADMIN only (implies requireAuth first). USER gets 403. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ status: "error", message: "Authentication required." });
    return;
  }
  if (req.user.role !== "ADMIN") {
    res.status(403).json({ status: "error", message: "Admin access required." });
    return;
  }
  next();
}
