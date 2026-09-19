import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchResourceFileUrl, FileApiError } from "../resourceFileApi";

/**
 * Resource-file URL contract regression (PDF Reader load failure):
 * the backend returns `{status:"ok", data:{url, expiresIn}}` and the reader
 * must consume exactly `data.url` — never the envelope, never a rebuilt URL,
 * never a stale/undefined id. Covers: correct request URL + credentials,
 * correct response property, and the 404/410/503 friendly-error mapping the
 * reader's error card depends on.
 */

function mockFetchOnce(body: unknown, ok = true, status = 200): { calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok, status, json: async () => body } as Response;
    }),
  );
  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchResourceFileUrl", () => {
  it("requests the file endpoint for the real id with cookies", async () => {
    const { calls } = mockFetchOnce({ status: "ok", data: { url: "https://files.example/r.pdf?sig=1&exp=2", expiresIn: 900 } });
    const access = await fetchResourceFileUrl("64f000000000000000000042");
    expect(access.url).toBe("https://files.example/r.pdf?sig=1&exp=2");
    expect(access.expiresIn).toBe(900);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/resources/64f000000000000000000042/file");
    expect(calls[0].url).not.toContain("undefined");
    expect(calls[0].init?.credentials).toBe("include");
  });

  it("keeps presigned query parameters intact (no re-encoding)", async () => {
    const signed = "https://files.example/r.pdf?X-Amz-Algorithm=AWS4&X-Amz-Signature=ab%2Fcd%3D";
    mockFetchOnce({ status: "ok", data: { url: signed, expiresIn: 900 } });
    const access = await fetchResourceFileUrl("64f000000000000000000042");
    expect(access.url).toBe(signed);
  });

  it("rejects when the URL property is missing (never treats the envelope as the URL)", async () => {
    mockFetchOnce({ status: "ok", data: { expiresIn: 900 } });
    await expect(fetchResourceFileUrl("64f000000000000000000042")).rejects.toThrow(FileApiError);
    await expect(fetchResourceFileUrl("64f000000000000000000042")).rejects.toThrow("Couldn't open this file.");
  });

  it("maps 404/410/503 to the reader's friendly messages", async () => {
    mockFetchOnce({ status: "error", message: "Resource not found." }, false, 404);
    await expect(fetchResourceFileUrl("64f000000000000000000042")).rejects.toMatchObject({ status: 404 });

    mockFetchOnce({ status: "error", message: "This resource has no file attached yet." }, false, 410);
    await expect(fetchResourceFileUrl("64f000000000000000000042")).rejects.toMatchObject({ status: 410 });

    mockFetchOnce({ status: "error", message: "The file is temporarily unavailable." }, false, 503);
    await expect(fetchResourceFileUrl("64f000000000000000000042")).rejects.toMatchObject({ status: 503 });
  });

  it("surfaces the server message for other failures, status 0 when unreachable", async () => {
    mockFetchOnce({ status: "error", message: "Invalid resource id." }, false, 400);
    await expect(fetchResourceFileUrl("not-an-id")).rejects.toThrow("Invalid resource id.");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const err = await fetchResourceFileUrl("64f000000000000000000042").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FileApiError);
    expect((err as FileApiError).status).toBe(0);
  });
});
