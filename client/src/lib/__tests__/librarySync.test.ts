import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_MERGE_OPS,
  buildServerClaimSets,
  libraryMirrorKey,
  removeClaimedBookmarks,
  removeClaimedIds,
  selectGuestBookmarkMerge,
  selectGuestFavoriteMerge,
} from "../librarySync";
import { listBookmarks, listFavorites, listProgress } from "../studyApi";

/**
 * Phase 17 hydration verification: namespaced mirrors, guest-merge
 * selection, and fetch-all pagination. No network, no MongoDB.
 */

const A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbbbbbb";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mirror namespaces", () => {
  it("keeps guests on the legacy shared keys", () => {
    expect(libraryMirrorKey("favorites", null)).toBe("meronote.library.favorites.v1");
    expect(libraryMirrorKey("bookmarks", null)).toBe("meronote.library.bookmarks.v1");
  });

  it("scopes authenticated mirrors per user id", () => {
    const aFav = libraryMirrorKey("favorites", A);
    const bFav = libraryMirrorKey("favorites", B);
    expect(aFav).toContain(A);
    expect(aFav).not.toBe("meronote.library.favorites.v1");
    expect(bFav).toContain(B);
    expect(aFav).not.toBe(bFav);
    expect(libraryMirrorKey("bookmarkedSubjects", A)).not.toBe(libraryMirrorKey("bookmarkedSubjects", B));
  });
});

describe("guest favorite merge selection", () => {
  it("keeps valid ids and dedupes across repeated entries", () => {
    const out = selectGuestFavoriteMerge([A, A, "res-1", "nope"], [B, B, ""]);
    expect(out).toEqual({ resourceIds: [A], subjectIds: [B] });
  });

  it("returns empty merge for empty/junk guest state", () => {
    expect(selectGuestFavoriteMerge([], [])).toEqual({ resourceIds: [], subjectIds: [] });
    expect(selectGuestFavoriteMerge(["bm-1", "guest"], ["x"])).toEqual({ resourceIds: [], subjectIds: [] });
  });

  it("bounds corrupt mirrors to MAX_MERGE_OPS", () => {
    const many = Array.from({ length: MAX_MERGE_OPS + 50 }, (_, i) =>
      i.toString(16).padStart(24, "0"),
    );
    const out = selectGuestFavoriteMerge(many, []);
    expect(out.resourceIds.length).toBe(MAX_MERGE_OPS);
  });
});

describe("guest bookmark merge selection", () => {
  it("keeps page/note and drops mock ids", () => {
    const out = selectGuestBookmarkMerge(
      [
        { id: "bm-1", resourceId: A, page: 10, note: "ch2", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "bm-2", resourceId: "res-9", page: 3, note: "", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
      [B],
    );
    expect(out).toEqual({
      resources: [{ targetId: A, page: 10, note: "ch2" }],
      subjectIds: [B],
    });
  });

  it("normalizes invalid pages and truncates long notes", () => {
    const out = selectGuestBookmarkMerge(
      [{ id: "bm-1", resourceId: A, page: 0, note: "x".repeat(2000), createdAt: "" }],
      [],
    );
    expect(out.resources[0]?.page).toBe(1);
    expect(out.resources[0]?.note.length).toBe(1000);
  });

  it("dedupes repeat bookmarks for the same resource", () => {
    const bm = { id: "bm-1", resourceId: A, page: 2, note: "", createdAt: "" };
    const out = selectGuestBookmarkMerge([bm, { ...bm, id: "bm-2", page: 5 }], []);
    expect(out.resources).toEqual([{ targetId: A, page: 2, note: "" }]);
  });
});

describe("fetch-all personal lists (no silent truncation)", () => {

  function envelope<T>(rows: T[], page: number, pages: number, total: number): Response {
    return Response.json({ status: "ok", data: rows, pagination: { page, limit: 100, total, pages } });
  }

  it("follows pages until the envelope total is reached", async () => {
    const p1 = Array.from({ length: 100 }, (_, i) => ({ n: i }));
    const p2 = Array.from({ length: 5 }, (_, i) => ({ n: 100 + i }));
    const seen: string[] = [];
    vi.stubGlobal("fetch", (url: unknown) => {
      seen.push(String(url));
      return Promise.resolve(
        String(url).includes("page=2") ? envelope(p2, 2, 2, 105) : envelope(p1, 1, 2, 105),
      );
    });
    const rows = await listFavorites();
    expect(rows?.length).toBe(105);
    expect(seen.some((u) => u.includes("page=2"))).toBe(true);
    expect(seen.every((u) => u.includes("limit=100"))).toBe(true);
  });

  it("resolves single-page lists with one request", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      return Promise.resolve(envelope([{ n: 1 }], 1, 1, 1));
    });
    const [bm, prog] = await Promise.all([listBookmarks(), listProgress()]);
    expect(bm?.length).toBe(1);
    expect(prog?.length).toBe(1);
    expect(calls).toBe(2);
  });

  it("returns null (failure, not empty) when any page fails", async () => {
    const p1 = Array.from({ length: 100 }, (_, i) => ({ n: i }));
    vi.stubGlobal("fetch", (url: unknown) =>
      Promise.resolve(
        String(url).includes("page=2") ? new Response("{}", { status: 500 }) : envelope(p1, 1, 2, 105),
      ),
    );
    await expect(listFavorites()).resolves.toBeNull();
  });

  it("returns null on network failure and non-ok status", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("down")));
    await expect(listBookmarks()).resolves.toBeNull();
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("{}", { status: 401 })));
    await expect(listProgress()).resolves.toBeNull();
  });
});

describe("server claim sets (legacy-prune source)", () => {
  const C = "cccccccccccccccccccccccc";
  const D = "dddddddddddddddddddddddd";

  it("splits claimed ids by list and target type, dropping junk", () => {
    const sets = buildServerClaimSets(
      [
        { targetType: "resource", targetId: C },
        { targetType: "subject", targetId: D },
        { targetType: "resource", targetId: "nope" },
        { targetType: "video", targetId: C },
      ],
      [{ targetType: "resource", targetId: D }],
    );
    expect([...sets.favoriteResourceIds]).toEqual([C]);
    expect([...sets.favoriteSubjectIds]).toEqual([D]);
    expect([...sets.bookmarkResourceIds]).toEqual([D]);
    expect(sets.bookmarkSubjectIds.size).toBe(0);
  });

  it("prunes only claimed entries, keeping unclaimed guest state", () => {
    expect(removeClaimedIds([C, D], new Set([C]))).toEqual([D]);
    expect(removeClaimedIds([C], new Set())).toEqual([C]);
    const bms = [
      { id: "bm-1", resourceId: C, page: 2, note: "", createdAt: "" },
      { id: "bm-2", resourceId: D, page: 3, note: "", createdAt: "" },
    ];
    expect(removeClaimedBookmarks(bms, new Set([C]))).toEqual([bms[1]]);
  });
});
