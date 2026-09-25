import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCompletedRow,
  downloadMirrorKey,
  mergeRebuiltDownloads,
  resolveDownloadState,
  unregisteredCompletedRows,
  verifiedCompletedRows,
} from "../downloadRegistry";
import {
  DownloadHistoryError,
  getDownloadHistory,
  registerDownloadHistory,
  type DownloadHistoryRow,
} from "../downloadHistoryApi";
import type { DownloadItem } from "../../types";

/**
 * Phase 18 download architecture verification: account/device separation,
 * registry helpers, history client contract. No network, no MongoDB.
 */

const A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbbbbbb";

const historyRow = (over: Partial<DownloadHistoryRow> = {}): DownloadHistoryRow => ({
  _id: "000000000000000000000001",
  userId: "0000000000000000000000a1",
  resourceId: A,
  status: "active",
  fileSize: 2048,
  downloadedAt: "2026-09-01T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  resource: null,
  ...over,
});

const completedRow = (resourceId: string): DownloadItem => ({
  id: `dl-${resourceId}`,
  resourceId,
  status: "completed",
  progress: 100,
  sizeBytes: 2048,
  downloadedAt: "2026-09-01T00:00:00.000Z",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("account/device combined state", () => {
  it("maps the four combinations deterministically", () => {
    expect(resolveDownloadState(true, true)).toBe("saved");
    expect(resolveDownloadState(true, false)).toBe("remote");
    expect(resolveDownloadState(false, true)).toBe("local-only");
    expect(resolveDownloadState(false, false)).toBe("none");
  });
});

describe("completed row construction", () => {
  it("prefers the history byte count, falls back to the estimate", () => {
    expect(buildCompletedRow(historyRow({ fileSize: 3000 }), 100).sizeBytes).toBe(3000);
    expect(buildCompletedRow(historyRow({ fileSize: undefined }), 100).sizeBytes).toBe(100);
    const row = buildCompletedRow(historyRow(), 0);
    expect(row).toMatchObject({ id: `dl-${A}`, resourceId: A, status: "completed", progress: 100 });
  });
});

describe("registry filters", () => {
  it("verifiedCompletedRows keeps only blob-backed completed rows", () => {
    const rows: DownloadItem[] = [
      completedRow(A),
      { ...completedRow(B), status: "downloading", progress: 10 },
      completedRow("cccccccccccccccccccccccc"),
    ];
    expect(verifiedCompletedRows(rows, [A, B]).map((r) => r.resourceId)).toEqual([A]);
  });

  it("unregisteredCompletedRows finds history gaps for retry", () => {
    const rows = [completedRow(A), completedRow(B)];
    expect(unregisteredCompletedRows(rows, new Set([A])).map((r) => r.resourceId)).toEqual([B]);
    expect(unregisteredCompletedRows(rows, new Set([A, B]))).toEqual([]);
  });
});

describe("download mirror namespaces", () => {
  it("isolates account registries per user, guests keep v1", () => {
    expect(downloadMirrorKey(null)).toBe("meronote.library.downloads.v1");
    const a = downloadMirrorKey(A);
    const b = downloadMirrorKey(B);
    expect(a).toContain(A);
    expect(a).not.toBe(b);
  });
});

describe("mergeRebuiltDownloads (hydration rebuild)", () => {
  const C = "cccccccccccccccccccccccc";
  const downloading = (resourceId: string): DownloadItem => ({
    id: `dl-${resourceId}`,
    resourceId,
    status: "downloading",
    progress: 10,
    sizeBytes: 100,
    downloadedAt: "2026-09-01T00:00:00.000Z",
  });

  it("keeps history rows first, preserves in-window completions and in-flight work", () => {
    const rebuilt = [completedRow(A)];
    const prev: DownloadItem[] = [
      completedRow(A),
      completedRow(B),
      downloading(C),
      { ...completedRow("dddddddddddddddddddddddd"), status: "failed", error: "x" },
    ];
    const merged = mergeRebuiltDownloads(rebuilt, prev, [A, B, C]);
    expect(merged.map((r) => r.resourceId)).toEqual([A, B, C]);
    expect(merged.filter((r) => r.status === "failed")).toEqual([]);
  });

  it("drops completed rows whose blob is gone and failed rows always", () => {
    const merged = mergeRebuiltDownloads([], [completedRow(A), downloading(B)], [B]);
    expect(merged.map((r) => r.resourceId)).toEqual([B]);
  });
});

describe("download history client", () => {
  function envelope<T>(rows: T[], page: number, pages: number, total: number): Response {
    return Response.json({ status: "ok", data: rows, pagination: { page, limit: 100, total, pages } });
  }

  it("fetches the full history across pages", async () => {
    const p1 = Array.from({ length: 100 }, (_, i) => historyRow({ resourceId: i.toString(16).padStart(24, "0") }));
    const p2 = [historyRow({ resourceId: B })];
    vi.stubGlobal("fetch", (url: unknown) =>
      Promise.resolve(String(url).includes("page=2") ? envelope(p2, 2, 2, 101) : envelope(p1, 1, 2, 101)),
    );
    const rows = await getDownloadHistory();
    expect(rows?.length).toBe(101);
  });

  it("returns null on failure (never partial history)", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("down")));
    await expect(getDownloadHistory()).resolves.toBeNull();
  });

  it("registers after local write with the actual byte count", async () => {
    let seenBody = "";
    vi.stubGlobal("fetch", (_url: unknown, init?: RequestInit) => {
      seenBody = String(init?.body ?? "");
      return Promise.resolve(Response.json({ status: "ok", data: historyRow() }));
    });
    const row = await registerDownloadHistory(A, 3000);
    expect(JSON.parse(seenBody)).toEqual({ fileSize: 3000 });
    expect(row.resourceId).toBe(A);
  });

  it("throws (no false sync) when registration fails", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ status: "error", message: "Resource not found." }, { status: 404 })),
    );
    const err = await registerDownloadHistory(A, 100).catch((e) => e);
    expect(err).toBeInstanceOf(DownloadHistoryError);
    expect((err as DownloadHistoryError).status).toBe(404);
  });
});
