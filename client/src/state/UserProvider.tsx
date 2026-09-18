import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchMe, loginRequest, logoutRequest, registerRequest, type AuthUser } from "../lib/authApi";

/**
 * Session-backed account state (Phase 3).
 * Identity (email/role) always comes from the server session — never from
 * local storage. The display name keeps its local Settings override on top
 * of the server name (server-side rename is a later phase).
 */

const STORAGE_KEY = "meronote-user-name";

type AuthStatus = "loading" | "authed" | "guest";

interface UserContextValue {
  /** Authenticated user from GET /api/auth/me (null when guest). */
  user: AuthUser | null;
  /** Session resolution state. */
  status: AuthStatus;
  /** Display name (server name + local Settings override). */
  name: string;
  /** Server email ("" when guest). */
  email: string;
  /** Server role — drives portal access ("USER" when guest). */
  role: "USER" | "ADMIN";
  /** Local display-name override (Settings → Edit Profile). */
  setName: (name: string) => void;
  login: (email: string, password: string, remember: boolean) => Promise<AuthUser>;
  register: (email: string, password: string, confirmPassword: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

function readStoredName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredName(name: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (name) window.localStorage.setItem(STORAGE_KEY, name);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — keep UI-only state.
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [nameOverride, setNameOverride] = useState<string | null>(() => readStoredName());

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
    void refresh();
  }, [refresh]);

  const setName = useCallback((next: string) => {
    const trimmed = next.trim();
    if (!trimmed) return;
    setNameOverride(trimmed);
    writeStoredName(trimmed);
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const authed = await loginRequest(email, password, remember);
    writeStoredName(null);
    setNameOverride(null);
    setUser(authed);
    setStatus("authed");
    return authed;
  }, []);

  const register = useCallback(async (email: string, password: string, confirmPassword: string) => {
    const authed = await registerRequest(email, password, confirmPassword);
    writeStoredName(null);
    setNameOverride(null);
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
      name: nameOverride ?? user?.name ?? "Student",
      email: user?.email ?? "",
      role: user?.role ?? "USER",
      setName,
      login,
      register,
      logout,
      refresh,
    }),
    [user, status, nameOverride, setName, login, register, logout, refresh],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
