/**
 * Phase 19 user-preferences client (recent resources) + Phase 21
 * user-controlled Continue Reading list.
 *
 * Deliberately minimal — persisted preferences with proven product purpose
 * only (Dashboard Recently Opened + Dashboard Continue Reading).
 * Semester selection lives in the Phase 16 semester plan, theme stays
 * device-local, and the Settings reading toggles gate no behavior yet.
 */

import { csrfHeaders } from "./csrf";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export interface RecentResourceEntry {
  resourceId: string;
  openedAt: string;
}

export interface UserPreferences {
  userId: string;
  recentResources: RecentResourceEntry[];
  /** Continue Reading resource ids, insertion order (Phase 21). */
  continueReading: string[];
  createdAt: string;
  updatedAt: string;
}

/** Account preferences; null on guest/failure (never partial). */
export async function getPreferences(signal?: AbortSignal): Promise<UserPreferences | null> {
  try {
    const res = await fetch(`${API_URL}/api/me/preferences`, { credentials: "include", signal });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { data?: UserPreferences } | null;
    const data = json?.data;
    if (!data || !Array.isArray(data.recentResources)) return null;
    // Lenient shape evolution: older payloads without the list still hydrate.
    if (!Array.isArray(data.continueReading)) data.continueReading = [];
    return data;
  } catch {
    return null;
  }
}

export class PreferencesError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PreferencesError";
    this.status = status;
  }
}

/**
 * Explicitly add one resource to Continue Reading. Resolves true when the
 * server confirms membership (201 new or 200 already present); throws
 * otherwise so callers never mistake failure for membership.
 */
export async function putContinueReading(resourceId: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/me/preferences/continue-reading/${resourceId}`, {
      method: "PUT",
      credentials: "include",
      // F3 double-submit proof.
      headers: await csrfHeaders("PUT"),
    });
  } catch {
    throw new PreferencesError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new PreferencesError(
      res.status,
      typeof json?.message === "string" && json.message ? json.message : "Could not update Continue Reading.",
    );
  }
  return true;
}

/**
 * Explicitly remove one resource from Continue Reading. Resolves true when
 * the entry is gone (deleted or already absent); throws on failure. Never
 * touches Reading Progress, recents, or the resource itself.
 */
export async function deleteContinueReading(resourceId: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/me/preferences/continue-reading/${resourceId}`, {
      method: "DELETE",
      credentials: "include",
      // F3 double-submit proof.
      headers: await csrfHeaders("DELETE"),
    });
  } catch {
    throw new PreferencesError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as { data?: { removed?: boolean }; message?: string } | null;
  if (!res.ok) {
    throw new PreferencesError(
      res.status,
      typeof json?.message === "string" && json.message ? json.message : "Could not update Continue Reading.",
    );
  }
  return true;
}

/**
 * Record one intentional open. Fire-and-forget by contract: navigation must
 * never wait on it and failures never surface (the in-memory recent list is
 * already updated optimistically by the caller). Never rejects.
 */
export async function recordRecentOpened(resourceId: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/me/preferences/recent`, {
      method: "POST",
      credentials: "include",
      // F3 double-submit proof.
      headers: { "content-type": "application/json", ...(await csrfHeaders("POST")) },
      body: JSON.stringify({ resourceId }),
    });
  } catch {
    // Non-blocking by design (§30).
  }
}
