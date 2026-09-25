/**
 * Phase 18 account-level download history client.
 *
 * Two explicit truths (never one boolean):
 * - accountDownloadExists: MongoDB download_history has this user+resource
 * - localFileExists:      this device's IndexedDB holds the PDF bytes
 *   (resolved via downloadStore, surfaced synchronously by LibraryProvider).
 *
 * Registration happens ONLY after an explicit Download completes its local
 * IndexedDB write. Opening a PDF never creates history.
 */

import { fetchAllPages } from "./studyApi";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export interface DownloadHistoryResource {
  _id: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  pageCount?: number;
  fileSize?: number;
  subjectId: string;
  semesterId: string;
}

export interface DownloadHistoryRow {
  _id: string;
  userId: string;
  resourceId: string;
  status: "active";
  fileSize?: number;
  downloadedAt: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  resource: DownloadHistoryResource | null;
}

export class DownloadHistoryError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DownloadHistoryError";
    this.status = status;
  }
}

/** Complete account history via fetch-all pagination (null on failure, never partial). */
export function getDownloadHistory(): Promise<DownloadHistoryRow[] | null> {
  return fetchAllPages<DownloadHistoryRow>("/api/me/downloads");
}

/**
 * Register one completed explicit download. Throws on failure so callers
 * never mistake a failed registration for a synced one; the local blob is
 * kept regardless (Phase 19 owns retry UX, hydration auto-retries).
 */
export async function registerDownloadHistory(resourceId: string, fileSize: number): Promise<DownloadHistoryRow> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/me/downloads/${resourceId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileSize }),
    });
  } catch {
    throw new DownloadHistoryError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as { data?: DownloadHistoryRow; message?: string } | null;
  if (!res.ok || !json?.data) {
    throw new DownloadHistoryError(
      res.status,
      typeof json?.message === "string" && json.message ? json.message : "Could not save download history.",
    );
  }
  return json.data;
}
