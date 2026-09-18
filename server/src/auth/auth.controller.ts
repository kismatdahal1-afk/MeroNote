import type { Request, Response } from "express";
import { User } from "../models";
import { hashPassword, verifyPassword } from "./password";
import { rememberMeDays, sessionCookieName, signSessionToken } from "./tokens";
import { env } from "../config/env";

/**
 * Auth endpoints: register / login / logout / me.
 *
 * Conventions:
 * - Register always creates USER (admin promotion is a guarded dev script).
 * - Login failures return one generic message (no user enumeration).
 * - passwordHash is never selected except for the login comparison and is
 *   never present in any response. Passwords/tokens are never logged.
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

function setSessionCookie(res: Response, userId: string, role: "USER" | "ADMIN", remember: boolean): void {
  const days = remember ? rememberMeDays() : env.jwtExpiresDays;
  const token = signSessionToken({ sub: userId, role }, days);
  res.cookie(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: days * 24 * 60 * 60 * 1000,
  });
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

  setSessionCookie(res, String(user._id), "USER", false);
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

  setSessionCookie(res, String(user._id), user.role, remember);
  res.json({ status: "ok", data: toSafeUser(user) });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(sessionCookieName(), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
  });
  res.json({ status: "ok", message: "Logged out." });
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
