/**
 * Minimal typed client for the Phase 3 session API.
 * Cookies carry the session (HttpOnly) — every request uses
 * credentials:"include" and no token is ever stored client-side.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "content-type": "application/json" },
      ...init,
    });
  } catch {
    throw new AuthError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; message?: string };
  if (!res.ok) {
    throw new AuthError(res.status, typeof json.message === "string" && json.message ? json.message : "Something went wrong.");
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

export function registerRequest(email: string, password: string, confirmPassword: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, confirmPassword }),
  });
}

export function logoutRequest(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}
