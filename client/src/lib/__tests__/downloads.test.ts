import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deleteFile,
  getFile,
  hasFile,
  listStoredIds,
  putFile,
} from "../downloadStore";
import {
  cancelDownloadRequest,
  describeDownloadError,
  isDownloading,
  resolveLocalFileUrl,
  revokeLocalFileUrl,
  startDownloadRequest,
} from "../downloadManager";
import { FileApiError } from "../resourceFileApi";

/**
 * Phase 8 download verification (items 1–19 of the phase plan, except the
 * browser-only canvas paint which is covered by build + review, and the
 * remote-reader path which existing verify:resource-file + verify:pdf cover).
 * No real network, no MongoDB, deterministic synthetic data.
 */

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const TEXT_BYTES = new TextEncoder().encode("just some text, not a pdf");

function mockFetch(cdn: (url: string, init: RequestInit) => Promise<Response>, calls: string[]) {
  vi.stubGlobal(
    "fetch",
    (url: unknown, init?: RequestInit): Promise<Response> => {
      calls.push(String(url));
      if (String(url).includes("/api/resources/")) {
        return Promise.resolve(Response.json({ status: "ok", data: { url: "https://cdn.test/file.pdf", expiresIn: 900 } }));
      }
      return cdn(String(url), init ?? {});
    },
  );
}

function cdnResponse(bytes: Uint8Array, contentLength: number | null = bytes.length, status = 200): Response {
  const headers: Record<string, string> = {};
  if (contentLength !== null) headers["content-length"] = String(contentLength);
  return new Response(bytes as BodyInit, { status, headers });
}

async function storedBytes(resourceId: string): Promise<number[]> {
  const file = await getFile(resourceId);
  if (!file) return [];
  return Array.from(new Uint8Array(await file.blob.arrayBuffer()));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadStore (IndexedDB)", () => {
  it("initializes, stores, retrieves, and lists blobs", async () => {
    await putFile({ resourceId: "t-store", blob: new Blob([PDF_BYTES as BlobPart], { type: "application/pdf" }), fileName: "a.pdf", mimeType: "application/pdf", fileSize: PDF_BYTES.length, downloadedAt: new Date().toISOString() });
    expect(await hasFile("t-store")).toBe(true);
    expect(await storedBytes("t-store")).toEqual(Array.from(PDF_BYTES));
    expect(await listStoredIds()).toContain("t-store");
    await deleteFile("t-store");
    expect(await hasFile("t-store")).toBe(false);
  });

  it("missing records return not-downloaded", async () => {
    expect(await getFile("t-missing")).toBeNull();
    expect(await hasFile("t-missing")).toBe(false);
  });

  it("remove deletes the record", async () => {
    await putFile({ resourceId: "t-remove", blob: new Blob([PDF_BYTES as BlobPart]), fileName: "r.pdf", mimeType: "application/pdf", fileSize: 1, downloadedAt: "" });
    await deleteFile("t-remove");
    expect(await getFile("t-remove")).toBeNull();
  });
});

describe("downloadManager", () => {
  it("completes with real monotonic progress and stored bytes", async () => {
    const calls: string[] = [];
    mockFetch(() => Promise.resolve(cdnResponse(PDF_BYTES)), calls);
    const percents: Array<number | null> = [];
    let done: [string, number] = ["", 0];
    await startDownloadRequest(
      { resourceId: "t-success", fileName: "s.pdf" },
      {
        onProgress: (p) => percents.push(p),
        onDone: (result, size) => {
          done = [result, size];
        },
      },
    );
    expect(done[0]).toBe("completed");
    expect(done[1]).toBe(PDF_BYTES.length);
    const numeric = percents.filter((p): p is number => p !== null);
    expect(numeric.length).toBeGreaterThan(0);
    expect(numeric[numeric.length - 1]).toBe(100);
    expect(numeric.every((p, i, a) => i === 0 || a[i - 1] <= p)).toBe(true);
    expect(await storedBytes("t-success")).toEqual(Array.from(PDF_BYTES));
    await deleteFile("t-success");
  });

  it("supports indeterminate progress without Content-Length", async () => {
    const calls: string[] = [];
    mockFetch(() => Promise.resolve(cdnResponse(PDF_BYTES, null)), calls);
    const percents: Array<number | null> = [];
    let done = "";
    await startDownloadRequest(
      { resourceId: "t-indet", fileName: "i.pdf" },
      { onProgress: (p) => percents.push(p), onDone: (r) => (done = r) },
    );
    expect(done).toBe("completed");
    // Indeterminate during streaming (all null), exact 100 only at completion.
    expect(percents.slice(0, -1).every((p) => p === null)).toBe(true);
    expect(percents[percents.length - 1]).toBe(100);
    await deleteFile("t-indet");
  });

  it("rejects non-PDF bytes and stores nothing", async () => {
    const calls: string[] = [];
    mockFetch(() => Promise.resolve(cdnResponse(TEXT_BYTES)), calls);
    let done: [string, string | null] = ["", null];
    await startDownloadRequest(
      { resourceId: "t-badpdf", fileName: "b.pdf" },
      { onProgress: () => {}, onDone: (r, _s, e) => (done = [r, e]) },
    );
    expect(done[0]).toBe("failed");
    expect(await getFile("t-badpdf")).toBeNull();
  });

  it("rejects empty and failed HTTP responses without storing", async () => {
    const calls: string[] = [];
    mockFetch(() => Promise.resolve(cdnResponse(new Uint8Array(0), 0)), calls);
    let done = "";
    await startDownloadRequest({ resourceId: "t-empty", fileName: "e.pdf" }, { onProgress: () => {}, onDone: (r) => (done = r) });
    expect(done).toBe("failed");

    mockFetch(() => Promise.resolve(cdnResponse(PDF_BYTES, PDF_BYTES.length, 500)), calls);
    await startDownloadRequest({ resourceId: "t-http", fileName: "h.pdf" }, { onProgress: () => {}, onDone: (r) => (done = r) });
    expect(done).toBe("failed");
    expect(await getFile("t-http")).toBeNull();
  });

  it("prevents duplicate parallel downloads", async () => {
    const calls: string[] = [];
    mockFetch(() => Promise.resolve(cdnResponse(PDF_BYTES)), calls);
    let completions = 0;
    const callbacks = { onProgress: () => {}, onDone: () => (completions += 1) };
    const first = startDownloadRequest({ resourceId: "t-dup", fileName: "d.pdf" }, callbacks);
    expect(isDownloading("t-dup")).toBe(true);
    await startDownloadRequest({ resourceId: "t-dup", fileName: "d.pdf" }, callbacks);
    await first;
    expect(completions).toBe(1);
    expect(calls.filter((c) => c.includes("/api/resources/")).length).toBe(1);
    await deleteFile("t-dup");
  });

  it("cancels cleanly with no stored record", async () => {
    const calls: string[] = [];
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      calls,
    );
    let done = "";
    const running = startDownloadRequest(
      { resourceId: "t-cancel", fileName: "c.pdf" },
      { onProgress: () => {}, onDone: (r) => (done = r) },
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(cancelDownloadRequest("t-cancel")).toBe(true);
    await running;
    expect(done).toBe("cancelled");
    expect(cancelDownloadRequest("t-cancel")).toBe(false);
    expect(await getFile("t-cancel")).toBeNull();
  });

  it("maps errors to safe user-facing messages", () => {
    expect(describeDownloadError(new FileApiError(503, "Service down"))).toBe("Service down");
    expect(describeDownloadError(new DOMException("quota", "QuotaExceededError"))).toMatch(/storage/i);
    expect(describeDownloadError(new Error("fetch failed"))).toMatch(/connection/i);
    expect(describeDownloadError(new Error("weird xyz"))).toBe("Download failed. Please try again.");
    expect(describeDownloadError("mystery")).toBe("Download failed. Please try again.");
  });
});

describe("local reader resolution", () => {
  it("resolves a blob URL whose bytes match, then revokes it", async () => {
    await putFile({ resourceId: "t-local", blob: new Blob([PDF_BYTES as BlobPart], { type: "application/pdf" }), fileName: "l.pdf", mimeType: "application/pdf", fileSize: PDF_BYTES.length, downloadedAt: "" });
    const url = await resolveLocalFileUrl("t-local");
    expect(url?.startsWith("blob:")).toBe(true);
    const fetched = Buffer.from(await (await fetch(url!)).arrayBuffer());
    expect(Array.from(fetched)).toEqual(Array.from(PDF_BYTES));
    const spy = vi.spyOn(URL, "revokeObjectURL");
    revokeLocalFileUrl(url!);
    expect(spy).toHaveBeenCalledWith(url);
    await deleteFile("t-local");
  });

  it("drops corrupt records and returns null", async () => {
    await putFile({ resourceId: "t-corrupt", blob: new Blob([TEXT_BYTES as BlobPart], { type: "text/plain" }), fileName: "x.pdf", mimeType: "application/pdf", fileSize: 1, downloadedAt: "" });
    expect(await resolveLocalFileUrl("t-corrupt")).toBeNull();
    expect(await hasFile("t-corrupt")).toBe(false);
  });

  it("missing record resolves to null", async () => {
    expect(await resolveLocalFileUrl("t-absent")).toBeNull();
  });
});

describe("backend invariant: IndexedDB holds bytes, download_history holds metadata", () => {
  it("server models contain only the Phase 18 download-history metadata model (no bytes)", () => {
    // From client/src/lib/__tests__ → repo root → server/src/models.
    const here = fileURLToPath(new URL(".", import.meta.url));
    const modelsDir = resolve(here, "..", "..", "..", "..", "server", "src", "models");
    const files = readdirSync(modelsDir);
    expect(files.filter((f) => f.toLowerCase().includes("download"))).toEqual(["downloadHistory.model.ts"]);
    for (const file of files) {
      if (!file.endsWith(".model.ts") && file !== "index.ts" && file !== "enums.ts") continue;
      const content = readFileSync(join(modelsDir, file), "utf8");
      if (file === "downloadHistory.model.ts") {
        // Metadata only: collection name present, binary/blob schema storage absent.
        expect(content).toMatch(/download_history/);
        expect(content).not.toMatch(/\b(Buffer|Blob|BSONBinary)\b|Schema\.Types\.Buffer/);
      } else if (file === "index.ts") {
        // Barrel may re-export only the sanctioned metadata model.
        const hits = content.match(/download[a-z]*/gi) ?? [];
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.every((h) => h.toLowerCase().startsWith("downloadhistory"))).toBe(true);
      } else {
        expect(content.toLowerCase()).not.toMatch(/download/);
      }
    }
    expect(existsSync(join(modelsDir, "download.model.ts"))).toBe(false);
  });
});
