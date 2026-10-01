/**
 * Step 4 Google OAuth tests (mocked provider, isolated in-memory MongoDB).
 *
 * Never touches live Google servers, production MongoDB, or real `.env`
 * secrets: the provider boundary (exchange/verify) is mocked and all
 * persistence goes to mongodb-memory-server. Env values used here are
 * synthetic test constants assigned directly (never read from disk).
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { User } from "../../models/user.model";
import { RefreshToken } from "../../models/refreshToken.model";
import { googleAuth, googleCallback } from "../auth.controller";
import {
  GOOGLE_SCOPES,
  OAUTH_STATE_COOKIE,
  buildGoogleAuthUrl,
  clearOAuthState,
  exchangeGoogleCode,
  googleOAuthEnabled,
  issueOAuthState,
  readOAuthState,
  verifyGoogleIdentity,
} from "../google";

vi.mock("../google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../google")>();
  return { ...actual, exchangeGoogleCode: vi.fn(), verifyGoogleIdentity: vi.fn() };
});

const mockedExchange = exchangeGoogleCode as unknown as ReturnType<typeof vi.fn>;
const mockedVerify = verifyGoogleIdentity as unknown as ReturnType<typeof vi.fn>;

interface CapturedCookie {
  value: string;
  options: Record<string, unknown>;
}

interface FakeRes {
  statusCode: number;
  body: unknown;
  redirectUrl: string | null;
  redirectStatus: number | null;
  cookies: Record<string, CapturedCookie>;
  cleared: string[];
  status(code: number): FakeRes;
  json(payload: unknown): void;
  redirect(url: string): void;
  redirect(status: number, url: string): void;
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options?: Record<string, unknown>): void;
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    redirectStatus: null,
    cookies: {},
    cleared: [],
    status(code: number): FakeRes {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown): void {
      res.body = payload;
    },
    redirect(urlOrStatus: string | number, url?: string): void {
      if (typeof urlOrStatus === "number") {
        res.redirectStatus = urlOrStatus;
        res.redirectUrl = url ?? null;
      } else {
        res.redirectStatus = 302;
        res.redirectUrl = urlOrStatus;
      }
    },
    cookie(name: string, value: string, options: Record<string, unknown>): void {
      res.cookies[name] = { value, options };
    },
    clearCookie(name: string): void {
      res.cleared.push(name);
      delete res.cookies[name];
    },
  };
  return res;
}

function fakeReq(query: Record<string, unknown>, cookies: Record<string, string> = {}): Request {
  return { query, cookies } as unknown as Request;
}

const VALID_STATE = "a".repeat(64);

function callbackReq(state: string, cookiesState: string | null, extraQuery: Record<string, unknown> = {}): Request {
  const cookies: Record<string, string> = {};
  if (cookiesState !== null) cookies[OAUTH_STATE_COOKIE] = cookiesState;
  return fakeReq({ code: "auth-code", state, ...extraQuery }, cookies);
}

function mockIdentity(overrides: Record<string, unknown> = {}) {
  return {
    sub: "google-sub-1",
    email: "guser@example.com",
    emailVerified: true,
    name: "G User",
    picture: "https://pics.test/photo.png",
    ...overrides,
  };
}

let mongo: MongoMemoryServer;
const savedEnv = { ...env };

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.ensureIndexes();
  await RefreshToken.ensureIndexes();
  env.clientUrl = "https://app.test";
  env.googleClientId = "test-client-id";
  env.googleClientSecret = "test-client-secret";
  env.googleCallbackUrl = "https://api.test/api/auth/google/callback";
  env.jwtExpiresDays = 7;
  env.nodeEnv = "test";
}, 60000);

afterAll(async () => {
  env.clientUrl = savedEnv.clientUrl;
  env.googleClientId = savedEnv.googleClientId;
  env.googleClientSecret = savedEnv.googleClientSecret;
  env.googleCallbackUrl = savedEnv.googleCallbackUrl;
  env.jwtExpiresDays = savedEnv.jwtExpiresDays;
  env.nodeEnv = savedEnv.nodeEnv;
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  vi.clearAllMocks();
  env.googleClientId = "test-client-id";
  env.googleClientSecret = "test-client-secret";
  env.googleCallbackUrl = "https://api.test/api/auth/google/callback";
});

describe("google provider helpers", () => {
  it("builds an authorization URL with configured values and minimum scopes", () => {
    const url = new URL(buildGoogleAuthUrl("state-123"));
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://api.test/api/auth/google/callback");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("response_type")).toBe("code");
    const scope = url.searchParams.get("scope") ?? "";
    for (const required of GOOGLE_SCOPES) expect(scope.split(" ")).toContain(required);
  });

  it("issues an opaque single-use state bound via HttpOnly cookie", () => {
    const res = fakeRes();
    const first = issueOAuthState(res as unknown as Response);
    const second = issueOAuthState(res as unknown as Response);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
    expect(res.cookies[OAUTH_STATE_COOKIE].options.httpOnly).toBe(true);
    expect(readOAuthState({ cookies: { [OAUTH_STATE_COOKIE]: second } } as unknown as Request)).toBe(second);
    clearOAuthState(res as unknown as Response);
    expect(res.cleared).toContain(OAUTH_STATE_COOKIE);
  });

  it("reports configuration availability without secrets", () => {
    expect(googleOAuthEnabled()).toBe(true);
    env.googleClientSecret = "";
    expect(googleOAuthEnabled()).toBe(false);
  });
});

describe("GET /api/auth/google", () => {
  it("returns 503 JSON when Google OAuth is unconfigured", () => {
    env.googleClientId = "";
    const res = fakeRes();
    googleAuth(fakeReq({}) as Request, res as unknown as Response);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ status: "error", message: "Google sign-in is not available right now." });
  });

  it("sets a fresh state cookie and redirects to Google", () => {
    const res = fakeRes();
    googleAuth(fakeReq({}) as Request, res as unknown as Response);
    expect(res.redirectStatus).toBe(302);
    expect(res.redirectUrl).toContain("accounts.google.com");
    const state = res.cookies[OAUTH_STATE_COOKIE]?.value ?? "";
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(res.redirectUrl).toContain(`state=${state}`);
  });
});

describe("GET /api/auth/google/callback", () => {
  it("rejects provider denial without touching identity", async () => {
    const res = fakeRes();
    await googleCallback(fakeReq({ error: "access_denied" }, { [OAUTH_STATE_COOKIE]: VALID_STATE }), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_denied");
    expect(res.cleared).toContain(OAUTH_STATE_COOKIE);
    expect(mockedExchange).not.toHaveBeenCalled();
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects missing code/state", async () => {
    const res = fakeRes();
    await googleCallback(fakeReq({}, { [OAUTH_STATE_COOKIE]: VALID_STATE }), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_invalid_state");
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects state mismatch and consumes the state (no replay)", async () => {
    mockedExchange.mockResolvedValue("id-token");
    mockedVerify.mockResolvedValue(mockIdentity());
    const first = fakeRes();
    await googleCallback(callbackReq("wrong-state", VALID_STATE), first as unknown as Response);
    expect(first.redirectUrl).toBe("https://app.test/login?error=google_invalid_state");
    expect(mockedExchange).not.toHaveBeenCalled();

    // Replay with the consumed state and no cookie: still rejected.
    const replay = fakeRes();
    await googleCallback(callbackReq(VALID_STATE, null), replay as unknown as Response);
    expect(replay.redirectUrl).toBe("https://app.test/login?error=google_invalid_state");
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects exchange/verification failure safely", async () => {
    mockedExchange.mockRejectedValue(new Error("bad code"));
    const res = fakeRes();
    await googleCallback(callbackReq(VALID_STATE, VALID_STATE), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_failed");
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects unverified or missing email without creating a user", async () => {
    mockedExchange.mockResolvedValue("id-token");
    mockedVerify.mockResolvedValue(mockIdentity({ emailVerified: false }));
    const res = fakeRes();
    await googleCallback(callbackReq(VALID_STATE, VALID_STATE), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_unverified_email");
    expect(await User.countDocuments()).toBe(0);
  });

  it("authenticates the existing Google user without duplicating (Case A)", async () => {
    await User.create({ name: "G User", email: "guser@example.com", authProvider: "google", googleId: "google-sub-1" });
    mockedExchange.mockResolvedValue("id-token");
    mockedVerify.mockResolvedValue(mockIdentity());
    const res = fakeRes();
    await googleCallback(callbackReq(VALID_STATE, VALID_STATE), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/");
    expect(await User.countDocuments()).toBe(1);
    expect(res.cookies.meronote_session?.options.httpOnly).toBe(true);
    expect(res.cookies.meronote_refresh?.options.httpOnly).toBe(true);
    expect(res.cookies.meronote_csrf).toBeDefined();
    expect(res.cookies.meronote_csrf?.options.httpOnly).toBe(false);
  });

  it("creates one Google user with normalized email and no password (Case B)", async () => {
    mockedExchange.mockResolvedValue("id-token");
    mockedVerify.mockResolvedValue(mockIdentity({ email: "New.User@Example.COM", name: "  New User  " }));
    const res = fakeRes();
    await googleCallback(callbackReq(VALID_STATE, VALID_STATE), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/");
    const stored = await User.findOne({ email: "new.user@example.com" }).select("+passwordHash").lean().exec();
    expect(stored).not.toBeNull();
    expect(stored).toMatchObject({ authProvider: "google", googleId: "google-sub-1", name: "New User", email: "new.user@example.com" });
    expect((stored as { passwordHash?: string } | null)?.passwordHash).toBeUndefined();
    expect(res.cookies.meronote_session).toBeDefined();
    expect(res.cookies.meronote_refresh).toBeDefined();
  });

  it("rejects when the email belongs to a password account, leaving it unchanged (Case C)", async () => {
    await User.create({ name: "Manual", email: "guser@example.com", authProvider: "password", passwordHash: "existing-hash" });
    mockedExchange.mockResolvedValue("id-token");
    mockedVerify.mockResolvedValue(mockIdentity());
    const res = fakeRes();
    await googleCallback(callbackReq(VALID_STATE, VALID_STATE), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_email_registered");
    const stored = await User.findOne({ email: "guser@example.com" }).select("+passwordHash").lean().exec();
    expect(stored).toMatchObject({ authProvider: "password", passwordHash: "existing-hash" });
    expect((stored as { googleId?: string } | null)?.googleId).toBeUndefined();
    expect(res.cookies.meronote_session).toBeUndefined();
    expect(await User.countDocuments()).toBe(1);
  });

  it("never reassigns googleId on identity conflict (Case D)", async () => {
    await User.create({ name: "G User", email: "guser@example.com", authProvider: "google", googleId: "google-sub-old" });
    mockedExchange.mockResolvedValue("id-token");
    mockedVerify.mockResolvedValue(mockIdentity({ sub: "google-sub-new" }));
    const res = fakeRes();
    await googleCallback(callbackReq(VALID_STATE, VALID_STATE), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_conflict");
    const stored = await User.findOne({ email: "guser@example.com" }).lean().exec();
    expect((stored as { googleId?: string } | null)?.googleId).toBe("google-sub-old");
    expect(res.cookies.meronote_session).toBeUndefined();
    expect(await User.countDocuments()).toBe(1);
  });
});
