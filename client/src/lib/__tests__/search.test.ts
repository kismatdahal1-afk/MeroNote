import { afterEach, describe, expect, it, vi } from "vitest";
import { searchContent, SearchError } from "../searchApi";

/**
 * Phase 10 search-client verification: URL building, abort passthrough,
 * error mapping, and envelope fallbacks. Component debounce/stale-guard
 * logic in pages/Search.tsx is covered by review (no DOM runner configured).
 */

function okResponse(body: unknown): Response {
  return Response.json(body);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchContent", () => {
  it("builds an encoded query string with optional filters", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      (url: unknown): Promise<Response> => {
        seen.push(String(url));
        return Promise.resolve(okResponse({ status: "ok", data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } }));
      },
    );
    await searchContent({ q: "data structures & algo", entityType: "resource", type: "past_paper", tag: "Exam", page: 2, limit: 5 });
    expect(seen).toHaveLength(1);
    const url = new URL(seen[0]);
    expect(url.pathname).toBe("/api/search");
    expect(url.searchParams.get("q")).toBe("data structures & algo");
    expect(url.searchParams.get("entityType")).toBe("resource");
    expect(url.searchParams.get("type")).toBe("past_paper");
    expect(url.searchParams.get("tag")).toBe("Exam");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("omits unset optionals", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", (url: unknown): Promise<Response> => {
      seen.push(String(url));
      return Promise.resolve(okResponse({ status: "ok", data: [] }));
    });
    const res = await searchContent({ q: "dsa" });
    expect(seen[0]).toBe("http://localhost:5000/api/search?q=dsa");
    expect(res.data).toEqual([]);
    expect(res.pagination.total).toBe(0);
  });

  it("maps server errors and network failure", async () => {
    vi.stubGlobal(
      "fetch",
      (): Promise<Response> => Promise.resolve(new Response(JSON.stringify({ status: "error", message: "Query 'q' is required." }), { status: 400 })),
    );
    await expect(searchContent({ q: "" })).rejects.toMatchObject({ status: 400, message: "Query 'q' is required." });

    vi.stubGlobal("fetch", (): Promise<Response> => {
      throw new TypeError("fetch failed");
    });
    await expect(searchContent({ q: "dsa" })).rejects.toMatchObject({ status: 0 });
    try {
      await searchContent({ q: "dsa" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SearchError);
      expect((err as SearchError).message).toBe("Search is unavailable offline.");
    }
  });

  it("lets caller aborts propagate unwrapped", async () => {
    vi.stubGlobal("fetch", (): Promise<Response> => {
      const err = new DOMException("aborted", "AbortError");
      return Promise.reject(err);
    });
    const controller = new AbortController();
    await expect(searchContent({ q: "dsa", signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});
