/**
 * Minimal client for the Phase 7 personal-study API (/api/me/*).
 *
 * Graceful-degradation contract (pre academic-content integration):
 * - Every function resolves to null/false on network or API failure.
 * - Callers keep local state authoritative and never break the UI when the
 *   backend is unreachable or an id is a mock id (not a real ObjectId).
 * - Nothing here is ever thrown to the user; no toasts, no alerts.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export type StudyTargetType = "resource" | "subject";

export interface StudyFavorite {
  _id: string;
  targetType: StudyTargetType;
  targetId: string;
  createdAt: string;
}

export interface StudyBookmark {
  _id: string;
  targetType: StudyTargetType;
  targetId: string;
  page?: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyProgress {
  resourceId: string;
  lastPage: number;
  progress: number;
  updatedAt: string;
}

/** Real backend ids are 24-hex ObjectIds; mock ids (res-…, bm-…) skip sync. */
export function isObjectIdLike(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "content-type": "application/json" },
      ...init,
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { data?: T } | null;
    return (json?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export function putFavorite(targetType: StudyTargetType, targetId: string): Promise<StudyFavorite | null> {
  if (!isObjectIdLike(targetId)) return Promise.resolve(null);
  return request<StudyFavorite>(`/api/me/favorites/${targetType}/${targetId}`, { method: "PUT" });
}

export function deleteFavorite(targetType: StudyTargetType, targetId: string): Promise<boolean> {
  if (!isObjectIdLike(targetId)) return Promise.resolve(false);
  return request<{ removed: boolean }>(`/api/me/favorites/${targetType}/${targetId}`, { method: "DELETE" }).then(
    (d) => d !== null,
  );
}

export function createBookmark(input: {
  targetType: StudyTargetType;
  targetId: string;
  page?: number;
  note?: string;
}): Promise<StudyBookmark | null> {
  if (!isObjectIdLike(input.targetId)) return Promise.resolve(null);
  return request<StudyBookmark>("/api/me/bookmarks", { method: "POST", body: JSON.stringify(input) });
}

export function deleteBookmarkById(bookmarkId: string): Promise<boolean> {
  if (!isObjectIdLike(bookmarkId)) return Promise.resolve(false);
  return request(`/api/me/bookmarks/${bookmarkId}`, { method: "DELETE" }).then((d) => d !== null);
}

export function getServerProgress(resourceId: string): Promise<StudyProgress | null> {
  if (!isObjectIdLike(resourceId)) return Promise.resolve(null);
  return request<StudyProgress>(`/api/me/progress/${resourceId}`);
}

export function putServerProgress(resourceId: string, lastPage: number): Promise<StudyProgress | null> {
  if (!isObjectIdLike(resourceId)) return Promise.resolve(null);
  return request<StudyProgress>(`/api/me/progress/${resourceId}`, {
    method: "PUT",
    body: JSON.stringify({ lastPage }),
  });
}
