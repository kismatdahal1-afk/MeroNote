/**
 * Temporary-cache policy (Phase 9) — pure, fully unit-tested.
 *
 * The Service Worker (client/public/sw.js) mirrors these rules in plain JS;
 * `verify:cache` asserts the mirror stays in sync (version strings,
 * allowlist prefixes, forbidden patterns), so the two cannot drift apart.
 *
 * What this module NEVER covers (hard rules):
 * - non-GET requests, /api/auth/*, /api/me/*, /api/admin/*, credentials
 * - the file-access endpoint response body (a presigned URL JSON — caching
 *   it would serve expired URLs), permanent IndexedDB downloads
 */

export const CACHE_VERSION = "v1";

export const STATIC_CACHE = `meronote-static-${CACHE_VERSION}`;
export const API_CACHE = `meronote-api-${CACHE_VERSION}`;

export function allCacheNames(): string[] {
  return [STATIC_CACHE, API_CACHE];
}

/** Academic read-only collection roots (matches Phase 4 routes). */
export const API_ALLOWLIST_PREFIXES = [
  "/api/semesters",
  "/api/subjects",
  "/api/topics",
  "/api/resources",
  "/api/books",
  "/api/notices",
] as const;

/** Paths that must never be cached even under an allowlisted prefix. */
export const API_DENYLIST_SUFFIXES = ["/file"] as const;

export type CacheDecision =
  | { cache: false; reason: string }
  | { cache: true; store: string };

/**
 * Should a fetch be served from / written to the API cache?
 * Only exact-shape public academic GETs on the app origin qualify —
 * cross-origin URLs with similar paths are never allowlisted.
 */
export function decideApiCache(url: string, method: string, origin?: string): CacheDecision {
  if (method.toUpperCase() !== "GET") return { cache: false, reason: "non-GET" };
  let parsed: URL;
  try {
    parsed = new URL(url, "https://app.local");
  } catch {
    return { cache: false, reason: "unparseable-url" };
  }
  if (origin !== undefined && parsed.origin !== origin) return { cache: false, reason: "cross-origin" };
  const path = parsed.pathname;
  if (!path.startsWith("/api/")) return { cache: false, reason: "non-api" };
  if (API_DENYLIST_SUFFIXES.some((suffix) => path === suffix || path.endsWith(suffix))) {
    return { cache: false, reason: "denylisted" };
  }
  const allowed = API_ALLOWLIST_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (!allowed) return { cache: false, reason: "not-allowlisted" };
  return { cache: true, store: API_CACHE };
}

/** Only successful same-origin GET responses may be stored. */
export function isCacheableResponse(status: number, responseType: string): boolean {
  return status === 200 && responseType === "basic";
}

/** Same-origin static asset kinds eligible for the static cache. */
export function isCacheableStaticAsset(destination: string, sameOrigin: boolean): boolean {
  if (!sameOrigin) return false;
  return destination === "script" || destination === "style" || destination === "image" || destination === "font";
}

/** Cache names from older versions that activation must delete. */
export function staleCacheNames(existing: string[], current: string[] = allCacheNames()): string[] {
  const keep = new Set(current);
  return existing.filter((name) => name.startsWith("meronote-") && !keep.has(name));
}

/** Max PDF bytes eligible for the *temporary* cache (Step 8 policy). */
export const TEMP_PDF_MAX_BYTES = 15 * 1024 * 1024;

/** Temp-cache LRU bounds — small by design; permanent downloads are separate. */
export const TEMP_PDF_MAX_FILES = 3;
export const TEMP_PDF_MAX_TOTAL_BYTES = 30 * 1024 * 1024;

export function mayTempCachePdf(fileSize: number): boolean {
  return Number.isFinite(fileSize) && fileSize > 0 && fileSize <= TEMP_PDF_MAX_BYTES;
}

export type ReadingSource = "download" | "cache" | "network-fetch" | "network-stream" | "offline-error";

/**
 * Reader source priority (Step 11): permanent download first, then valid
 * temp cache, then network (fetch-and-cache when small enough, stream when
 * large), else a useful offline error. Pure decision — I/O lives in callers.
 */
export function decideReadingSource(input: {
  hasPermanentDownload: boolean;
  hasTempCache: boolean;
  fileSize: number;
}): ReadingSource {
  if (input.hasPermanentDownload) return "download";
  if (input.hasTempCache) return "cache";
  if (mayTempCachePdf(input.fileSize)) return "network-fetch";
  if (Number.isFinite(input.fileSize) && input.fileSize > 0) return "network-stream";
  return "offline-error";
}

export function readingSourceLabel(source: ReadingSource): string | null {
  if (source === "download") return "Saved on device";
  if (source === "cache") return "Cached copy";
  return null;
}
