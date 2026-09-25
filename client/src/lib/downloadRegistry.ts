/**
 * Phase 18 download registry helpers — pure functions shared by
 * LibraryProvider and tests (no React, no storage access).
 *
 * One resource is always in exactly one combined state:
 * - "saved":   account history exists AND this device holds the bytes
 * - "remote":  account history exists, bytes are on another device
 * - "local-only": bytes exist without account history (unregistered file —
 *                 e.g. history registration failed, or a pre-Phase-18 blob)
 * - "none":    neither (plain Download action)
 */

import type { DownloadItem } from "../types";
import type { DownloadHistoryRow } from "./downloadHistoryApi";

export type DownloadCombinedState = "saved" | "remote" | "local-only" | "none";

/** Combine the two truths into one deterministic UI state. */
export function resolveDownloadState(accountDownloaded: boolean, localFileExists: boolean): DownloadCombinedState {
  if (accountDownloaded && localFileExists) return "saved";
  if (accountDownloaded) return "remote";
  if (localFileExists) return "local-only";
  return "none";
}

/**
 * Build the completed device row for a history entry whose blob is present.
 * sizeBytes prefers the history byte count (actual blob.size at completion).
 */
export function buildCompletedRow(entry: DownloadHistoryRow, fallbackSizeBytes: number): DownloadItem {
  return {
    id: `dl-${entry.resourceId}`,
    resourceId: entry.resourceId,
    status: "completed",
    progress: 100,
    sizeBytes: typeof entry.fileSize === "number" && entry.fileSize > 0 ? entry.fileSize : fallbackSizeBytes,
    downloadedAt: entry.downloadedAt,
  };
}

/** Completed mirror rows (device namespace) whose blob still exists. */
export function verifiedCompletedRows(rows: DownloadItem[], blobIds: string[]): DownloadItem[] {
  return rows.filter((r) => r.status === "completed" && blobIds.includes(r.resourceId));
}
/** Mirror rows (blob-verified) missing from account history → need registration. */
export function unregisteredCompletedRows(rows: DownloadItem[], historyIds: Set<string>): DownloadItem[] {
  return rows.filter((r) => r.status === "completed" && !historyIds.has(r.resourceId));
}

/**
 * Merge history-built completed rows with in-window device rows: history ∩
 * blobs is authoritative, plus blob-verified just-completed rows (no history
 * or mirror entry yet — dropping them would orphan visible files) and
 * in-flight downloading/queued rows. Failed/cancelled rows stay session-only
 * and are dropped. Previous-account rows can never reach here: hydration
 * resets state before this runs and callers gate on the acting user.
 */
export function mergeRebuiltDownloads(
  rebuilt: DownloadItem[],
  prev: DownloadItem[],
  blobIds: string[],
): DownloadItem[] {
  const next = [...rebuilt];
  const seen = new Set(next.map((d) => d.resourceId));
  for (const d of prev) {
    if (seen.has(d.resourceId)) continue;
    if (d.status === "downloading" || d.status === "queued") {
      next.push(d);
      seen.add(d.resourceId);
    } else if (d.status === "completed" && blobIds.includes(d.resourceId)) {
      next.push(d);
      seen.add(d.resourceId);
    }
  }
  return next;
}

/**
 * Device registry mirror key: guests keep the legacy v1 key, each account
 * gets an isolated v2 namespace. The v1 key is never auto-migrated into an
 * account (unsafe attribution) — it stays guest-local (§18).
 */
export function downloadMirrorKey(userId: string | null): string {
  return userId ? `meronote.library.downloads.v2.${userId}` : "meronote.library.downloads.v1";
}

/**
 * Verification staleness bound (Phase 19): a history row whose local file
 * was confirmed within this window skips its server write; older rows
 * re-verify once per hydration at most. Event-driven, never polled.
 */
export const VERIFICATION_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/** Due when never verified or the last confirmation exceeds the stale bound. */
export function isVerificationDue(
  lastVerifiedAt: string | undefined,
  nowMs: number,
  maxAgeMs: number = VERIFICATION_STALE_MS,
): boolean {
  if (!lastVerifiedAt) return true;
  const at = Date.parse(lastVerifiedAt);
  if (Number.isNaN(at)) return true;
  return nowMs - at > maxAgeMs;
}
