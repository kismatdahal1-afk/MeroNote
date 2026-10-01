/**
 * Step 7 profile integration tests (isolated in-memory MongoDB).
 *
 * Verifies the Google picture → user document → /me → frontend type chain:
 * exposure on /me, picture-validation variants, and create-only profile
 * policy (re-login never rewrites name/picture). No live Google, no prod DB.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { User } from "../../models/user.model";
import { RefreshToken } from "../../models/refreshToken.model";
import { googleCallback, me } from "../auth.controller";
import { OAUTH_STATE_COOKIE, exchangeGoogleCode, verifyGoogleIdentity } from "../google";

vi.mock("../google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../google")>();
  return { ...actual, exchangeGoogleCode: vi.fn(), verifyGoogleIdentity: vi.fn() };
});

const mockedExchange = exchangeGoogleCode as unknown as ReturnType<typeof vi.fn>;
const mockedVerify = verifyGoogleIdentity as unknown as ReturnType<typeof vi.fn>;

interface FakeRes {
  statusCode: number;
  body: unknown;
  redirectUrl: string | null;
  cookies: Record<string, { value: string; options: Record<string, unknown> }>;
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
      void status;
      res.redirectUrl = url;
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

const VALID_STATE = "c".repeat(64);

function loginAs(userId: string): Request {
  return { user: { id: userId, role: "USER" } } as unknown as Request;
}

function callbackReq(sub: string, identity: Record<string, unknown>): Request {
  mockedExchange.mockResolvedValue("id-token");
  mockedVerify.mockResolvedValue({
    sub,
    email: "profile@example.com",
    emailVerified: true,
    name: "Profile User",
    picture: "https://pics.test/photo.png",
    ...identity,
  });
  return {
    query: { code: "auth-code", state: VALID_STATE },
    cookies: { [OAUTH_STATE_COOKIE]: VALID_STATE },
  } as unknown as Request;
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

describe("/me profile exposure", () => {
  it("returns profileImageUrl for a Google user that has one", async () => {
    const created = await User.create({
      name: "G User",
      email: "pic@example.com",
      authProvider: "google",
      googleId: "sub-pic",
      profileImageUrl: "https://pics.test/photo.png",
    });
    const res = fakeRes();
    await me(loginAs(String(created._id)), res as unknown as Response);
    expect(res.body).toEqual({
      status: "ok",
      data: expect.objectContaining({ email: "pic@example.com", profileImageUrl: "https://pics.test/photo.png" }),
    });
  });

  it("omits profileImageUrl for password users and picture-less Google users", async () => {
    const password = await User.create({ name: "Manual", email: "manual@example.com", passwordHash: "h", role: "USER" });
    const bare = await User.create({ name: "G Bare", email: "bare@example.com", authProvider: "google", googleId: "sub-bare" });
    for (const doc of [password, bare]) {
      const res = fakeRes();
      await me(loginAs(String(doc._id)), res as unknown as Response);
      const data = (res.body as { data: Record<string, unknown> }).data;
      expect(data.email).toBe(doc.email);
      expect("profileImageUrl" in data).toBe(false);
    }
  });

  it("never exposes googleId or passwordHash via /me", async () => {
    const created = await User.create({
      name: "G User",
      email: "priv@example.com",
      authProvider: "google",
      googleId: "sub-priv",
      passwordHash: undefined,
      profileImageUrl: "https://pics.test/photo.png",
    });
    const res = fakeRes();
    await me(loginAs(String(created._id)), res as unknown as Response);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect("googleId" in data).toBe(false);
    expect("passwordHash" in data).toBe(false);
  });
});

describe("picture validation variants on Google creation", () => {
  const cases: Array<{ label: string; picture: unknown; stored: string | undefined }> = [
    { label: "valid https", picture: "https://pics.test/photo.png", stored: "https://pics.test/photo.png" },
    { label: "missing", picture: undefined, stored: undefined },
    { label: "empty", picture: "", stored: undefined },
    { label: "http", picture: "http://pics.test/photo.png", stored: undefined },
    { label: "data uri", picture: "data:image/png;base64,aaa", stored: undefined },
    { label: "javascript", picture: "javascript:alert(1)", stored: undefined },
    { label: "overlong", picture: `https://pics.test/${"p".repeat(2048)}`, stored: undefined },
    { label: "not a url", picture: "not a url", stored: undefined },
  ];

  for (const { label, picture, stored } of cases) {
    it(`stores ${stored ?? "nothing"} for ${label} picture`, async () => {
      const res = fakeRes();
      await googleCallback(callbackReq(`sub-${label.replace(/[^a-z]/g, "")}`, { picture }), res as unknown as Response);
      expect(res.redirectUrl).toBe("https://app.test/");
      const doc = await User.findOne({ email: "profile@example.com" }).lean().exec();
      expect(doc).not.toBeNull();
      expect((doc as { profileImageUrl?: string } | null)?.profileImageUrl).toBe(stored);
    });
  }
});

describe("create-only profile policy", () => {
  it("never rewrites name or picture on re-login", async () => {
    await User.create({
      name: "Original Name",
      email: "stable@example.com",
      authProvider: "google",
      googleId: "sub-stable",
      profileImageUrl: "https://pics.test/original.png",
    });
    const res = fakeRes();
    await googleCallback(
      callbackReq("sub-stable", { email: "stable@example.com", name: "Changed Name", picture: "https://pics.test/new.png" }),
      res as unknown as Response,
    );
    expect(res.redirectUrl).toBe("https://app.test/");
    const doc = await User.findOne({ email: "stable@example.com" }).lean().exec();
    expect((doc as { name?: string } | null)?.name).toBe("Original Name");
    expect((doc as { profileImageUrl?: string } | null)?.profileImageUrl).toBe("https://pics.test/original.png");
    expect(await User.countDocuments()).toBe(1);
  });
});
