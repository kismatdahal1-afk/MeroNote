import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  initiateRegisterRequest,
  resendOtpRequest,
  verifyOtpRequest,
} from "../authApi";
import {
  INITIAL_RESEND_COOLDOWN_SECONDS,
  OTP_LENGTH,
  OTP_VALIDITY_SECONDS,
  clearOtpIssuedAt,
  clearPendingEmail,
  formatCountdownMMSS,
  isValidOtpFormat,
  maskEmail,
  readOtpIssuedAt,
  readPendingEmail,
  remainingOtpSeconds,
  saveOtpIssuedAt,
  savePendingEmail,
} from "../otpFlow";

/**
 * Step 5 OTP registration client tests (no network, no DOM).
 * fetch is mocked. Proves: the three endpoints are called with the right
 * paths/bodies, backend 400/409/429/500 surfaces map to AuthError with
 * retryAfterSeconds/attemptsLeft preserved, helpers behave, and only the
 * non-sensitive pending email ever touches sessionStorage (never password,
 * OTP, or tokens; never the URL).
 */

function mockFetchOnce(handler: () => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const spy = vi.fn(handler);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubSessionStorage(): { store: Record<string, string>; setCalls: string[][] } {
  const store: Record<string, string> = {};
  const setCalls: string[][] = [];
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        setCalls.push([key, value]);
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    },
  });
  return { store, setCalls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OTP registration requests", () => {
  it("calls /register/initiate with the registration fields", async () => {
    const spy = mockFetchOnce(() => jsonResponse({ status: "ok", message: "Verification code sent." }, 200));
    await expect(
      initiateRegisterRequest("Manual", "otp@example.com", "correct-horse-8", "correct-horse-8"),
    ).resolves.toMatchObject({ status: "ok" });
    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/register/initiate");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Manual",
      email: "otp@example.com",
      password: "correct-horse-8",
      confirmPassword: "correct-horse-8",
    });
  });

  it("calls /register/verify and returns the SafeUser", async () => {
    const spy = mockFetchOnce(() =>
      jsonResponse({ status: "ok", data: { id: "1", name: "Manual", email: "otp@example.com", role: "USER" } }, 201),
    );
    await expect(verifyOtpRequest("otp@example.com", "123456")).resolves.toMatchObject({
      email: "otp@example.com",
    });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/register/verify");
    expect(JSON.parse(init.body as string)).toEqual({ email: "otp@example.com", otp: "123456" });
    expect(spy).toHaveBeenCalledOnce();
  });

  it("calls /register/resend with only the email", async () => {
    const spy = mockFetchOnce(() => jsonResponse({ status: "ok", message: "Verification code sent." }, 200));
    await resendOtpRequest("otp@example.com");
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/register/resend");
    expect(JSON.parse(init.body as string)).toEqual({ email: "otp@example.com" });
  });

  it("carries no tokens in request bodies or URLs", async () => {
    const spy = mockFetchOnce(() => jsonResponse({ status: "ok", message: "ok" }, 200));
    await initiateRegisterRequest("Manual", "otp@example.com", "correct-horse-8", "correct-horse-8");
    await resendOtpRequest("otp@example.com");
    for (const [url] of spy.mock.calls as [string][]) {
      expect(url).not.toContain("123456");
      expect(url).not.toContain("correct-horse-8");
      expect(url).not.toContain("?");
    }
  });
});

describe("OTP error mapping", () => {
  it("maps 400 wrong-OTP with attemptsLeft", async () => {
    mockFetchOnce(() => jsonResponse({ status: "error", message: "Incorrect verification code.", attemptsLeft: 3 }, 400));
    const err = await verifyOtpRequest("otp@example.com", "000000").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).status).toBe(400);
    expect((err as AuthError).attemptsLeft).toBe(3);
    expect((err as AuthError).retryAfterSeconds).toBeUndefined();
  });

  it("maps 429 with retryAfterSeconds", async () => {
    mockFetchOnce(() =>
      jsonResponse({ status: "error", message: "Please wait before requesting another code.", retryAfterSeconds: 42 }, 429),
    );
    const err = await resendOtpRequest("otp@example.com").catch((e: unknown) => e);
    expect((err as AuthError).status).toBe(429);
    expect((err as AuthError).retryAfterSeconds).toBe(42);
  });

  it("maps 409 duplicate and 500 provider failure without internals", async () => {
    mockFetchOnce(() =>
      jsonResponse({ status: "error", message: "An account with this email already exists." }, 409),
    );
    const dup = await initiateRegisterRequest("M", "e@x.com", "correct-horse-8", "correct-horse-8").catch(
      (e: unknown) => e,
    );
    expect((dup as AuthError).status).toBe(409);
    expect((dup as AuthError).message).toBe("An account with this email already exists.");

    mockFetchOnce(() => jsonResponse({ status: "error", message: "We could not send the verification email." }, 500));
    const failed = await resendOtpRequest("otp@example.com").catch((e: unknown) => e);
    expect((failed as AuthError).status).toBe(500);
    expect(JSON.stringify((failed as AuthError).message)).not.toContain("resend");
  });

  it("ignores non-numeric retry/attempt fields", async () => {
    mockFetchOnce(() =>
      jsonResponse({ status: "error", message: "Too many attempts.", retryAfterSeconds: "soon", attemptsLeft: null }, 429),
    );
    const err = await verifyOtpRequest("otp@example.com", "000000").catch((e: unknown) => e);
    expect((err as AuthError).retryAfterSeconds).toBeUndefined();
    expect((err as AuthError).attemptsLeft).toBeUndefined();
  });
});

describe("otpFlow helpers", () => {
  it("validates the 6-digit OTP format", () => {
    expect(OTP_LENGTH).toBe(6);
    expect(INITIAL_RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(OTP_VALIDITY_SECONDS).toBe(120);
    expect(isValidOtpFormat("123456")).toBe(true);
    expect(isValidOtpFormat("12345")).toBe(false);
    expect(isValidOtpFormat("1234567")).toBe(false);
    expect(isValidOtpFormat("12345a")).toBe(false);
    expect(isValidOtpFormat("12 456")).toBe(false);
    expect(isValidOtpFormat("")).toBe(false);
  });

  it("formats timer countdowns as MM:SS", () => {
    expect(formatCountdownMMSS(120)).toBe("02:00");
    expect(formatCountdownMMSS(102)).toBe("01:42");
    expect(formatCountdownMMSS(60)).toBe("01:00");
    expect(formatCountdownMMSS(59)).toBe("00:59");
    expect(formatCountdownMMSS(37)).toBe("00:37");
    expect(formatCountdownMMSS(5)).toBe("00:05");
    expect(formatCountdownMMSS(1)).toBe("00:01");
    expect(formatCountdownMMSS(0)).toBe("00:00");
    expect(formatCountdownMMSS(-7)).toBe("00:00");
  });

  it("masks emails without leaking the local part", () => {
    expect(maskEmail("kismat@gmail.com")).toBe("k***@gmail.com");
    expect(maskEmail("a@x.io")).toBe("a***@x.io");
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail("otp@example.com")).not.toContain("otp");
  });

  it("round-trips only the pending email through sessionStorage", () => {
    stubSessionStorage();
    expect(readPendingEmail()).toBe("");
    savePendingEmail("otp@example.com");
    expect(readPendingEmail()).toBe("otp@example.com");
    clearPendingEmail();
    expect(readPendingEmail()).toBe("");
  });

  it("never writes password, OTP, or tokens to storage", () => {
    const { setCalls } = stubSessionStorage();
    savePendingEmail("otp@example.com");
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0][1]).toBe("otp@example.com");
    expect(setCalls[0][1]).not.toContain("correct-horse-8");
  });

  it("tolerates missing storage without throwing", () => {
    vi.stubGlobal("window", undefined);
    expect(() => savePendingEmail("otp@example.com")).not.toThrow();
    expect(readPendingEmail()).toBe("");
    expect(() => clearPendingEmail()).not.toThrow();
  });

  it("round-trips only the OTP issuance timestamp", () => {
    const { store, setCalls } = stubSessionStorage();
    expect(readOtpIssuedAt()).toBeNull();
    saveOtpIssuedAt(1700000000000);
    expect(readOtpIssuedAt()).toBe(1700000000000);
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0][0]).not.toContain("email");
    expect(setCalls[0][1]).toBe("1700000000000");
    expect(Object.keys(store)).toEqual(["meronote_otp_issued_at"]);
    clearOtpIssuedAt();
    expect(readOtpIssuedAt()).toBeNull();
  });

  it("rejects invalid stored timestamps", () => {
    const { store } = stubSessionStorage();
    for (const bad of ["", "not-a-number", "-5", "0", "Infinity", "12.5x"]) {
      store["meronote_otp_issued_at"] = bad;
      expect(readOtpIssuedAt()).toBeNull();
    }
  });

  it("reconstructs the remaining OTP lifetime after refresh", () => {
    const now = 1700000000000;
    expect(remainingOtpSeconds(now, now)).toBe(120);
    expect(remainingOtpSeconds(now - 80_000, now)).toBe(40);
    expect(remainingOtpSeconds(now - 119_000, now)).toBe(1);
    expect(remainingOtpSeconds(now - 120_000, now)).toBe(0);
    expect(remainingOtpSeconds(now - 3600_000, now)).toBe(0);
    expect(remainingOtpSeconds(null, now)).toBe(120);
    // Future timestamps clamp to the full window instead of overshooting.
    expect(remainingOtpSeconds(now + 30_000, now)).toBe(120);
  });

  it("overwrites the timestamp on resend without touching anything else", () => {
    const { store, setCalls } = stubSessionStorage();
    savePendingEmail("otp@example.com");
    saveOtpIssuedAt(1000);
    saveOtpIssuedAt(2000);
    expect(readOtpIssuedAt()).toBe(2000);
    expect(readPendingEmail()).toBe("otp@example.com");
    expect(setCalls.filter(([key]) => key === "meronote_otp_issued_at")).toHaveLength(2);
    expect(Object.keys(store).sort()).toEqual(["meronote_otp_issued_at", "meronote_pending_email"]);
  });
});
