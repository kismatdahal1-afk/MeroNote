import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchMe, loginRequest, logoutRequest, registerRequest, updateProfileRequest, type AuthUser } from "../lib/authApi";

/**
 * Session-backed account state (Phase 3).
 * Identity (name/email/role) always comes from the server session backed by
 * the `users` database record — never from local storage. Settings →
 * Edit Profile persists via PATCH /api/auth/me so the name survives
 * refresh, logout/login, and future sessions.
 */

type AuthStatus = "loading" | "authed" | "guest";

interface UserContextValue {
  /** Authenticated user from GET /api/auth/me (null when guest). */
  user: AuthUser | null;
  /** Session resolution state. */
  status: AuthStatus;
  /** Display name (database-backed user.name; "Student" when guest). */
  name: string;
  /** Server email ("" when guest). */
  email: string;
  /** Server role — drives portal access ("USER" when guest). */
  role: "USER" | "ADMIN";
  /** Persist display-name change to the users record + sync user state. */
  setName: (name: string) => Promise<AuthUser>;
  login: (email: string, password: string, remember: boolean) => Promise<AuthUser>;
  register: (email: string, password: string, confirmPassword: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

/** Legacy local-only override key — removed; cleaned up once if present. */
const LEGACY_STORAGE_KEY = "meronote-user-name";

function clearLegacyStoredName(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to clean.
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      setStatus("authed");
    } catch {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    clearLegacyStoredName();
    void refresh();
  }, [refresh]);

  const setName = useCallback(async (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) throw new Error("Name cannot be empty.");
    const updated = await updateProfileRequest(trimmed);
    setUser(updated);
    return updated;
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const authed = await loginRequest(email, password, remember);
    setUser(authed);
    setStatus("authed");
    return authed;
  }, []);

  const register = useCallback(async (email: string, password: string, confirmPassword: string) => {
    const authed = await registerRequest(email, password, confirmPassword);
    setUser(authed);
    setStatus("authed");
    return authed;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      status,
      name: user?.name ?? "Student",
      email: user?.email ?? "",
      role: user?.role ?? "USER",
      setName,
      login,
      register,
      logout,
      refresh,
    }),
    [user, status, setName, login, register, logout, refresh],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
