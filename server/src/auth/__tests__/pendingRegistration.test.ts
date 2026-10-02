/**
 * Step 2 PendingRegistration model tests (isolated in-memory MongoDB).
 *
 * Covers email normalization, unique-email protection, credential hygiene
 * (bcrypt passwordHash, OTP hash — never plaintext), expiry/cooldown/send
 * state, TTL index presence, wrong-attempt exhaustion, and atomic OTP
 * consumption (exactly one concurrent winner). No endpoints, no Resend.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "../password";
import { consumePendingOtp, createPendingRegistration } from "../otp";
import { PendingRegistration } from "../../models/pendingRegistration.model";

let mongo: MongoMemoryServer;
const savedPepper = process.env.OTP_PEPPER;

beforeAll(async () => {
  process.env.OTP_PEPPER = "step2-test-pepper";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await PendingRegistration.ensureIndexes();
}, 60000);

afterAll(async () => {
  if (savedPepper === undefined) delete process.env.OTP_PEPPER;
  else process.env.OTP_PEPPER = savedPepper;
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await PendingRegistration.deleteMany({});
});

async function createPending(email = "Otp@Example.COM") {
  const passwordHash = await hashPassword("correct-horse-8");
  return { passwordHash, created: await createPendingRegistration({ name: "Manual", email, passwordHash }) };
}

describe("PendingRegistration model", () => {
  it("normalizes email to lowercase and trims", async () => {
    const { created } = await createPending("  MixedCase@Example.COM  ");
    const doc = await PendingRegistration.findById(created.pendingId).lean().exec();
    expect(doc?.email).toBe("mixedcase@example.com");
  });

  it("enforces a unique pending email for concurrent registrations", async () => {
    const passwordHash = await hashPassword("correct-horse-8");
    await createPendingRegistration({ name: "Manual", email: "dupe@example.com", passwordHash });
    await expect(
      createPendingRegistration({ name: "Manual", email: "DUPE@example.com", passwordHash }),
    ).rejects.toMatchObject({ code: 11000 });
    expect(await PendingRegistration.countDocuments({ email: "dupe@example.com" })).toBe(1);
  });

  it("stores hashes, never plaintext credentials", async () => {
    const { passwordHash, created } = await createPending();
    const raw = await PendingRegistration.findById(created.pendingId)
      .select("+passwordHash +otpHash +otpSalt")
      .lean()
      .exec();
    expect(raw).not.toBeNull();
    expect(raw?.passwordHash).toBe(passwordHash);
    expect(raw?.passwordHash).not.toContain("correct-horse-8");
    expect(raw?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(raw?.otpHash).not.toContain(created.otp);
    expect(raw?.otpHash).toHaveLength(64);
    expect(raw?.otpSalt).toBeTruthy();
  });

  it("stamps attempts, expiry (~2min), cooldown (~60s), and send state", async () => {
    const before = Date.now();
    const { created } = await createPending();
    const doc = await PendingRegistration.findById(created.pendingId).lean().exec();
    expect(doc?.attempts).toBe(0);
    expect(doc?.maxAttempts).toBe(5);
    expect(doc?.sendCount).toBe(1);
    expect(doc?.firstSentAt).toBeInstanceOf(Date);
    const expiresMs = new Date(doc?.expiresAt as Date).getTime() - before;
    const resendMs = new Date(doc?.resendAvailableAt as Date).getTime() - before;
    expect(expiresMs).toBeGreaterThan(119_000);
    expect(expiresMs).toBeLessThanOrEqual(121_000);
    expect(resendMs).toBeGreaterThan(59_000);
    expect(resendMs).toBeLessThanOrEqual(61_000);
  });

  it("defines a TTL index on expiresAt for cleanup", async () => {
    const indexes = await PendingRegistration.collection.indexes();
    const ttl = indexes.find((idx) => idx.key && (idx.key as Record<string, number>).expiresAt === 1);
    expect(ttl).toBeDefined();
    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  it("never exposes credential material via JSON", async () => {
    const { created } = await createPending();
    const doc = await PendingRegistration.findById(created.pendingId).exec();
    const json = doc?.toJSON() as Record<string, unknown> | undefined;
    expect(json).not.toHaveProperty("passwordHash");
    expect(json).not.toHaveProperty("otpHash");
    expect(json).not.toHaveProperty("otpSalt");
  });
});

describe("attempt limit and cooldown behavior", () => {
  it("increments on wrong OTPs and exhausts after 5 (sixth cannot succeed)", async () => {
    const { created } = await createPending();
    for (let i = 1; i <= 4; i++) {
      const result = await consumePendingOtp("otp@example.com", "000000");
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") expect(result.attemptsLeft).toBe(5 - i);
    }
    expect(await consumePendingOtp("otp@example.com", "000000")).toMatchObject({ status: "exhausted" });
    // Sixth wrong attempt stays exhausted, and even the correct OTP is dead.
    expect(await consumePendingOtp("otp@example.com", "000000")).toMatchObject({ status: "exhausted" });
    expect(await consumePendingOtp("otp@example.com", created.otp)).toMatchObject({ status: "exhausted" });
  });

  it("consumes the correct OTP once and rejects reuse", async () => {
    const { passwordHash, created } = await createPending();
    const first = await consumePendingOtp("otp@example.com", created.otp);
    expect(first).toMatchObject({ status: "consumed", email: "otp@example.com", name: "Manual", passwordHash });
    expect(await PendingRegistration.countDocuments({ email: "otp@example.com" })).toBe(0);
    const second = await consumePendingOtp("otp@example.com", created.otp);
    expect(["not-found", "already-consumed"]).toContain(second.status);
  });

  it("treats malformed OTPs as wrong attempts without an oracle", async () => {
    await createPending();
    const malformed = await consumePendingOtp("otp@example.com", "not-an-otp");
    expect(malformed.status).toBe("invalid");
    const doc = await PendingRegistration.findOne({ email: "otp@example.com" }).lean().exec();
    expect(doc?.attempts).toBe(1);
  });

  it("rejects expired OTPs explicitly (TTL is not the enforcer)", async () => {
    const { created } = await createPending();
    const doc = await PendingRegistration.findById(created.pendingId).exec();
    expect(doc).not.toBeNull();
    await PendingRegistration.updateOne(
      { _id: created.pendingId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    ).exec();
    // The abandoned document still exists, but verification fails explicitly.
    expect(await PendingRegistration.countDocuments({})).toBe(1);
    expect(await consumePendingOtp("otp@example.com", created.otp)).toMatchObject({ status: "expired" });
  });
});

describe("atomic OTP consumption", () => {
  it("allows exactly one winner for concurrent correct OTPs", async () => {
    const { created } = await createPending();
    const results = await Promise.all([
      consumePendingOtp("otp@example.com", created.otp),
      consumePendingOtp("otp@example.com", created.otp),
    ]);
    const consumed = results.filter((r) => r.status === "consumed");
    expect(consumed).toHaveLength(1);
    for (const loser of results.filter((r) => r.status !== "consumed")) {
      expect(["not-found", "already-consumed"]).toContain(loser.status);
    }
    expect(await PendingRegistration.countDocuments({})).toBe(0);
  });
});
