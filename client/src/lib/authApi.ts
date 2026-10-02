/**
 * Minimal typed client for the Phase 3 session API.
 * Cookies carry the session (HttpOnly) — every request uses
 * credentials:"include" and no token is ever stored client-side.
 *
 * CSRF (F3): login/register are pre-session bootstrap calls and stay
 * exempt; the authenticated calls (logout, profile edit) attach the
 * double-submit proof via `csrf: true`.
 */

import { csrfHeaders } from "./csrf";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  /** Google profile image URL when the account has one; absent otherwise. */
  profileImageUrl?: string;
}

export class AuthError extends Error {
  status: number;
  /** Backend-provided resend/retry wait (seconds) on 429s; absent otherwise. */
  retryAfterSeconds?: number;
  /** Backend-provided OTP attempts remaining on 400s; absent otherwise. */
  attemptsLeft?: number;

  constructor(status: number, message: string, extra?: { retryAfterSeconds?: number; attemptsLeft?: number }) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    if (typeof extra?.retryAfterSeconds === "number") this.retryAfterSeconds = extra.retryAfterSeconds;
    if (typeof extra?.attemptsLeft === "number") this.attemptsLeft = extra.attemptsLeft;
  }
}

async function request<T>(path: string, init?: RequestInit, csrf = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "content-type": "application/json", ...(csrf ? await csrfHeaders(init?.method) : {}) },
      ...init,
    });
  } catch {
    throw new AuthError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    message?: string;
    retryAfterSeconds?: unknown;
    attemptsLeft?: unknown;
  };
  if (!res.ok) {
    throw new AuthError(
      res.status,
      typeof json.message === "string" && json.message ? json.message : "Something went wrong.",
      {
        retryAfterSeconds: typeof json.retryAfterSeconds === "number" ? json.retryAfterSeconds : undefined,
        attemptsLeft: typeof json.attemptsLeft === "number" ? json.attemptsLeft : undefined,
      },
    );
  }
  return (json.data ?? json) as T;
}

export function fetchMe(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me");
}

export function loginRequest(email: string, password: string, remember: boolean): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, remember }),
  });
}

export function registerRequest(name: string, email: string, password: string, confirmPassword: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, confirmPassword }),
  });
}

/**
 * Step 5 OTP registration (manual signup only; Google OAuth is untouched).
 * Initiate/resend return `{status,message}` (no session); verify returns the
 * `AuthUser` and sets the normal session cookies, like legacy register.
 * All three stay CSRF-exempt pre-session, like login/register.
 */
export function initiateRegisterRequest(
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>("/api/auth/register/initiate", {
    method: "POST",
    body: JSON.stringify({ name, email, password, confirmPassword }),
  });
}

export function verifyOtpRequest(email: string, otp: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/register/verify", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
}

export function resendOtpRequest(email: string): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>("/api/auth/register/resend", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function logoutRequest(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" }, true);
}

export function updateProfileRequest(name: string): Promise<AuthUser> {
  return request<AuthUser>(
    "/api/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify({ name }),
    },
    true,
  );
}
