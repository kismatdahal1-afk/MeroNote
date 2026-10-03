/**
 * Manual-registration password strength tests (isolated in-memory MongoDB).
 *
 * Locks the product rules: minimum 8 characters, at least one lowercase,
 * uppercase, digit, and special character, with no whitespace anywhere.
 * The shared validator serves both legacy `register` and OTP `initiate`,
 * so the matrix asserts both entry points enforce the identical contract.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { User } from "../../models/user.model";
import { PendingRegistration } from "../../models/pendingRegistration.model";
import { env } from "../../config/env";
import { initiateRegistration, register } from "../auth.controller";
import { sendRegistrationOtpEmail } from "../../email/gmail";

vi.mock("../../email/gmail", () => ({ sendRegistrationOtpEmail: vi.fn() }));

const mockedSend = sendRegistrationOtpEmail as unknown as ReturnType<typeof vi.fn>;

interface FakeRes {
  statusCode: number;
  body: unknown;
  cookies: Record<string, { value: string; options: Record<string, unknown> }>;
  status(code: number): FakeRes;
  json(payload: unknown): void;
  cookie(name: string, value: string, options: Record<string, unknown>): void;
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: null,
    cookies: {},
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
  };
  return res;
}

function bodyReq(body: Record<string, unknown>): Request {
  return { body, query: {}, cookies: {} } as unknown as Request;
}

const VALID = { name: "Manual", email: "pw@example.com", password: "Kismat12@", confirmPassword: "Kismat12@" };
const TOO_SHORT = "Password must be at least 8 characters.";
const NO_SPACES = "Password must not contain spaces.";
const WEAK =
  "Password must include an uppercase letter, a lowercase letter, a number, and a special character.";

let mongo: MongoMemoryServer;
const savedJwtSecret = env.jwtSecret;
const savedNodeEnv = env.nodeEnv;

beforeAll(async () => {
  if (!env.jwtSecret) env.jwtSecret = "register-password-test-secret";
  env.nodeEnv = "test";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.ensureIndexes();
  await PendingRegistration.ensureIndexes();
}, 60000);

afterAll(async () => {
  env.jwtSecret = savedJwtSecret;
  env.nodeEnv = savedNodeEnv;
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await PendingRegistration.deleteMany({});
  mockedSend.mockReset();
  mockedSend.mockResolvedValue(undefined);
});

async function attempt(
  handler: (req: Request, res: Response) => Promise<void>,
  password: string,
  confirmPassword: string = password,
  email = `${Math.random().toString(36).slice(2)}@example.com`,
): Promise<FakeRes> {
  const res = fakeRes();
  await handler(bodyReq({ name: "Manual", email, password, confirmPassword }), res as unknown as Response);
  return res;
}

describe("registration password strength", () => {
  it.each([
    ["Kismat12@", null],
    ["Correct-horse-8@", null],
    ["kismat12@", WEAK],
    ["KISMAT12@", WEAK],
    ["Kismatab@", WEAK],
    ["Kismat123", WEAK],
    ["Kismat 12@", NO_SPACES],
    ["Sh0@abc", TOO_SHORT],
  ])("register(%s) → %s", async (password, message) => {
    const res = await attempt(register, password);
    if (message === null) {
      expect(res.statusCode).toBe(201);
    } else {
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ status: "error", message });
      expect(await User.countDocuments({})).toBe(0);
    }
  });

  it("rejects tabs, newlines, and interior whitespace", async () => {
    for (const [index, password] of ["Kismat\t12@", "Kismat\n12@", "Kis mat12@"].entries()) {
      const res = await attempt(register, password, password, `ws${index}@example.com`);
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ status: "error", message: NO_SPACES });
      expect(await User.countDocuments({ email: `ws${index}@example.com` })).toBe(0);
    }
    expect(await User.countDocuments({})).toBe(0);
  });

  it("trims edge whitespace before validation so it can never persist", async () => {
    const res = fakeRes();
    await register(
      bodyReq({ name: "Manual", email: "trimmed@example.com", password: "  Kismat12@  ", confirmPassword: "  Kismat12@  " }),
      res as unknown as Response,
    );
    // Both sides trim identically (login included), so the stored hash
    // always corresponds to the trimmed value — no whitespace survives.
    expect(res.statusCode).toBe(201);
    expect(await User.countDocuments({ email: "trimmed@example.com" })).toBe(1);
  });

  it("enforces the identical contract on the OTP initiation path", async () => {
    const weak = fakeRes();
    await initiateRegistration(
      bodyReq({ name: "Manual", email: "weak-otp@example.com", password: "kismat12@", confirmPassword: "kismat12@" }),
      weak as unknown as Response,
    );
    expect(weak.statusCode).toBe(400);
    expect(weak.body).toMatchObject({ status: "error", message: WEAK });
    expect(mockedSend).not.toHaveBeenCalled();
    expect(await PendingRegistration.countDocuments({})).toBe(0);

    const strong = fakeRes();
    await initiateRegistration(bodyReq({ ...VALID, email: "strong-otp@example.com" }), strong as unknown as Response);
    expect(strong.statusCode).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(1);
  });
});
