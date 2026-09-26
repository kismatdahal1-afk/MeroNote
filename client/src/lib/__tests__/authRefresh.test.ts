import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshSession } from "../authRefresh";
import { CSRF_COOKIE, CSRF_HEADER } from "../csrf";
import type { AuthUser } from "../authApi";

/**
 * F4 single-flight refresh verification against the REAL authRefresh module
 * over mocked transport. Proves: concurrent 401s share exactly one rotation
 * request (Test 12 transport half), failure statuses propagate untouched for
 * the callers' invalidate/keep decisions (Tests 13/14 plungers), the CSRF
 * proof rides along (Test 15 client half), and the flight resets after
 * settle (no stuck promise).
 */

const ME: AuthUser = { id: "a1", name: "A", email: "a@example.com", role: "USER" };
const CSRF_TOKEN = "c".repeat(64);

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return handler(String(url), init);
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCsrfCookie(): void {
  vi.stubGlobal("document", { cookie: `${CSRF_COOKIE}=${CSRF_TOKEN}` });
}

describe("refreshSession", () => {
  it("returns the SafeUser identity on success with CSRF proof attached", async () => {
    stubCsrfCookie();
    const calls = stubFetch((url) => {
      if (url.endsWith("/api/auth/refresh")) {
        return jsonResponse({ status: "ok", data: ME }, 200);
      }
      throw new Error(`unexpected request: ${url}`);
    });
    await expect(refreshSession()).resolves.toEqual(ME);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.url).toContain("/api/auth/refresh");
    const headers = call.init?.headers as Record<string, string>;
    expect(headers[CSRF_HEADER]).toBe(CSRF_TOKEN);
    expect(call.init?.credentials).toBe("include");
  });

  it("shares one rotation across concurrent callers", async () => {
    stubCsrfCookie();
    let refreshPosts = 0;
    stubFetch(async (url) => {
      if (url.endsWith("/api/auth/refresh")) {
        refreshPosts += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse({ status: "ok", data: ME }, 200);
      }
      throw new Error(`unexpected request: ${url}`);
    });
    const [a, b, c] = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(refreshPosts).toBe(1);
    expect(a).toEqual(ME);
    expect(b).toEqual(ME);
    expect(c).toEqual(ME);
  });

  it("propagates 401 for callers to invalidate on", async () => {
    stubCsrfCookie();
    stubFetch((url) => {
      if (url.endsWith("/api/auth/refresh")) {
        return jsonResponse({ status: "error", message: "Authentication required." }, 401);
      }
      throw new Error(`unexpected request: ${url}`);
    });
    await expect(refreshSession()).rejects.toMatchObject({ name: "AuthError", status: 401 });
  });

  it("propagates non-401 failures untouched (callers must not treat them as 401)", async () => {
    stubCsrfCookie();
    stubFetch(() => jsonResponse({ status: "error", message: "Broken." }, 500));
    await expect(refreshSession()).rejects.toMatchObject({ status: 500 });
    stubFetch(() => Promise.reject(new TypeError("offline")));
    await expect(refreshSession()).rejects.toMatchObject({ status: 0 });
  });

  it("rejects malformed success bodies instead of adopting junk", async () => {
    stubCsrfCookie();
    stubFetch(() => jsonResponse({ status: "ok", data: null }, 200));
    await expect(refreshSession()).rejects.toMatchObject({ status: 500 });
  });

  it("resets the flight after settle so later calls re-fetch", async () => {
    stubCsrfCookie();
    let refreshPosts = 0;
    stubFetch(() => {
      refreshPosts += 1;
      return jsonResponse({ status: "ok", data: ME }, 200);
    });
    await refreshSession();
    await refreshSession();
    expect(refreshPosts).toBe(2);
  });

  it("bootstraps CSRF first when the cookie is absent, then refreshes", async () => {
    const seen: string[] = [];
    stubFetch((url) => {
      seen.push(url);
      if (url.endsWith("/api/auth/csrf")) {
        return jsonResponse({ status: "ok", data: { csrfToken: CSRF_TOKEN } }, 200);
      }
      if (url.endsWith("/api/auth/refresh")) {
        return jsonResponse({ status: "ok", data: ME }, 200);
      }
      throw new Error(`unexpected request: ${url}`);
    });
    await expect(refreshSession()).resolves.toEqual(ME);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toContain("/api/auth/csrf");
    expect(seen[1]).toContain("/api/auth/refresh");
  });
});
