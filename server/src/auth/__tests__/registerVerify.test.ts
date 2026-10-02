/**
 * Step 4 verify endpoint tests (isolated in-memory MongoDB).
 *
 * The Gmail provider boundary is mocked; no real emails are sent and no
 * production data is touched. Covers validation, pending states, the OTP
 * matrix (including the confirmed 429-on-exhausted contract and concurrent
 * single-winner verification), User creation races, verbatim password-hash
 * transfer with login proof, normal session issuance, pending cleanup, and
 * response hygiene.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { PendingRegistration } from "../../models/pendingRegistration.model";
import { User } from "../../models/user.model";
import { env } from "../../config/env";
import * as refreshModule from "../refresh";
import { initiateRegistration, login, resendRegistrationOtp, verifyRegistration } from "../auth.controller";
import { sendRegistrationOtpEmail } from "../../email/gmail";

vi.mock("../../email/gmail", () => ({ sendRegistrationOtpEmail: vi.fn() }));

const mockedSend = sendRegistrationOtpEmail as unknown as ReturnType<typeof vi.fn>;

let mongo: MongoMemoryServer;
const savedPepper = process.env.OTP_PEPPER;
const savedJwtSecret = process.env.JWT_SECRET;

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

function bodyReq(body: Record<string, unknown>): Request {
  return { body, query: {}, cookies: {} } as unknown as Request;
}

const VALID = { name: "Manual", email: "otp@example.com", password: "correct-horse-8", confirmPassword: "correct-horse-8" };

function lastSentOtp(): string {
  const calls = mockedSend.mock.calls;
  return (calls[calls.length - 1][0] as { otp: string }).otp;
}

async function initiate(email = VALID.email): Promise<string> {
  const res = fakeRes();
  await initiateRegistration(bodyReq({ ...VALID, email }), res as unknown as Response);
  expect(res.statusCode).toBe(200);
  return lastSentOtp();
}

async function pendingSecrets(email: string) {
  return PendingRegistration.findOne({ email })
    .select("+passwordHash +otpHash +otpSalt")
    .lean()
    .exec();
}

function assertNoSecrets(body: unknown, secrets: string[]): void {
  const text = JSON.stringify(body ?? {});
  for (const secret of secrets) {
    if (secret) expect(text).not.toContain(secret);
  }
  for (const key of ["otpHash", "otpSalt", "passwordHash", "password", "token", "GMAIL_OAUTH", "JWT_SECRET"]) {
    expect(text).not.toContain(key);
  }
}

beforeAll(async () => {
  process.env.OTP_PEPPER = "step4-test-pepper";
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "step4-test-secret";
  if (!env.jwtSecret) env.jwtSecret = "step4-test-secret";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.ensureIndexes();
  await PendingRegistration.ensureIndexes();
}, 60000);

afterAll(async () => {
  if (savedPepper === undefined) delete process.env.OTP_PEPPER;
  else process.env.OTP_PEPPER = savedPepper;
  if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedJwtSecret;
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await PendingRegistration.deleteMany({});
  mockedSend.mockReset();
  mockedSend.mockResolvedValue(undefined);
  vi.restoreAllMocks();
});

describe("POST /register/verify validation", () => {
  it("rejects missing email, missing OTP, malformed OTP, and bad email", async () => {
    await initiate();
    for (const body of [
      { otp: lastSentOtp() },
      { email: VALID.email },
      { email: VALID.email, otp: "12345" },
      { email: VALID.email, otp: "abcdef" },
      { email: VALID.email, otp: "12 456" },
      { email: "not-an-email", otp: "123456" },
    ]) {
      const res = fakeRes();
      await verifyRegistration(bodyReq(body), res as unknown as Response);
      expect(res.statusCode).toBe(400);
      expect(Object.keys(res.cookies)).toHaveLength(0);
    }
    expect(await User.countDocuments({})).toBe(0);
    // Malformed OTPs never reach the consume primitive: no attempt consumed.
    expect((await PendingRegistration.findOne({ email: VALID.email }).exec())?.attempts).toBe(0);
  });
});

describe("POST /register/verify pending states", () => {
  it("returns 400 with no User and no session when no pending exists", async () => {
    const res = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp: "123456" }), res as unknown as Response);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ status: "error" });
    expect(await User.countDocuments({})).toBe(0);
    expect(Object.keys(res.cookies)).toHaveLength(0);
  });

  it("rejects expired OTPs explicitly with no User and no session", async () => {
    const otp = await initiate();
    await PendingRegistration.updateOne(
      { email: VALID.email },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    ).exec();
    const res = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp }), res as unknown as Response);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ status: "error", message: "Verification code has expired. Please request a new one." });
    expect(await User.countDocuments({})).toBe(0);
    expect(Object.keys(res.cookies)).toHaveLength(0);
  });
});

describe("POST /register/verify OTP matrix", () => {
  it("creates the User, consumes the pending, and issues the normal session", async () => {
    const otp = await initiate();
    const before = await pendingSecrets(VALID.email);
    const res = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp }), res as unknown as Response);

    expect(res.statusCode).toBe(201);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data.name).toBe("Manual");
    expect(data.email).toBe(VALID.email);
    expect(data.role).toBe("USER");
    expect(Object.keys(data).sort()).toEqual(["email", "id", "name", "role"]);
    assertNoSecrets(res.body, [otp, VALID.password]);

    const user = await User.findOne({ email: VALID.email }).select("+passwordHash").exec();
    expect(user).not.toBeNull();
    // Verbatim bcrypt transfer: identical hash, never double-hashed.
    expect(user?.passwordHash).toBe(before?.passwordHash);
    expect(user?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user?.authProvider).toBe("password");
    expect(user?.googleId).toBeUndefined();
    expect(await PendingRegistration.countDocuments({})).toBe(0);

    // Normal MeroNote session architecture: HttpOnly access + refresh, readable CSRF.
    expect(res.cookies.meronote_session).toBeDefined();
    expect(res.cookies.meronote_session.options.httpOnly).toBe(true);
    expect(res.cookies.meronote_refresh).toBeDefined();
    expect(res.cookies.meronote_refresh.options.httpOnly).toBe(true);
    expect(res.cookies.meronote_csrf).toBeDefined();
    expect(res.cookies.meronote_csrf.options.httpOnly).toBe(false);
  });

  it("the new account authenticates through the existing login flow", async () => {
    const otp = await initiate();
    const verifyRes = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp }), verifyRes as unknown as Response);
    expect(verifyRes.statusCode).toBe(201);

    const loginRes = fakeRes();
    await login(bodyReq({ email: VALID.email, password: VALID.password }), loginRes as unknown as Response);
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body).toMatchObject({ status: "ok", data: { email: VALID.email } });
  });

  it("counts wrong OTPs without creating a User or session", async () => {
    const otp = await initiate();
    const res = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp: "000000" }), res as unknown as Response);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ status: "error", message: "Incorrect verification code.", attemptsLeft: 4 });
    expect(await User.countDocuments({})).toBe(0);
    expect(Object.keys(res.cookies)).toHaveLength(0);
    assertNoSecrets(res.body, [otp, VALID.password]);

    // The correct OTP still works afterwards.
    const retry = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp }), retry as unknown as Response);
    expect(retry.statusCode).toBe(201);
  });

  it("returns 429 with retryAfterSeconds after 5 wrong attempts, even for the correct OTP", async () => {
    const otp = await initiate();
    for (let i = 1; i <= 4; i++) {
      const res = fakeRes();
      await verifyRegistration(bodyReq({ email: VALID.email, otp: "000000" }), res as unknown as Response);
      expect(res.statusCode).toBe(400);
    }
    const fifth = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp: "000000" }), fifth as unknown as Response);
    expect(fifth.statusCode).toBe(429);
    expect(fifth.body).toMatchObject({ status: "error" });
    expect((fifth.body as { retryAfterSeconds?: number }).retryAfterSeconds).toBeGreaterThanOrEqual(0);

    const correct = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp }), correct as unknown as Response);
    expect(correct.statusCode).toBe(429);
    expect((correct.body as { retryAfterSeconds?: number }).retryAfterSeconds).toBeGreaterThanOrEqual(0);
    expect(await User.countDocuments({})).toBe(0);
    expect(Object.keys(correct.cookies)).toHaveLength(0);
  });

  it("rejects a reused OTP after success without creating another account", async () => {
    const otp = await initiate();
    const first = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp }), first as unknown as Response);
    expect(first.statusCode).toBe(201);

    const second = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp }), second as unknown as Response);
    expect(second.statusCode).toBe(400);
    expect(await User.countDocuments({ email: VALID.email })).toBe(1);
    expect(Object.keys(second.cookies)).toHaveLength(0);
  });

  it("rejects the old OTP after resend and accepts the new one", async () => {
    await initiate();
    const firstOtp = lastSentOtp();
    await PendingRegistration.updateOne(
      { email: VALID.email },
      { $set: { resendAvailableAt: new Date(Date.now() - 1000) } },
    ).exec();
    const resendRes = fakeRes();
    await resendRegistrationOtp(bodyReq({ email: VALID.email }), resendRes as unknown as Response);
    expect(resendRes.statusCode).toBe(200);
    const secondOtp = lastSentOtp();
    expect(secondOtp).not.toBe(firstOtp);

    const stale = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp: firstOtp }), stale as unknown as Response);
    expect(stale.statusCode).toBe(400);
    expect(await User.countDocuments({})).toBe(0);

    const fresh = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp: secondOtp }), fresh as unknown as Response);
    expect(fresh.statusCode).toBe(201);
  });

  it("allows exactly one winner for concurrent correct OTPs", async () => {
    const otp = await initiate();
    const results = await Promise.all(
      [0, 1].map(async () => {
        const res = fakeRes();
        await verifyRegistration(bodyReq({ email: VALID.email, otp }), res as unknown as Response);
        return res;
      }),
    );
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 400)).toHaveLength(1);
    expect(await User.countDocuments({ email: VALID.email })).toBe(1);
    expect(await PendingRegistration.countDocuments({})).toBe(0);
  });
});

describe("POST /register/verify User races", () => {
  it("returns 409 with no session when the User appears after initiation", async () => {
    const otp = await initiate();
    await User.create({ name: "Manual", email: VALID.email, passwordHash: "bcrypt-hash", role: "USER" });

    const res = fakeRes();
    await verifyRegistration(bodyReq({ email: VALID.email, otp }), res as unknown as Response);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ status: "error", message: "An account with this email already exists." });
    expect(Object.keys(res.cookies)).toHaveLength(0);
    expect(await User.countDocuments({ email: VALID.email })).toBe(1);
    // Pending is consumed (OTP cannot be retried into a second account).
    expect(await PendingRegistration.countDocuments({})).toBe(0);
  });

  it("returns 409 with no session when User.create loses the duplicate-key race", async () => {
    const otp = await initiate();
    const spy = vi.spyOn(User, "create").mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: 11000 }));
    const res = fakeRes();
    try {
      await verifyRegistration(bodyReq({ email: VALID.email, otp }), res as unknown as Response);
    } finally {
      spy.mockRestore();
    }
    expect(res.statusCode).toBe(409);
    expect(Object.keys(res.cookies)).toHaveLength(0);
    expect(await User.countDocuments({})).toBe(0);
  });

  it("propagates unexpected User.create failures without a session", async () => {
    const otp = await initiate();
    const spy = vi.spyOn(User, "create").mockRejectedValueOnce(new Error("db down"));
    const res = fakeRes();
    try {
      await expect(
        verifyRegistration(bodyReq({ email: VALID.email, otp }), res as unknown as Response),
      ).rejects.toThrow("db down");
    } finally {
      spy.mockRestore();
    }
    expect(Object.keys(res.cookies)).toHaveLength(0);
    expect(await User.countDocuments({})).toBe(0);
  });

  it("returns 500 without claiming success when session issuance fails", async () => {
    const otp = await initiate();
    const spy = vi.spyOn(refreshModule, "issueRefreshToken").mockRejectedValueOnce(new Error("storage down"));
    const res = fakeRes();
    try {
      await verifyRegistration(bodyReq({ email: VALID.email, otp }), res as unknown as Response);
    } finally {
      spy.mockRestore();
    }
    expect(res.statusCode).toBe(500);
    // The account itself is a normal valid account; retry path is login.
    expect(await User.countDocuments({ email: VALID.email })).toBe(1);
  });
});
