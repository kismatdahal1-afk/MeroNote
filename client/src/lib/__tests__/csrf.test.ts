import { afterEach, describe, expect, it, vi } from "vitest";
import { CSRF_COOKIE, CSRF_HEADER, csrfHeaders, getCsrfToken } from "../csrf";

/**
 * F3 client CSRF helper verification (no network, no DOM).
 * `document` is stubbed per test; fetch is mocked. Proves: the token comes
 * from the readable cookie when present (no extra request), the public
 * bootstrap covers a missing cookie, failures degrade to "no header" (the
 * server then decides), and read-only methods never attach proof.
 */

const TOKEN = "a".repeat(64);

function stubDocument(cookie: string): void {
  vi.stubGlobal("document", { cookie });
}

function mockFetchOnce(handler: () => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const spy = vi.fn(handler);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("contract constants", () => {
  it("matches the server double-submit names", () => {
    expect(CSRF_COOKIE).toBe("meronote_csrf");
    expect(CSRF_HEADER).toBe("x-csrf-token");
  });
});

describe("getCsrfToken", () => {
  it("reads the token from the cookie without any request", async () => {
    stubDocument(`other=1; ${CSRF_COOKIE}=${TOKEN}; theme=dark`);
    const spy = mockFetchOnce(() => jsonResponse({}, 200));
    await expect(getCsrfToken()).resolves.toBe(TOKEN);
    expect(spy).not.toHaveBeenCalled();
  });

  it("bootstraps via GET /api/auth/csrf when the cookie is absent", async () => {
    stubDocument("");
    const spy = mockFetchOnce(() => jsonResponse({ status: "ok", data: { csrfToken: TOKEN } }, 200));
    await expect(getCsrfToken()).resolves.toBe(TOKEN);
    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/csrf");
    expect((init as { method?: string }).method ?? "GET").toBe("GET");
  });

  it("returns null when bootstrap fails (server decides)", async () => {
    stubDocument("");
    mockFetchOnce(() => jsonResponse({ status: "error" }, 500));
    await expect(getCsrfToken()).resolves.toBeNull();
  });

  it("returns null on network failure without throwing", async () => {
    stubDocument("");
    mockFetchOnce(() => Promise.reject(new TypeError("fetch failed")));
    await expect(getCsrfToken()).resolves.toBeNull();
  });

  it("tolerates malformed cookie strings", async () => {
    stubDocument(";;;noequals;;");
    mockFetchOnce(() => jsonResponse({ status: "ok", data: { csrfToken: TOKEN } }, 200));
    await expect(getCsrfToken()).resolves.toBe(TOKEN);
  });

  it("shares one bootstrap across concurrent callers (no token split)", async () => {
    stubDocument("");
    let calls = 0;
    mockFetchOnce(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse({ status: "ok", data: { csrfToken: TOKEN } }, 200);
    });
    const [first, second, third] = await Promise.all([getCsrfToken(), getCsrfToken(), getCsrfToken()]);
    expect(calls).toBe(1);
    expect(first).toBe(TOKEN);
    expect(second).toBe(TOKEN);
    expect(third).toBe(TOKEN);
  });

  it("shares bootstrap failure (single request, all resolve null)", async () => {
    stubDocument("");
    let calls = 0;
    mockFetchOnce(() => {
      calls += 1;
      return Promise.reject(new TypeError("offline"));
    });
    const [first, second] = await Promise.all([getCsrfToken(), getCsrfToken()]);
    expect(calls).toBe(1);
    expect(first).toBeNull();
    expect(second).toBeNull();
  });
});

describe("csrfHeaders", () => {
  it("attaches proof for mutating methods (any case)", async () => {
    stubDocument(`${CSRF_COOKIE}=${TOKEN}`);
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post", "delete"]) {
      await expect(csrfHeaders(method)).resolves.toEqual({ [CSRF_HEADER]: TOKEN });
    }
  });

  it("attaches nothing for read-only or unknown methods", async () => {
    stubDocument(`${CSRF_COOKIE}=${TOKEN}`);
    const spy = mockFetchOnce(() => jsonResponse({}, 200));
    for (const method of ["GET", "HEAD", "OPTIONS", undefined, ""]) {
      await expect(csrfHeaders(method)).resolves.toEqual({});
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("omits the header when no token is available", async () => {
    stubDocument("");
    mockFetchOnce(() => Promise.reject(new TypeError("offline")));
    await expect(csrfHeaders("POST")).resolves.toEqual({});
  });
});
