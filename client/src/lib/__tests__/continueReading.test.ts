import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PreferencesError,
  deleteContinueReading,
  getPreferences,
  putContinueReading,
} from "../preferencesApi";

/**
 * Phase 21 Continue Reading client verification: explicit add/remove
 * contract with mocked fetch. No network, no MongoDB.
 */

const A = "aaaaaaaaaaaaaaaaaaaaaaaa";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("continue reading client", () => {
  it("adds explicitly (PUT, true on 201 and 200)", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", (url: unknown, init?: RequestInit) => {
      seen.push(`${init?.method} ${String(url)}`);
      return Promise.resolve(Response.json({ status: "ok", data: { resourceId: A, added: true } }));
    });
    await expect(putContinueReading(A)).resolves.toBe(true);
    expect(seen[0]).toContain("PUT");
    expect(seen[0]).toContain(`/api/me/preferences/continue-reading/${A}`);
  });

  it("throws on add failure (never false membership)", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ status: "error", message: "Resource not found." }, { status: 404 })),
    );
    const err = await putContinueReading(A).catch((e) => e);
    expect(err).toBeInstanceOf(PreferencesError);
    expect((err as PreferencesError).status).toBe(404);
  });

  it("removes explicitly (DELETE, true when gone)", async () => {
    let seenMethod = "";
    vi.stubGlobal("fetch", (_url: unknown, init?: RequestInit) => {
      seenMethod = String(init?.method ?? "");
      return Promise.resolve(Response.json({ status: "ok", data: { removed: true } }));
    });
    await expect(deleteContinueReading(A)).resolves.toBe(true);
    expect(seenMethod).toBe("DELETE");
  });

  it("throws on remove failure (row state unknown)", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const err = await deleteContinueReading(A).catch((e) => e);
    expect(err).toBeInstanceOf(PreferencesError);
    expect((err as PreferencesError).status).toBe(0);
  });

  it("hydrates the list from preferences GET", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        Response.json({
          status: "ok",
          data: { userId: "u", recentResources: [], continueReading: [A], createdAt: "", updatedAt: "" },
        }),
      ),
    );
    const prefs = await getPreferences();
    expect(prefs?.continueReading).toEqual([A]);
  });
});
