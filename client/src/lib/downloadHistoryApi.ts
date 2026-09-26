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
import { csrfHeaders } from "./csrf";

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
      // F3 double-submit proof.
      headers: { "content-type": "application/json", ...(await csrfHeaders("PUT")) },
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

/**
 * Remove one resource from account Downloads (hard delete, idempotent).
 * Never touches the physical IndexedDB blob: a removed entry whose file
 * remains becomes a local-only orphan for reconciliation. Re-download
 * reactivates via the standard idempotent PUT.
 */
export async function deleteDownloadHistory(resourceId: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/me/downloads/${resourceId}`, {
      method: "DELETE",
      credentials: "include",
      // F3 double-submit proof.
      headers: await csrfHeaders("DELETE"),
    });
  } catch {
    throw new DownloadHistoryError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as { data?: { removed?: boolean }; message?: string } | null;
  if (!res.ok) {
    throw new DownloadHistoryError(
      res.status,
      typeof json?.message === "string" && json.message ? json.message : "Could not remove download history.",
    );
  }
  return json?.data?.removed === true;
}

export interface DownloadVerifyInput {
  verify?: boolean;
  fileSize?: number;
}

/**
 * Verification/metadata refresh that never reorders history: stamps
 * lastVerifiedAt and/or corrects fileSize. Null-safe callers only invoke
 * this after confirming the local file exists.
 */
export async function verifyDownloadHistory(
  resourceId: string,
  input: DownloadVerifyInput,
): Promise<DownloadHistoryRow> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/me/downloads/${resourceId}`, {
      method: "PATCH",
      credentials: "include",
      // F3 double-submit proof.
      headers: { "content-type": "application/json", ...(await csrfHeaders("PATCH")) },
      body: JSON.stringify(input),
    });
  } catch {
    throw new DownloadHistoryError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as { data?: DownloadHistoryRow; message?: string } | null;
  if (!res.ok || !json?.data) {
    throw new DownloadHistoryError(
      res.status,
      typeof json?.message === "string" && json.message ? json.message : "Could not verify download history.",
    );
  }
  return json.data;
}
