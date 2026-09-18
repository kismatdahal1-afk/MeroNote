import { fetchResourceFileUrl, FileApiError } from "./resourceFileApi";
import { deleteFile, getFile, putFile } from "./downloadStore";

/**
 * Real download orchestration (Phase 8) — streams a PDF through the EXISTING
 * secure file endpoint into IndexedDB. One AbortController per resource:
 * parallel resources download independently, the same resource never twice.
 *
 * Progress is real (bytes / Content-Length) or indeterminate when the
 * length is absent — never faked. Partial/failed data is never stored.
 */

export type DownloadResult = "completed" | "failed" | "cancelled";

export interface DownloadCallbacks {
  onProgress: (percent: number | null) => void;
  onDone: (result: DownloadResult, sizeBytes: number, errorMessage: string | null) => void;
}

export interface DownloadRequest {
  resourceId: string;
  fileName: string;
}

const PDF_MAGIC = "%PDF-";
const active = new Map<string, AbortController>();

export function isDownloading(resourceId: string): boolean {
  return active.has(resourceId);
}

export function cancelDownloadRequest(resourceId: string): boolean {
  const controller = active.get(resourceId);
  if (!controller) return false;
  controller.abort();
  return true;
}

/** Maps download failures to user-facing messages (exported for tests). Never leaks internals. */
export function describeDownloadError(err: unknown): string {
  if (err instanceof FileApiError) return err.message;
  const message = err instanceof Error ? err.message : String(err);
  if (/quota|storage/i.test(message)) return "Not enough device storage to save this PDF.";
  if (/fetch|network|offline|load failed/i.test(message)) {
    return "Download failed. Check your connection and try again.";
  }
  return "Download failed. Please try again.";
}

/**
 * Local-first resolution for the reader: returns an object URL for an
 * explicitly downloaded blob, or null when there is none. Corrupt records
 * are deleted so the caller falls back to remote access. Pair with
 * revokeLocalFileUrl once the URL is no longer needed.
 */
export async function resolveLocalFileUrl(resourceId: string): Promise<string | null> {
  let stored;
  try {
    stored = await getFile(resourceId);
  } catch {
    return null;
  }
  if (!stored) return null;
  const head = await stored.blob.slice(0, PDF_MAGIC.length).text().catch(() => "");
  if (head !== PDF_MAGIC) {
    await deleteFile(resourceId).catch(() => {});
    return null;
  }
  return URL.createObjectURL(stored.blob);
}

export function revokeLocalFileUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export async function startDownloadRequest(request: DownloadRequest, callbacks: DownloadCallbacks): Promise<void> {
  const { resourceId, fileName } = request;
  if (active.has(resourceId)) return;
  const controller = new AbortController();
  active.set(resourceId, controller);

  const finish = (result: DownloadResult, sizeBytes: number, errorMessage: string | null): void => {
    if (active.get(resourceId) === controller) active.delete(resourceId);
    callbacks.onDone(result, sizeBytes, errorMessage);
  };

  try {
    // Only the existing secure endpoint is ever used — no B2 keys client-side.
    const { url } = await fetchResourceFileUrl(resourceId);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal, credentials: "omit" });
    } catch (err) {
      if (controller.signal.aborted) {
        finish("cancelled", 0, null);
        return;
      }
      throw err;
    }
    if (!res.ok || !res.body) {
      throw new Error(`Download failed with status ${res.status}.`);
    }

    const total = Number(res.headers.get("content-length"));
    const hasTotal = Number.isFinite(total) && total > 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (controller.signal.aborted) {
        try {
          await reader.cancel();
        } catch {
          // Already torn down — fall through to the cancelled finish.
        }
        finish("cancelled", 0, null);
        return;
      }
      if (value) {
        chunks.push(value);
        received += value.length;
        callbacks.onProgress(hasTotal ? Math.min(99, Math.round((received / total) * 100)) : null);
      }
    }

    if (received === 0) throw new Error("Downloaded file is empty.");
    const blob = new Blob(chunks as BlobPart[], { type: "application/pdf" });
    const head = await blob.slice(0, PDF_MAGIC.length).text();
    if (head !== PDF_MAGIC) throw new Error("Downloaded file is not a valid PDF.");

    await putFile({
      resourceId,
      blob,
      fileName,
      mimeType: "application/pdf",
      fileSize: blob.size,
      downloadedAt: new Date().toISOString(),
    });
    if (controller.signal.aborted) {
      // Cancelled during the IndexedDB write: drop the stored blob so a
      // cancelled download never surfaces as completed.
      await deleteFile(resourceId).catch(() => {});
      finish("cancelled", 0, null);
      return;
    }
    callbacks.onProgress(100);
    finish("completed", blob.size, null);
  } catch (err) {
    if (controller.signal.aborted) {
      finish("cancelled", 0, null);
      return;
    }
    finish("failed", 0, describeDownloadError(err));
  }
}
