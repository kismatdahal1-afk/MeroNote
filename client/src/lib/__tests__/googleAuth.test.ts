import { afterEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_ERROR_CODES, googleErrorMessage, googleOAuthUrl } from "../googleAuth";

describe("googleOAuthUrl", () => {
  it("points at the backend Google entry with the default API origin", () => {
    expect(googleOAuthUrl()).toBe("http://localhost:5000/api/auth/google");
  });

  it("uses the configured VITE_API_URL without hardcoding hosts", async () => {
    vi.stubEnv("VITE_API_URL", "https://meronote-api.onrender.com");
    vi.resetModules();
    const mod = await import("../googleAuth");
    expect(mod.googleOAuthUrl()).toBe("https://meronote-api.onrender.com/api/auth/google");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});

describe("googleErrorMessage", () => {
  it("maps every backend failure code to a user-facing message", () => {
    expect(GOOGLE_ERROR_CODES).toHaveLength(6);
    for (const code of GOOGLE_ERROR_CODES) {
      const message = googleErrorMessage(code);
      expect(typeof message).toBe("string");
      expect(message?.length).toBeGreaterThan(0);
    }
  });

  it("explains duplicate registration without backend details", () => {
    expect(googleErrorMessage("google_email_registered")).toBe(
      "This email is already registered. Please log in with your password.",
    );
  });

  it("never exposes the Google subject on identity conflicts", () => {
    const message = googleErrorMessage("google_conflict") ?? "";
    expect(message).not.toMatch(/sub/i);
    expect(message.length).toBeGreaterThan(0);
  });

  it("ignores unknown, null, and empty codes", () => {
    expect(googleErrorMessage("google_invented")).toBeNull();
    expect(googleErrorMessage(null)).toBeNull();
    expect(googleErrorMessage("")).toBeNull();
  });
});
