/**
 * Permanent download storage (Phase 8) — IndexedDB ONLY.
 *
 * Holds actual PDF blobs for explicitly downloaded resources, plus the
 * minimal metadata needed to identify, display, reopen, and remove them.
 * This is entirely separate from any temporary browser/ServiceWorker cache:
 * rows here live until the user removes them.
 *
 * Never stores: download state/progress (in-memory UI state), binaries
 * anywhere else (no localStorage/sessionStorage/cookies, no MongoDB).
 */

export interface StoredDownloadFile {
  resourceId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadedAt: string;
}

export type DownloadStorageCode = "unavailable" | "quota";

export class DownloadStorageError extends Error {
  code: DownloadStorageCode;

  constructor(code: DownloadStorageCode, message: string) {
    super(message);
    this.name = "DownloadStorageError";
    this.code = code;
  }
}

const DB_NAME = "meronote-downloads";
const STORE_NAME = "files";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function indexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function mapDomError(err: unknown, fallback: string): DownloadStorageError {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "QuotaExceededError") {
    return new DownloadStorageError("quota", "Not enough device storage to save this PDF.");
  }
  if (name === "InvalidStateError" || name === "UnknownError" || name === "AbortError") {
    return new DownloadStorageError("unavailable", "Device storage is unavailable right now. Please try again.");
  }
  return new DownloadStorageError(
    "unavailable",
    fallback,
  );
}

function openDb(): Promise<IDBDatabase> {
  if (!indexedDBAvailable()) {
    return Promise.reject(new DownloadStorageError("unavailable", "Downloads are not supported in this browser."));
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
        reject(mapDomError(request.error, "Could not open download storage."));
      };
      request.onblocked = () => {
        dbPromise = null;
        reject(new DownloadStorageError("unavailable", "Download storage is busy. Please try again."));
      };
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<any>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: T;
        try {
          const tx = db.transaction(STORE_NAME, mode);
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => reject(mapDomError(tx.error, "Download storage operation failed."));
          tx.onabort = () => reject(mapDomError(tx.error, "Download storage operation failed."));
          const request = fn(tx.objectStore(STORE_NAME));
          request.onsuccess = () => {
            result = request.result as T;
          };
          request.onerror = () => reject(mapDomError(request.error, "Download storage operation failed."));
        } catch (err) {
          reject(mapDomError(err, "Download storage operation failed."));
        }
      }),
  );
}

export function putFile(file: StoredDownloadFile): Promise<void> {
  return run<void>("readwrite", (store) => store.put(file)).then(() => undefined);
}

export function getFile(resourceId: string): Promise<StoredDownloadFile | null> {
  return run<StoredDownloadFile | undefined>("readonly", (store) => store.get(resourceId)).then(
    (file) => file ?? null,
  );
}

export function deleteFile(resourceId: string): Promise<void> {
  return run<undefined>("readwrite", (store) => store.delete(resourceId)).then(() => undefined);
}

export function hasFile(resourceId: string): Promise<boolean> {
  return getFile(resourceId).then((file) => file !== null);
}

/** All stored resource ids — used once at boot to prune orphan state rows. */
export function listStoredIds(): Promise<string[]> {
  return run<IDBValidKey[]>("readonly", (store) => store.getAllKeys()).then((keys) =>
    keys.map((key) => String(key)),
  );
}
