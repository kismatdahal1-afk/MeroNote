/**
 * Step 3 initiate/resend endpoint tests (isolated in-memory MongoDB).
 *
 * The Gmail provider boundary is mocked (`vi.mock`); no real emails are
 * sent and no production data is touched. Covers pending creation, the
 * existing-user stop, cooldown, the 5-sends/10-minutes per-email budget,
 * fail-closed provider handling (no slot consumed on failure), concurrency,
 * response hygiene, and the no-User/no-session invariant.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { PendingRegistration } from "../../models/pendingRegistration.model";
import { User } from "../../models/user.model";
import { consumePendingOtp, hashOtp } from "../otp";
import { initiateRegistration, resendRegistrationOtp } from "../auth.controller";
import { sendRegistrationOtpEmail } from "../../email/gmail";

vi.mock("../../email/gmail", () => ({ sendRegistrationOtpEmail: vi.fn() }));

const mockedSend = sendRegistrationOtpEmail as unknown as ReturnType<typeof vi.fn>;

let mongo: MongoMemoryServer;
const savedPepper = process.env.OTP_PEPPER;

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

function sentOtps(): string[] {
  return mockedSend.mock.calls.map((call) => (call[0] as { otp: string }).otp);
}

async function passCooldown(email: string): Promise<void> {
  await PendingRegistration.updateOne({ email }, { $set: { resendAvailableAt: new Date(Date.now() - 1000) } }).exec();
}

function assertNoSecrets(body: unknown, secrets: string[]): void {
  const text = JSON.stringify(body ?? {});
  for (const secret of secrets) {
    if (secret) expect(text).not.toContain(secret);
  }
  expect(text).not.toContain("otpHash");
  expect(text).not.toContain("otpSalt");
  expect(text).not.toContain("passwordHash");
  expect(text).not.toContain("RESEND_API_KEY");
}

beforeAll(async () => {
  process.env.OTP_PEPPER = "step3-test-pepper";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.ensureIndexes();
  await PendingRegistration.ensureIndexes();
}, 60000);

afterAll(async () => {
  if (savedPepper === undefined) delete process.env.OTP_PEPPER;
  else process.env.OTP_PEPPER = savedPepper;
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await PendingRegistration.deleteMany({});
  mockedSend.mockReset();
  mockedSend.mockResolvedValue(undefined);
});

describe("POST /register/initiate", () => {
  it("creates a pending registration and sends exactly one OTP email", async () => {
    const res = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), res as unknown as Response);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });

    expect(mockedSend).toHaveBeenCalledTimes(1);
    const [[sent]] = mockedSend.mock.calls as [[{ to: string; otp: string }]];
    expect(sent.to).toBe("otp@example.com");
    expect(sent.otp).toMatch(/^\d{6}$/);

    const doc = await PendingRegistration.findOne({ email: "otp@example.com" })
      .select("+passwordHash +otpHash +otpSalt")
      .exec();
    expect(doc).not.toBeNull();
    expect(doc?.attempts).toBe(0);
    expect(doc?.maxAttempts).toBe(5);
    expect(doc?.sendCount).toBe(1);
    expect(doc?.firstSentAt).toBeInstanceOf(Date);
    // Bcrypt password hash, never plaintext.
    expect(doc?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(doc?.passwordHash).not.toContain("correct-horse-8");
    // OTP hash matches Step 2 HMAC construction, never plaintext.
    expect(doc?.otpHash).toBe(hashOtp(sent.otp, doc?.otpSalt as string));
    expect(doc?.otpHash).not.toContain(sent.otp);
    // Expiry ≈ 2 minutes, cooldown ≈ 60 seconds.
    expect(doc ? doc.expiresAt.getTime() - Date.now() : 0).toBeGreaterThan(115_000);
    expect(doc ? doc.resendAvailableAt.getTime() - Date.now() : 0).toBeGreaterThan(55_000);

    // Critical invariant: no User, no session of any kind.
    expect(await User.countDocuments({})).toBe(0);
    expect(Object.keys(res.cookies)).toHaveLength(0);
    expect(res.cleared).toHaveLength(0);
    assertNoSecrets(res.body, [sent.otp, VALID.password]);
  });

  it("normalizes the email before storage and sending", async () => {
    const res = fakeRes();
    await initiateRegistration(
      bodyReq({ ...VALID, email: "  MiXeD@Example.COM " }),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    expect(await PendingRegistration.countDocuments({ email: "mixed@example.com" })).toBe(1);
    expect((mockedSend.mock.calls[0][0] as { to: string }).to).toBe("mixed@example.com");
  });

  it("rejects invalid input without creating state or sending", async () => {
    for (const body of [
      { ...VALID, name: "  " },
      { ...VALID, email: "not-an-email" },
      { ...VALID, password: "short", confirmPassword: "short" },
      { ...VALID, confirmPassword: "different-horse-9" },
    ]) {
      const res = fakeRes();
      await initiateRegistration(bodyReq(body), res as unknown as Response);
      expect(res.statusCode).toBe(400);
    }
    expect(mockedSend).not.toHaveBeenCalled();
    expect(await PendingRegistration.countDocuments({})).toBe(0);
    expect(await User.countDocuments({})).toBe(0);
  });

  it("stops for an already-registered email without sending or staging", async () => {
    const created = await User.create({
      name: "Existing",
      email: "otp@example.com",
      passwordHash: "bcrypt-hash",
      role: "USER",
    });
    const before = created.toObject();
    const res = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), res as unknown as Response);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ status: "error", message: "An account with this email already exists." });
    expect(mockedSend).not.toHaveBeenCalled();
    expect(await PendingRegistration.countDocuments({})).toBe(0);
    const after = await User.findById(created._id).select("+passwordHash").lean().exec();
    expect(after?.passwordHash).toBe(before.passwordHash);
    expect(after?.sessionVersion).toBe(before.sessionVersion);
    expect(Object.keys(res.cookies)).toHaveLength(0);
  });
});

describe("POST /register/resend", () => {
  it("rotates to a new OTP, resets attempts, and restarts expiry/cooldown", async () => {
    const initRes = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), initRes as unknown as Response);
    expect(initRes.statusCode).toBe(200);
    const [firstOtp] = sentOtps();
    await passCooldown("otp@example.com");

    const res = fakeRes();
    await resendRegistrationOtp(bodyReq({ email: "otp@example.com" }), res as unknown as Response);
    expect(res.statusCode).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(2);
    const [, secondOtp] = sentOtps();
    expect(secondOtp).toMatch(/^\d{6}$/);

    const doc = await PendingRegistration.findOne({ email: "otp@example.com" }).exec();
    expect(doc?.attempts).toBe(0);
    expect(doc?.sendCount).toBe(2);
    expect(doc ? doc.expiresAt.getTime() - Date.now() : 0).toBeGreaterThan(115_000);
    expect(doc ? doc.resendAvailableAt.getTime() - Date.now() : 0).toBeGreaterThan(55_000);

    // Old OTP is dead, new OTP verifies.
    expect(await consumePendingOtp("otp@example.com", firstOtp)).toMatchObject({ status: "invalid" });
    expect(await consumePendingOtp("otp@example.com", secondOtp)).toMatchObject({ status: "consumed" });

    expect(await User.countDocuments({})).toBe(0);
    expect(Object.keys(res.cookies)).toHaveLength(0);
    assertNoSecrets(res.body, [firstOtp, secondOtp, VALID.password]);
  });

  it("returns 400 when no pending registration exists", async () => {
    const res = fakeRes();
    await resendRegistrationOtp(bodyReq({ email: "ghost@example.com" }), res as unknown as Response);
    expect(res.statusCode).toBe(400);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    const res = fakeRes();
    await resendRegistrationOtp(bodyReq({ email: "not-an-email" }), res as unknown as Response);
    expect(res.statusCode).toBe(400);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("enforces the 60-second cooldown without calling the provider", async () => {
    const initRes = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), initRes as unknown as Response);
    expect(initRes.statusCode).toBe(200);

    const res = fakeRes();
    await resendRegistrationOtp(bodyReq({ email: "otp@example.com" }), res as unknown as Response);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ status: "error" });
    expect((res.body as { retryAfterSeconds?: number }).retryAfterSeconds).toBeGreaterThan(0);
    expect(mockedSend).toHaveBeenCalledTimes(1);
  });

  it("repeated initiate calls cannot bypass the cooldown", async () => {
    const first = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), first as unknown as Response);
    expect(first.statusCode).toBe(200);
    const second = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), second as unknown as Response);
    expect(second.statusCode).toBe(429);
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(await PendingRegistration.countDocuments({})).toBe(1);
  });
});

describe("5 sends / 10 minutes per email", () => {
  async function sendUpToLimit(email: string): Promise<void> {
    const initRes = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID, email }), initRes as unknown as Response);
    expect(initRes.statusCode).toBe(200);
    for (let i = 1; i < 5; i++) {
      await passCooldown(email);
      const res = fakeRes();
      await resendRegistrationOtp(bodyReq({ email }), res as unknown as Response);
      expect(res.statusCode).toBe(200);
    }
  }

  it("allows 5 sends then rejects the 6th within the window", async () => {
    await sendUpToLimit("otp@example.com");
    expect(mockedSend).toHaveBeenCalledTimes(5);
    await passCooldown("otp@example.com");
    const res = fakeRes();
    await resendRegistrationOtp(bodyReq({ email: "otp@example.com" }), res as unknown as Response);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ status: "error", message: "Too many verification emails. Please try again later." });
    expect((res.body as { retryAfterSeconds?: number }).retryAfterSeconds).toBeGreaterThan(0);
    expect(mockedSend).toHaveBeenCalledTimes(5);
  });

  it("tracks budgets independently per email (not a global cap)", async () => {
    await sendUpToLimit("otp@example.com");
    const res = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID, email: "other@example.com" }), res as unknown as Response);
    expect(res.statusCode).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(6);
  });

  it("resets the window after 10 minutes", async () => {
    await sendUpToLimit("otp@example.com");
    await PendingRegistration.updateOne(
      { email: "otp@example.com" },
      { $set: { firstSentAt: new Date(Date.now() - 11 * 60 * 1000), resendAvailableAt: new Date(Date.now() - 1000) } },
    ).exec();
    const res = fakeRes();
    await resendRegistrationOtp(bodyReq({ email: "otp@example.com" }), res as unknown as Response);
    expect(res.statusCode).toBe(200);
    const doc = await PendingRegistration.findOne({ email: "otp@example.com" }).exec();
    expect(doc?.sendCount).toBe(1);
    expect(doc ? Date.now() - doc.firstSentAt.getTime() : Infinity).toBeLessThan(60_000);
  });

  it("concurrent resends cannot bypass the 5-send limit", async () => {
    const initRes = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), initRes as unknown as Response);
    expect(initRes.statusCode).toBe(200);
    await PendingRegistration.updateOne(
      { email: "otp@example.com" },
      { $set: { sendCount: 4, resendAvailableAt: new Date(Date.now() - 1000) } },
    ).exec();

    const results = await Promise.all(
      [0, 1, 2].map(async () => {
        const res = fakeRes();
        await resendRegistrationOtp(bodyReq({ email: "otp@example.com" }), res as unknown as Response);
        return res.statusCode;
      }),
    );
    expect(results.filter((s) => s === 200)).toHaveLength(1);
    expect(results.filter((s) => s === 429)).toHaveLength(2);
    // One initiate + exactly one winning resend reached the provider.
    expect(mockedSend).toHaveBeenCalledTimes(2);
    expect((await PendingRegistration.findOne({ email: "otp@example.com" }).exec())?.sendCount).toBe(5);
  });

  it("concurrent initiates create exactly one pending record and one email", async () => {
    const results = await Promise.all(
      [0, 1].map(async () => {
        const res = fakeRes();
        await initiateRegistration(bodyReq({ ...VALID }), res as unknown as Response);
        return res;
      }),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 429]);
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(await PendingRegistration.countDocuments({})).toBe(1);
    expect(await User.countDocuments({})).toBe(0);
  });
});

describe("provider failure fails closed", () => {
  it("deletes a fresh pending on send failure so retry stays possible", async () => {
    mockedSend.mockRejectedValueOnce(new Error("provider down"));
    const failed = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), failed as unknown as Response);
    expect(failed.statusCode).toBe(500);
    expect(failed.body).toMatchObject({ status: "error" });
    assertNoSecrets(failed.body, [VALID.password]);
    expect(await User.countDocuments({})).toBe(0);
    expect(await PendingRegistration.countDocuments({})).toBe(0);

    const retry = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), retry as unknown as Response);
    expect(retry.statusCode).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(2);
  });

  it("does not consume a send slot when resend delivery fails", async () => {
    const initRes = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), initRes as unknown as Response);
    expect(initRes.statusCode).toBe(200);
    const [firstOtp] = sentOtps();
    const before = await PendingRegistration.findOne({ email: "otp@example.com" })
      .select("+otpHash +otpSalt")
      .lean()
      .exec();
    await passCooldown("otp@example.com");

    mockedSend.mockRejectedValueOnce(new Error("provider down"));
    const res = fakeRes();
    await resendRegistrationOtp(bodyReq({ email: "otp@example.com" }), res as unknown as Response);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ status: "error" });

    const after = await PendingRegistration.findOne({ email: "otp@example.com" })
      .select("+otpHash +otpSalt")
      .lean()
      .exec();
    expect(after?.sendCount).toBe(before?.sendCount);
    expect(after?.otpHash).toBe(before?.otpHash);
    // The previous OTP is still usable — the failed send changed nothing.
    expect(await consumePendingOtp("otp@example.com", firstOtp)).toMatchObject({ status: "consumed" });
    expect(await User.countDocuments({})).toBe(0);
    assertNoSecrets(res.body, [firstOtp, VALID.password]);
  });

  it("restores name and password fully when a duplicate-initiate send fails", async () => {
    const first = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID }), first as unknown as Response);
    expect(first.statusCode).toBe(200);
    const before = await PendingRegistration.findOne({ email: "otp@example.com" })
      .select("+passwordHash +otpHash")
      .lean()
      .exec();
    await passCooldown("otp@example.com");

    mockedSend.mockRejectedValueOnce(new Error("provider down"));
    const res = fakeRes();
    await initiateRegistration(
      bodyReq({ ...VALID, name: "Manual Two", password: "different-horse-9", confirmPassword: "different-horse-9" }),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(500);
    const after = await PendingRegistration.findOne({ email: "otp@example.com" })
      .select("+passwordHash +otpHash")
      .lean()
      .exec();
    expect(after?.name).toBe("Manual");
    expect(after?.passwordHash).toBe(before?.passwordHash);
    expect(after?.otpHash).toBe(before?.otpHash);
    expect(after?.sendCount).toBe(before?.sendCount);
    expect(await User.countDocuments({})).toBe(0);
  });
});
