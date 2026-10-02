import crypto from "crypto";
import { PendingRegistration } from "../models";

/**
 * Step 2 OTP foundation (no endpoints, no Resend, no sessions).
 *
 * - Generation: exactly 6 digits (`100000`–`999999`), `crypto.randomInt`
 *   only. Never `Math.random`.
 * - Hashing: HMAC-SHA256 over the OTP with a per-record salt and a
 *   server-side pepper. Chosen over bcrypt for short-lived, high-entropy
 *   OTP secrets: constant-time, fast verification, and a database leak alone
 *   is insufficient without the pepper. Password hashing stays bcrypt and is
 *   conceptually separate (pending records hold the already-bcrypt-hashed
 *   password in `passwordHash`).
 * - Expiry: explicit `expiresAt > now` checks. The TTL index on `expiresAt`
 *   is cleanup only (MongoDB deletes lazily).
 * - Attempts: backend-authoritative counter, `0` → `5` exhausts the OTP.
 * - Cooldown: `resendAvailableAt` state; enforcement lands in the later
 *   endpoint step, the frontend timer is UX only.
 *
 * Plaintext OTPs/passwords are never stored, logged, or returned.
 */

export const OTP_LENGTH = 6;
export const OTP_MIN = 100000;
export const OTP_MAX = 999999;
export const OTP_TTL_SECONDS = 120;
export const OTP_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
/** Future per-email send budget (recorded in Step 2, enforced later). */
export const OTP_SEND_LIMIT = 5;
export const OTP_SEND_WINDOW_SECONDS = 600;

const OTP_SALT_BYTES = 16;

/** Server-side pepper for OTP HMAC. Never committed; never sent to clients. */
export function resolveOtpPepper(): string {
  return process.env.OTP_PEPPER || process.env.JWT_SECRET || "";
}

/** Cryptographically secure 6-digit OTP (`100000`–`999999`). */
export function generateOtp(): string {
  return String(crypto.randomInt(OTP_MIN, OTP_MAX + 1));
}

/** Per-record OTP salt (16 random bytes, hex). */
export function newOtpSalt(): string {
  return crypto.randomBytes(OTP_SALT_BYTES).toString("hex");
}

/** One-way OTP digest: HMAC-SHA256(pepper + salt, otp). */
export function hashOtp(otp: string, salt: string, pepper?: string): string {
  const key = pepper ?? resolveOtpPepper();
  return crypto.createHmac("sha256", `${key}:${salt}`).update(otp, "utf8").digest("hex");
}

/** Constant-time OTP comparison (length-checked to avoid throwing). */
export function verifyOtp(otp: string, salt: string, expectedHash: string, pepper?: string): boolean {
  if (!otp || !salt || !expectedHash) return false;
  const actual = hashOtp(otp, salt, pepper);
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expectedHash, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** `true` when `now >= expiresAt` (expired). TTL deletion is not relied on. */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/** `true` when another OTP may be requested (`now >= resendAvailableAt`). */
export function canResend(resendAvailableAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= resendAvailableAt.getTime();
}

/** `true` while wrong attempts remain (`attempts < maxAttempts`). */
export function hasAttemptsLeft(attempts: number, maxAttempts: number = OTP_MAX_ATTEMPTS): boolean {
  return attempts < maxAttempts;
}

/**
 * `true` for a well-formed OTP (exactly `OTP_LENGTH` ASCII digits).
 * Malformed input can never match a real OTP; the later endpoint step uses
 * this for 400-level input validation. `consumePendingOtp` below still
 * treats every mismatch (including malformed input) as a wrong attempt so
 * there is no probing oracle.
 */
export function isValidOtpFormat(otp: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp);
}

export function pendingExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_SECONDS * 1000);
}

export function resendAvailableFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);
}

export interface CreatedPending {
  pendingId: string;
  /** Plaintext OTP — return to the caller for sending only; never stored. */
  otp: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create a pending registration (Step 2 primitive for the later initiate
 * endpoint). The caller passes the already-bcrypt-hashed password; this
 * function never sees plaintext passwords. Generates + hashes the OTP and
 * stamps expiry/cooldown/send-window state from the server clock.
 */
export async function createPendingRegistration(input: {
  name: string;
  email: string;
  passwordHash: string;
  now?: Date;
}): Promise<CreatedPending> {
  const now = input.now ?? new Date();
  const otp = generateOtp();
  const salt = newOtpSalt();
  const pending = await PendingRegistration.create({
    name: input.name,
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    otpHash: hashOtp(otp, salt),
    otpSalt: salt,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt: pendingExpiryFrom(now),
    resendAvailableAt: resendAvailableFrom(now),
    sendCount: 1,
    firstSentAt: now,
  });
  return { pendingId: String(pending._id), otp };
}

export type ConsumePendingResult =
  | { status: "consumed"; email: string; name: string; passwordHash: string }
  | { status: "invalid"; attemptsLeft: number }
  | { status: "expired" }
  | { status: "exhausted" }
  | { status: "not-found" }
  | { status: "already-consumed" };

/**
 * Atomically consume a pending OTP (Step 2 primitive for the later verify
 * endpoint). Exactly one concurrent caller can observe `consumed`:
 * - The pending record is read with its OTP secrets.
 * - Expiry/attempts are checked explicitly (never TTL).
 * - A wrong OTP atomically increments `attempts` (guarded by
 *   `attempts < maxAttempts`).
 * - A correct OTP is deleted under a guarded filter
 *   (`attempts < maxAttempts` and still unexpired), so the delete is the
 *   single-winner arbiter: a concurrent correct OTP observes
 *   `already-consumed`, and a correct OTP racing the exhausting attempt or
 *   the expiry observes `exhausted`/`expired` instead of a false success.
 */
export async function consumePendingOtp(email: string, otp: string, now: Date = new Date()): Promise<ConsumePendingResult> {
  const normalized = normalizeEmail(email);
  const pending = await PendingRegistration.findOne({ email: normalized })
    .select("+otpHash +otpSalt +passwordHash")
    .exec();
  if (!pending) return { status: "not-found" };
  if (isExpired(pending.expiresAt, now)) return { status: "expired" };
  if (!hasAttemptsLeft(pending.attempts, pending.maxAttempts)) return { status: "exhausted" };

  if (!verifyOtp(otp, pending.otpSalt, pending.otpHash)) {
    const updated = await PendingRegistration.findOneAndUpdate(
      { _id: pending._id, attempts: { $lt: pending.maxAttempts } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    )
      .select("attempts maxAttempts")
      .exec();
    if (!updated) return recheckPending(pending._id.toString(), now);
    if (!hasAttemptsLeft(updated.attempts, updated.maxAttempts)) return { status: "exhausted" };
    return { status: "invalid", attemptsLeft: updated.maxAttempts - updated.attempts };
  }

  const deleted = await PendingRegistration.deleteOne({
    _id: pending._id,
    attempts: { $lt: pending.maxAttempts },
    expiresAt: { $gt: now },
  }).exec();
  if (deleted.deletedCount !== 1) return recheckPending(pending._id.toString(), now);
  return { status: "consumed", email: pending.email, name: pending.name, passwordHash: pending.passwordHash };
}

/**
 * Disambiguate a lost consume race: the record changed between the initial
 * read and the guarded write. Re-reads once to report the true terminal
 * state instead of a misleading generic status.
 */
async function recheckPending(pendingId: string, now: Date): Promise<ConsumePendingResult> {
  const current = await PendingRegistration.findById(pendingId).select("attempts maxAttempts expiresAt").exec();
  if (!current) return { status: "already-consumed" };
  if (isExpired(current.expiresAt, now)) return { status: "expired" };
  if (!hasAttemptsLeft(current.attempts, current.maxAttempts)) return { status: "exhausted" };
  return { status: "already-consumed" };
}
