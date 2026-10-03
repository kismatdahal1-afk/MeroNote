/**
 * Step 5 account-policy hardening tests (isolated in-memory MongoDB).
 *
 * Locks in the finalized policy: one email = one user, no automatic
 * linking, Google identity anchored to stable `sub`, rejections issue no
 * session. Never touches live Google, production MongoDB, or real secrets:
 * the provider boundary is mocked and env values are synthetic constants.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { User } from "../../models/user.model";
import { RefreshToken } from "../../models/refreshToken.model";
import { googleCallback, login, register } from "../auth.controller";
import { OAUTH_STATE_COOKIE, exchangeGoogleCode, verifyGoogleIdentity } from "../google";

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
  cookies: Record<string, CapturedCookie>;
  cleared: string[];
  status(code: number): FakeRes;
  json(payload: unknown): void;
  redirect(status: number, url: string): void;
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string): void;
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    cookies: {},
    cleared: [],
    status(code: number): FakeRes {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown): void {
      res.body = payload;
    },
    redirect(status: number, url: string): void {
      res.redirectUrl = url;
      void status;
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

function bodyReq(body: Record<string, unknown>): Request {
  return { body, query: {}, cookies: {} } as unknown as Request;
}

const VALID_STATE = "b".repeat(64);

function callbackReq(sub: string, email: string, overrides: Record<string, unknown> = {}): Request {
  mockedExchange.mockResolvedValue("id-token");
  mockedVerify.mockResolvedValue({
    sub,
    email,
    emailVerified: true,
    name: "G User",
    picture: "https://pics.test/photo.png",
    ...overrides,
  });
  return {
    query: { code: "auth-code", state: VALID_STATE },
    cookies: { [OAUTH_STATE_COOKIE]: VALID_STATE },
  } as unknown as Request;
}

async function authSnapshot(email: string): Promise<Record<string, unknown> | null> {
  const doc = await User.findOne({ email }).select("+passwordHash").lean().exec();
  if (!doc) return null;
  const { email: e, authProvider, googleId, passwordHash, profileImageUrl, name, role, sessionVersion } =
    doc as unknown as Record<string, unknown>;
  return { email: e, authProvider, googleId, passwordHash, profileImageUrl, name, role, sessionVersion };
}

function expectNoSession(res: FakeRes): void {
  expect(res.cookies.meronote_session).toBeUndefined();
  expect(res.cookies.meronote_refresh).toBeUndefined();
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
});

describe("password registration policy", () => {
  it("creates a password user with default provider and no googleId", async () => {
    const res = fakeRes();
    await register(
      bodyReq({ name: "Manual", email: "Manual@Example.com", password: "Password-123@", confirmPassword: "Password-123@" }),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(201);
    const stored = await authSnapshot("manual@example.com");
    expect(stored).toMatchObject({ authProvider: "password", email: "manual@example.com", name: "Manual" });
    expect(stored?.googleId).toBeUndefined();
    expect(typeof stored?.passwordHash).toBe("string");
    expect(res.cookies.meronote_session?.options.httpOnly).toBe(true);
  });

  it("rejects a duplicate password email without touching the account", async () => {
    await User.create({ name: "Manual", email: "dup@example.com", passwordHash: "original-hash", role: "USER" });
    const before = await authSnapshot("dup@example.com");
    const res = fakeRes();
    await register(
      bodyReq({ name: "Other", email: "dup@example.com", password: "Password-123@", confirmPassword: "Password-123@" }),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ status: "error", message: "An account with this email already exists." });
    expect(await authSnapshot("dup@example.com")).toEqual(before);
    expect(await User.countDocuments({ email: "dup@example.com" })).toBe(1);
    expectNoSession(res);
  });

  it("rejects registration on a Google-owned email without converting it", async () => {
    await User.create({ name: "G User", email: "gowned@example.com", authProvider: "google", googleId: "sub-owned" });
    const before = await authSnapshot("gowned@example.com");
    const res = fakeRes();
    await register(
      bodyReq({ name: "Manual", email: "gowned@example.com", password: "Password-123@", confirmPassword: "Password-123@" }),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(409);
    expect(await authSnapshot("gowned@example.com")).toEqual(before);
    expect(await User.countDocuments({ email: "gowned@example.com" })).toBe(1);
    expectNoSession(res);
  });

  it("treats case-variant emails as the same account", async () => {
    await User.create({ name: "Manual", email: "case@example.com", passwordHash: "original-hash", role: "USER" });
    const res = fakeRes();
    await register(
      bodyReq({ name: "Other", email: "CASE@EXAMPLE.COM", password: "Password-123@", confirmPassword: "Password-123@" }),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(409);
    expect(await User.countDocuments({ email: "case@example.com" })).toBe(1);
    expectNoSession(res);
  });
});

describe("password login compatibility", () => {
  it("rejects a Google-only account on the password path without a session", async () => {
    await User.create({ name: "G User", email: "gonly@example.com", authProvider: "google", googleId: "sub-only" });
    const res = fakeRes();
    await login(bodyReq({ email: "gonly@example.com", password: "anything-123" }), res as unknown as Response);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ status: "error", message: "Invalid email or password." });
    expectNoSession(res);
  });
});

describe("google identity precedence and normalization", () => {
  it("authenticates by sub even when the Google email changed, without rewriting it", async () => {
    await User.create({ name: "G User", email: "old@example.com", authProvider: "google", googleId: "sub-stable" });
    const res = fakeRes();
    await googleCallback(callbackReq("sub-stable", "new@example.com"), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/");
    expect(await User.countDocuments({ googleId: "sub-stable" })).toBe(1);
    expect((await authSnapshot("old@example.com"))?.email).toBe("old@example.com");
    expect(await User.countDocuments({ email: "new@example.com" })).toBe(0);
    expect(res.cookies.meronote_session?.options.httpOnly).toBe(true);
  });

  it("rejects an unverified email before any lookup, even for a known sub", async () => {
    await User.create({ name: "G User", email: "known@example.com", authProvider: "google", googleId: "sub-known" });
    const before = await authSnapshot("known@example.com");
    const res = fakeRes();
    await googleCallback(callbackReq("sub-known", "known@example.com", { emailVerified: false }), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_unverified_email");
    expect(await authSnapshot("known@example.com")).toEqual(before);
    expectNoSession(res);
  });

  it("matches password-email and conflict cases case-insensitively", async () => {
    await User.create({ name: "Manual", email: "mixed@example.com", passwordHash: "h", role: "USER" });
    await User.create({ name: "G Other", email: "gother@example.com", authProvider: "google", googleId: "sub-other-old" });
    const upperPassword = fakeRes();
    await googleCallback(callbackReq("sub-new", "MIXED@EXAMPLE.COM"), upperPassword as unknown as Response);
    expect(upperPassword.redirectUrl).toBe("https://app.test/login?error=google_email_registered");
    expectNoSession(upperPassword);
    const upperConflict = fakeRes();
    await googleCallback(callbackReq("sub-other-new", "GOTHER@EXAMPLE.COM"), upperConflict as unknown as Response);
    expect(upperConflict.redirectUrl).toBe("https://app.test/login?error=google_conflict");
    expectNoSession(upperConflict);
    expect(await User.countDocuments()).toBe(2);
  });
});

describe("creation races", () => {
  it("re-resolves by googleId when creation loses a same-identity race", async () => {
    await User.create({ name: "G User", email: "race@example.com", authProvider: "google", googleId: "sub-race" });
    const createSpy = vi.spyOn(User, "create");
    createSpy.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: 11000 }));
    try {
      const res = fakeRes();
      await googleCallback(callbackReq("sub-race", "race@example.com"), res as unknown as Response);
      expect(res.redirectUrl).toBe("https://app.test/");
      expect(res.cookies.meronote_session?.options.httpOnly).toBe(true);
      expect(await User.countDocuments({ email: "race@example.com" })).toBe(1);
    } finally {
      createSpy.mockRestore();
    }
  });

  it("refuses a session when the race resolves to no matching identity", async () => {
    const createSpy = vi.spyOn(User, "create");
    createSpy.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: 11000 }));
    try {
      const res = fakeRes();
      await googleCallback(callbackReq("sub-ghost", "ghost@example.com"), res as unknown as Response);
      expect(res.redirectUrl).toBe("https://app.test/login?error=google_conflict");
      expectNoSession(res);
      expect(await User.countDocuments()).toBe(0);
    } finally {
      createSpy.mockRestore();
    }
  });
});

describe("database indexes and document shape", () => {
  it("enforces email uniqueness at the database level", async () => {
    await User.create({ name: "A", email: "idx@example.com", passwordHash: "h", role: "USER" });
    await expect(User.create({ name: "B", email: "idx@example.com", passwordHash: "h", role: "USER" })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("enforces sparse unique googleId while password users coexist without one", async () => {
    await User.create({ name: "P1", email: "p1@example.com", passwordHash: "h", role: "USER" });
    await User.create({ name: "P2", email: "p2@example.com", passwordHash: "h", role: "USER" });
    await User.create({ name: "G1", email: "g1@example.com", authProvider: "google", googleId: "sub-dup" });
    await expect(
      User.create({ name: "G2", email: "g2@example.com", authProvider: "google", googleId: "sub-dup" }),
    ).rejects.toMatchObject({ code: 11000 });
    const indexes = (await User.collection.listIndexes().toArray()) as Array<{
      key?: Record<string, unknown>;
      unique?: boolean;
      sparse?: boolean;
    }>;
    expect(indexes.find((index) => index.key?.googleId === 1 && index.unique === true && index.sparse === true)).toBeDefined();
  });

  it("rejects unknown authProvider values", async () => {
    await expect(
      // "facebook" is invalid at runtime; the cast only satisfies the static type.
      User.create({ name: "X", email: "x@example.com", authProvider: "facebook" as unknown as "password", passwordHash: "h", role: "USER" }),
    ).rejects.toThrow();
  });
});

describe("rejection snapshots and session safety", () => {
  it("leaves a password account fully unchanged on same-email Google login", async () => {
    await User.create({
      name: "Manual",
      email: "snap@example.com",
      authProvider: "password",
      passwordHash: "snap-hash",
      profileImageUrl: "https://pics.test/manual.png",
      role: "USER",
    });
    const before = await authSnapshot("snap@example.com");
    const res = fakeRes();
    await googleCallback(callbackReq("sub-snap-new", "snap@example.com"), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_email_registered");
    expect(await authSnapshot("snap@example.com")).toEqual(before);
    expectNoSession(res);
  });

  it("leaves a Google account fully unchanged on identity conflict", async () => {
    await User.create({
      name: "G Snap",
      email: "gsnap@example.com",
      authProvider: "google",
      googleId: "sub-snap-old",
      profileImageUrl: "https://pics.test/old.png",
    });
    const before = await authSnapshot("gsnap@example.com");
    const res = fakeRes();
    await googleCallback(callbackReq("sub-snap-new", "gsnap@example.com"), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_conflict");
    expect(await authSnapshot("gsnap@example.com")).toEqual(before);
    expectNoSession(res);
  });

  it("issues no session on unverified-email rejection", async () => {
    const res = fakeRes();
    await googleCallback(callbackReq("sub-no", "nouser@example.com", { emailVerified: false }), res as unknown as Response);
    expect(res.redirectUrl).toBe("https://app.test/login?error=google_unverified_email");
    expectNoSession(res);
    expect(await User.countDocuments()).toBe(0);
  });
});
