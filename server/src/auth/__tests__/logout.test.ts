/**
 * Step 8 logout-invalidation regression tests (isolated in-memory MongoDB).
 *
 * Covers the expired-access logout gap: logging out with an invalid access
 * JWT but a valid refresh cookie must still bump the session epoch so live
 * access JWTs on other devices stop working. No prod DB, no secrets.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { User } from "../../models/user.model";
import { RefreshToken } from "../../models/refreshToken.model";
import { issueSession, logout } from "../auth.controller";
import { requireAuth } from "../auth.middleware";

interface FakeRes {
  statusCode: number;
  body: unknown;
  cookies: Record<string, { value: string; options: Record<string, unknown> }>;
  cleared: string[];
  status(code: number): FakeRes;
  json(payload: unknown): void;
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string): void;
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: null,
    cookies: {},
    cleared: [],
    status(code: number): FakeRes {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown): void {
      res.body = payload;
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

async function authedReq(cookies: Record<string, string>): Promise<{ status: number; userId: string | null }> {
  const req = { cookies } as unknown as Request;
  const res = fakeRes();
  let status = 200;
  const resWithCapture = {
    ...res,
    status(code: number) {
      status = code;
      return resWithCapture;
    },
    json(payload: unknown) {
      res.body = payload;
    },
  };
  let nextCalled = false;
  await requireAuth(req, resWithCapture as unknown as Response, () => {
    nextCalled = true;
  });
  return { status, userId: nextCalled ? (req.user?.id ?? null) : null };
}

let mongo: MongoMemoryServer;
const savedEnv = { ...env };

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.ensureIndexes();
  await RefreshToken.ensureIndexes();
  env.clientUrl = "https://app.test";
  env.jwtExpiresDays = 7;
  env.nodeEnv = "test";
}, 60000);

afterAll(async () => {
  env.clientUrl = savedEnv.clientUrl;
  env.jwtExpiresDays = savedEnv.jwtExpiresDays;
  env.nodeEnv = savedEnv.nodeEnv;
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

async function createSession(): Promise<{ userId: string; session: string; refresh: string }> {
  const created = await User.create({ name: "Manual", email: "logout@example.com", passwordHash: "h", role: "USER" });
  const userId = String(created._id);
  const res = fakeRes();
  await issueSession(res as unknown as Response, userId, "USER", 0, env.jwtExpiresDays);
  return { userId, session: res.cookies.meronote_session.value, refresh: res.cookies.meronote_refresh.value };
}

describe("logout session invalidation", () => {
  it("bumps the epoch on normal logout and kills the access JWT", async () => {
    const { userId, session, refresh } = await createSession();
    expect((await authedReq({ meronote_session: session })).userId).toBe(userId);

    const res = fakeRes();
    await logout({ cookies: { meronote_session: session, meronote_refresh: refresh } } as unknown as Request, res as unknown as Response);
    expect(res.statusCode).toBe(200);
    expect((await User.findById(userId).lean().exec() as { sessionVersion?: number } | null)?.sessionVersion).toBe(1);
    expect((await authedReq({ meronote_session: session })).status).toBe(401);
  });

  it("bumps the epoch when the access JWT is invalid but refresh is valid", async () => {
    const { userId, session, refresh } = await createSession();
    expect((await authedReq({ meronote_session: session })).userId).toBe(userId);

    const res = fakeRes();
    await logout(
      { cookies: { meronote_session: "tampered-or-expired-token", meronote_refresh: refresh } } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    expect(res.cleared).toContain("meronote_session");
    expect((await User.findById(userId).lean().exec() as { sessionVersion?: number } | null)?.sessionVersion).toBe(1);
    // The other device's still-unexpired access JWT must now fail.
    expect((await authedReq({ meronote_session: session })).status).toBe(401);
  });
});
