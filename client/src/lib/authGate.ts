/**
 * Auth transition generation guard (F2 race hardening).
 *
 * Every authentication transition (login / register / logout / refresh /
 * session invalidation) opens a new generation via `begin()`. An async
 * completion may write auth state only while `isCurrent(seq)` still holds
 * for the generation it captured at start. A stale completion — a login
 * that resolves after a logout, a /me that resolves after a user switch —
 * is dropped instead of overwriting the newer state.
 *
 * Pure and framework-free so the ordering invariant is unit-testable;
 * UserProvider owns one instance and threads it through its transitions.
 */

export interface AuthGate {
  /** Open a new generation; all older generations become stale. */
  begin(): number;
  /** True only when `seq` is still the latest generation. */
  isCurrent(seq: number): boolean;
  /** The latest generation (peek without opening a new one). */
  current(): number;
}

export function createAuthGate(): AuthGate {
  let generation = 0;
  return {
    begin(): number {
      generation += 1;
      return generation;
    },
    isCurrent(seq: number): boolean {
      return seq === generation;
    },
    current(): number {
      return generation;
    },
  };
}

/**
 * The single definition of "the server rejected the session". Only 401
 * Unauthorized invalidates client auth state — never 403/404/409/422/429,
 * 5xx, or network failures (status 0). Shared by UserProvider and
 * useApiQuery so the rule cannot drift between call sites.
 */
export function isUnauthorizedStatus(status: number): boolean {
  return status === 401;
}
