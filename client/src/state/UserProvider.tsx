import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AuthError, fetchMe, loginRequest, logoutRequest, registerRequest, updateProfileRequest, type AuthUser } from "../lib/authApi";
import { refreshSession } from "../lib/authRefresh";
import { createAuthGate, isUnauthorizedStatus } from "../lib/authGate";

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
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * F2: drop the authenticated state when the server has rejected the session
   * (401). No-op unless currently authenticated, so a stray 401 can never
   * kill a newer concurrent login. Idempotent.
   */
  invalidateSession: () => void;
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
  // F2 generation guard: stale async completions (login resolving after
  // logout, /me resolving after a user switch) must never overwrite newer
  // state. Every transition opens a generation; completions write only
  // while theirs is still current.
  const gateRef = useRef(createAuthGate());
  // Live status mirror for completion-time decisions (avoids stale closures
  // in long-lived callbacks; same render-mirror idiom as LibraryProvider).
  const statusRef = useRef(status);
  statusRef.current = status;

  const invalidateSession = useCallback(() => {
    if (statusRef.current !== "authed") return;
    gateRef.current.begin();
    setUser(null);
    setStatus("guest");
  }, []);

  const refresh = useCallback(async () => {
    const seq = gateRef.current.begin();
    try {
      const me = await fetchMe();
      if (!gateRef.current.isCurrent(seq)) return;
      setUser(me);
      setStatus("authed");
    } catch (err) {
      if (!gateRef.current.isCurrent(seq)) return;
      // Expired access JWT: one transparent shared refresh, then adopt.
      // Anything else (or a failed refresh) keeps the previous contract:
      // the session cannot be proven, so it resolves to guest.
      if (err instanceof AuthError && isUnauthorizedStatus(err.status)) {
        try {
          const me = await refreshSession();
          if (!gateRef.current.isCurrent(seq)) return;
          setUser(me);
          setStatus("authed");
          return;
        } catch {
          // Fall through to guest below.
        }
      }
      if (!gateRef.current.isCurrent(seq)) return;
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
    // Profile edits are not auth transitions: observe the generation without
    // opening a new one, so a concurrent login/refresh is never dropped.
    const seq = gateRef.current.current();
    try {
      const updated = await updateProfileRequest(trimmed);
      if (!gateRef.current.isCurrent(seq)) return updated;
      setUser(updated);
      return updated;
    } catch (err) {
      // Expired access JWT: refresh once (shared single-flight), then retry
      // the edit a single time. Refresh/retry failure with 401 clears auth
      // state (RequireAuth redirects); anything else rethrows untouched, and
      // the retry never refreshes again — no loops.
      if (err instanceof AuthError && isUnauthorizedStatus(err.status)) {
        try {
          const me = await refreshSession();
          if (!gateRef.current.isCurrent(seq)) return me;
          const updated = await updateProfileRequest(trimmed);
          if (!gateRef.current.isCurrent(seq)) return updated;
          setUser(updated);
          return updated;
        } catch (retryErr) {
          if (retryErr instanceof AuthError && isUnauthorizedStatus(retryErr.status)) invalidateSession();
          throw retryErr;
        }
      }
      throw err;
    }
  }, [invalidateSession]);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const seq = gateRef.current.begin();
    const authed = await loginRequest(email, password, remember);
    if (!gateRef.current.isCurrent(seq)) return authed;
    setUser(authed);
    setStatus("authed");
    return authed;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    const seq = gateRef.current.begin();
    const authed = await registerRequest(name, email, password, confirmPassword);
    if (!gateRef.current.isCurrent(seq)) return authed;
    setUser(authed);
    setStatus("authed");
    return authed;
  }, []);

  const logout = useCallback(async () => {
    const seq = gateRef.current.begin();
    try {
      await logoutRequest();
    } finally {
      if (!gateRef.current.isCurrent(seq)) return;
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
      invalidateSession,
    }),
    [user, status, setName, login, register, logout, refresh, invalidateSession],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
