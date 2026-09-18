/**
 * Temporary PDF cache (Phase 9) — a SECOND IndexedDB database, deliberately
 * separate from Phase 8's `meronote-downloads`:
 *
 * - different database name → a temp entry can never be mistaken for a
 *   permanent download, and Service Worker cache cleanup never touches blobs
 * - bounded LRU (max files + max bytes) → disposable by design; the browser
 *   or this layer may evict at any time and nothing breaks
 * - never read by download state (`getDownload`), never counted, never shown
 *   as "Downloaded"
 */

import { TEMP_PDF_MAX_FILES, TEMP_PDF_MAX_TOTAL_BYTES } from "./cachePolicy";

export interface TempPdfEntry {
  resourceId: string;
  blob: Blob;
  storedAt: string;
}

export class TempCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TempCacheError";
  }
}

const DB_NAME = "meronote-temp-cache";
const STORE_NAME = "temp-files";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new TempCacheError("Temporary cache is unavailable in this browser."));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "resourceId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(new TempCacheError("Temporary cache is unavailable right now."));
      };
    });
  }
  return dbPromise;
}

/** Evict oldest-first until both bounds hold. Runs inside the write path. */
async function enforceBounds(): Promise<void> {
  const db = await openDb();
  const entries: TempPdfEntry[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as TempPdfEntry[]);
    request.onerror = () => reject(new TempCacheError("Temporary cache read failed."));
  });
  const ordered = [...entries].sort((a, b) => +new Date(a.storedAt) - +new Date(b.storedAt));
  let total = ordered.reduce((sum, e) => sum + (e.blob?.size ?? 0), 0);
  const victims: string[] = [];
  while ((ordered.length - victims.length > TEMP_PDF_MAX_FILES || total > TEMP_PDF_MAX_TOTAL_BYTES) && victims.length < ordered.length) {
    const next = ordered[victims.length];
    victims.push(next.resourceId);
    total -= next.blob?.size ?? 0;
  }
  if (victims.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new TempCacheError("Temporary cache cleanup failed."));
    for (const id of victims) tx.objectStore(STORE_NAME).delete(id);
  });
}

export async function putTempPdf(resourceId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new TempCacheError("Temporary cache write failed."));
    tx.objectStore(STORE_NAME).put({ resourceId, blob, storedAt: new Date().toISOString() } satisfies TempPdfEntry);
  });
  // Enforce bounds AFTER the write so a fresh entry can evict older ones.
  // Failures here are advisory — the put already succeeded.
  await enforceBounds().catch(() => {});
}

export async function getTempPdf(resourceId: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    const entry = await new Promise<TempPdfEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(resourceId);
      request.onsuccess = () => resolve(request.result as TempPdfEntry | undefined);
      request.onerror = () => reject(new TempCacheError("Temporary cache read failed."));
    });
    if (!entry?.blob) return null;
    const head = await entry.blob.slice(0, 5).text().catch(() => "");
    if (head !== "%PDF-") {
      // Corrupt temp entry: drop it (never promoted, never shown as download).
      await deleteTempPdf(entry.resourceId).catch(() => {});
      return null;
    }
    return entry.blob;
  } catch {
    return null;
  }
}

export async function deleteTempPdf(resourceId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new TempCacheError("Temporary cache delete failed."));
      tx.objectStore(STORE_NAME).delete(resourceId);
    });
  } catch {
    // Deletion is best-effort; a stale temp entry simply expires by eviction.
  }
}
