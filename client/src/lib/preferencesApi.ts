/**
 * Phase 19 user-preferences client: recent resources only.
 *
 * Deliberately minimal — the only persisted preference with proven product
 * purpose is the bounded recent-resources list (Dashboard Recently Opened).
 * Semester selection lives in the Phase 16 semester plan, theme stays
 * device-local, and the Settings reading toggles gate no behavior yet.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export interface RecentResourceEntry {
  resourceId: string;
  openedAt: string;
}

export interface UserPreferences {
  userId: string;
  recentResources: RecentResourceEntry[];
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
    return data;
  } catch {
    return null;
  }
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId }),
    });
  } catch {
    // Non-blocking by design (§30).
  }
}
