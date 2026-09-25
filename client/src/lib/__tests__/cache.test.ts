import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  API_ALLOWLIST_PREFIXES,
  API_CACHE,
  decideApiCache,
  decideReadingSource,
  isCacheableResponse,
  isCacheableStaticAsset,
  mayTempCachePdf,
  readingSourceLabel,
  staleCacheNames,
  STATIC_CACHE,
  TEMP_PDF_MAX_BYTES,
  TEMP_PDF_MAX_FILES,
  TEMP_PDF_MAX_TOTAL_BYTES,
} from "../cachePolicy";
import {
  deleteTempPdf,
  getTempPdf,
  putTempPdf,
} from "../tempPdfCache";
import { isOfflineError } from "../connectivity";

/**
 * Phase 9 cache/offline verification (prompt items 1–20 that are
 * unit-testable). Browser-only Service Worker lifecycle is covered by
 * review + production build; the sw.js/policy mirror is asserted textually
 * so the two cannot drift.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_ROOT = join(HERE, "..", "..", "..");
const SW_PATH = join(CLIENT_ROOT, "public", "sw.js");
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\ntrailer\n<<>>\n%%EOF\n");

function swText(): string {
  return readFileSync(SW_PATH, "utf8");
}

describe("cache names and versions", () => {
  it("versioned names exist and old versions are purged safely", () => {
    expect(STATIC_CACHE).toBe("meronote-static-v1");
    expect(API_CACHE).toBe("meronote-api-v1");
    // Only meronote-* names are ever deleted; foreign caches untouched.
    expect(staleCacheNames(["meronote-static-v0", "meronote-api-v1", "other-cache", "meronote-pdf-v0"])).toEqual([
      "meronote-static-v0",
      "meronote-pdf-v0",
    ]);
    expect(staleCacheNames(["meronote-static-v1", "meronote-api-v1"])).toEqual([]);
  });

  it("sw.js mirrors versions, allowlist, and denylist (no drift)", () => {
    const text = swText();
    expect(text).toContain(`"${STATIC_CACHE}"`);
    expect(text).toContain(`"${API_CACHE}"`);
    for (const prefix of API_ALLOWLIST_PREFIXES) {
      expect(text).toContain(`"${prefix}"`);
    }
    expect(text).toContain('"/file"');
    expect(text).toContain("meronote-");
  });
});

describe("API cache allowlist", () => {
  const ORIGIN = "https://app.local";

  it("caches public academic GETs", () => {
    for (const path of [
      "/api/semesters",
      "/api/semesters/abc",
      "/api/subjects?semesterId=x",
      "/api/topics/abc",
      "/api/resources?page=2",
      "/api/resources/abc",
      "/api/books",
      "/api/notices/abc",
    ]) {
      const decision = decideApiCache(`${ORIGIN}${path}`, "GET", ORIGIN);
      expect(decision).toEqual({ cache: true, store: API_CACHE });
    }
  });

  it("never caches auth, personal, admin, file, mutations, or cross-origin", () => {
    const denied: Array<[string, string]> = [
      ["https://app.local/api/auth/login", "POST"],
      ["https://app.local/api/auth/me", "GET"],
      ["https://app.local/api/me/favorites", "GET"],
      ["https://app.local/api/me/progress/abc", "PUT"],
      ["https://app.local/api/admin/ping", "GET"],
      ["https://app.local/api/resources/abc/file", "GET"],
      ["https://app.local/api/semesters", "POST"],
      ["https://app.local/api/subjects/x", "DELETE"],
      ["https://app.local/api/topics", "PATCH"],
      ["https://other.test/api/resources", "GET"],
      ["not-a-url", "GET"],
    ];
    for (const [url, method] of denied) {
      expect(decideApiCache(url, method, ORIGIN).cache).toBe(false);
    }
    // Prefix confusion is not allowlisted (/api/resourcesX ≠ /api/resources).
    expect(decideApiCache("https://app.local/api/resourcesX", "GET", ORIGIN).cache).toBe(false);
  });

  it("stores only successful same-origin responses", () => {
    expect(isCacheableResponse(200, "basic")).toBe(true);
    expect(isCacheableResponse(201, "basic")).toBe(false);
    expect(isCacheableResponse(401, "basic")).toBe(false);
    expect(isCacheableResponse(403, "basic")).toBe(false);
    expect(isCacheableResponse(500, "basic")).toBe(false);
    expect(isCacheableResponse(200, "opaque")).toBe(false);
    expect(isCacheableResponse(200, "cors")).toBe(false);
  });

  it("static cache admits same-origin assets only", () => {
    expect(isCacheableStaticAsset("script", true)).toBe(true);
    expect(isCacheableStaticAsset("font", true)).toBe(true);
    expect(isCacheableStaticAsset("script", false)).toBe(false);
    expect(isCacheableStaticAsset("document", true)).toBe(false);
    expect(isCacheableStaticAsset("", true)).toBe(false);
  });
});

describe("temporary PDF cache", () => {
  it("size policy admits small files only", () => {
    expect(TEMP_PDF_MAX_BYTES).toBe(15 * 1024 * 1024);
    expect(mayTempCachePdf(1024)).toBe(true);
    expect(mayTempCachePdf(TEMP_PDF_MAX_BYTES)).toBe(true);
    expect(mayTempCachePdf(TEMP_PDF_MAX_BYTES + 1)).toBe(false);
    expect(mayTempCachePdf(0)).toBe(false);
    expect(mayTempCachePdf(-5)).toBe(false);
    expect(mayTempCachePdf(Number.NaN)).toBe(false);
  });

  it("uses a separate database from permanent downloads", async () => {
    await putTempPdf("t-tmp", new Blob([PDF_BYTES as BlobPart], { type: "application/pdf" }));
    const blob = await getTempPdf("t-tmp");
    expect(blob).not.toBeNull();
    expect(await blob!.slice(0, 5).text()).toBe("%PDF-");
    await deleteTempPdf("t-tmp");
    expect(await getTempPdf("t-tmp")).toBeNull();
  });

  it("evicts oldest-first beyond file and byte bounds", async () => {
    const big = new Uint8Array(1024);
    big.set(new TextEncoder().encode("%PDF-"));
    // MAX_FILES is 3: inserting 4 valid entries evicts the oldest.
    for (const id of ["t-e1", "t-e2", "t-e3", "t-e4"]) {
      await putTempPdf(id, new Blob([big as BlobPart], { type: "application/pdf" }));
    }
    expect(await getTempPdf("t-e1")).toBeNull();
    expect(await getTempPdf("t-e4")).not.toBeNull();
    for (const id of ["t-e2", "t-e3", "t-e4"]) await deleteTempPdf(id);
    expect(TEMP_PDF_MAX_FILES).toBe(3);
    expect(TEMP_PDF_MAX_TOTAL_BYTES).toBe(30 * 1024 * 1024);
  });

  it("drops corrupt entries instead of serving them", async () => {
    await putTempPdf("t-bad", new Blob(["not a pdf"] as BlobPart[], { type: "text/plain" }));
    expect(await getTempPdf("t-bad")).toBeNull();
    expect(await getTempPdf("t-bad")).toBeNull();
  });
});

describe("reading source priority", () => {
  it("permanent download always wins", () => {
    expect(decideReadingSource({ hasPermanentDownload: true, hasTempCache: true, fileSize: 100 })).toBe("download");
    expect(decideReadingSource({ hasPermanentDownload: true, hasTempCache: false, fileSize: 10 ** 9 })).toBe("download");
  });

  it("temp cache beats network", () => {
    expect(decideReadingSource({ hasPermanentDownload: false, hasTempCache: true, fileSize: 100 })).toBe("cache");
  });

  it("small files fetch-and-cache, large files stream, unknown errors offline", () => {
    expect(decideReadingSource({ hasPermanentDownload: false, hasTempCache: false, fileSize: 1024 })).toBe("network-fetch");
    expect(decideReadingSource({ hasPermanentDownload: false, hasTempCache: false, fileSize: TEMP_PDF_MAX_BYTES + 1 })).toBe("network-stream");
    expect(decideReadingSource({ hasPermanentDownload: false, hasTempCache: false, fileSize: 0 })).toBe("offline-error");
    expect(decideReadingSource({ hasPermanentDownload: false, hasTempCache: false, fileSize: Number.NaN })).toBe("offline-error");
  });

  it("labels only local sources", () => {
    expect(readingSourceLabel("download")).toBe("Saved on device");
    expect(readingSourceLabel("cache")).toBe("Cached copy");
    expect(readingSourceLabel("network-fetch")).toBeNull();
    expect(readingSourceLabel("network-stream")).toBeNull();
    expect(readingSourceLabel("offline-error")).toBeNull();
  });
});

describe("offline detection helpers", () => {
  it("classifies network failures without claiming app errors are offline", () => {
    expect(isOfflineError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isOfflineError(new Error("Network request failed"))).toBe(true);
    expect(isOfflineError(new Error("Invalid email or password."))).toBe(false);
    expect(isOfflineError("boom")).toBe(false);
  });
});

describe("credential and collection safety", () => {
  it("sw.js contains no credential material", () => {
    const text = swText();
    expect(text).not.toMatch(/B2_|APPLICATION_KEY|secret|password|jwt|token|cookie|authorization/i);
  });

  it("no MongoDB cache collections; only the Phase 18 download-history metadata model", () => {
    // Repo layout: client/.. = repo root.
    const dir = join(CLIENT_ROOT, "..", "server", "src", "models");
    const files: string[] = readdirSync(dir);
    expect(files.some((f) => /cache/i.test(f))).toBe(false);
    // Phase 18 sanctions exactly one metadata collection (account history);
    // PDF bytes stay in IndexedDB and out of MongoDB.
    expect(files.filter((f) => /download/i.test(f))).toEqual(["downloadHistory.model.ts"]);
    for (const file of files) {
      if (!file.endsWith(".model.ts")) continue;
      const content = readFileSync(join(dir, file), "utf8");
      if (file === "downloadHistory.model.ts") {
        // Phase 18 metadata only: no binary/blob schema storage (the word
        // "blob" appears solely in comments describing IndexedDB behavior).
        expect(content).not.toMatch(/\b(Buffer|Blob|BSONBinary)\b|Schema\.Types\.Buffer/);
      } else {
        expect(content).not.toMatch(/download/i);
      }
    }
  });
});
