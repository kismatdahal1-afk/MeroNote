/**
 * Step 2 OTP primitive tests (pure unit tests, no database).
 *
 * Covers generation, hashing, expiry, attempt helpers, and cooldown state.
 * No endpoints, no Resend, no sessions.
 */

import crypto from "crypto";
import { describe, expect, it, vi } from "vitest";
import {
  OTP_LENGTH,
  OTP_MAX,
  OTP_MAX_ATTEMPTS,
  OTP_MIN,
  OTP_SEND_LIMIT,
  OTP_SEND_WINDOW_SECONDS,
  OTP_TTL_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  canResend,
  generateOtp,
  hashOtp,
  hasAttemptsLeft,
  isExpired,
  isValidOtpFormat,
  newOtpSalt,
  verifyOtp,
} from "../otp";

describe("OTP generation", () => {
  it("produces exactly 6 numeric digits in range 100000-999999", () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      expect(Number(otp)).toBeGreaterThanOrEqual(OTP_MIN);
      expect(Number(otp)).toBeLessThanOrEqual(OTP_MAX);
    }
  });

  it("uses the secure random API", () => {
    const spy = vi.spyOn(crypto, "randomInt");
    generateOtp();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("never uses Math.random in the OTP source", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("generateOtp must not use Math.random");
    });
    try {
      for (let i = 0; i < 10; i++) {
        const otp = generateOtp();
        expect(otp).toMatch(/^\d{6}$/);
      }
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("validates the 6-digit OTP format", () => {
    expect(OTP_LENGTH).toBe(6);
    expect(isValidOtpFormat("123456")).toBe(true);
    expect(isValidOtpFormat("012345")).toBe(true);
    expect(isValidOtpFormat("12345")).toBe(false);
    expect(isValidOtpFormat("1234567")).toBe(false);
    expect(isValidOtpFormat("12345a")).toBe(false);
    expect(isValidOtpFormat("")).toBe(false);
  });

  it("generates distinct values across calls", () => {
    const values = new Set(Array.from({ length: 20 }, () => generateOtp()));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe("OTP hashing", () => {
  it("hash differs from plaintext and verifies correctly", () => {
    const salt = newOtpSalt();
    const hash = hashOtp("123456", salt, "test-pepper");
    expect(hash).not.toContain("123456");
    expect(hash).toHaveLength(64); // SHA-256 hex
    expect(verifyOtp("123456", salt, hash, "test-pepper")).toBe(true);
  });

  it("rejects incorrect OTPs", () => {
    const salt = newOtpSalt();
    const hash = hashOtp("123456", salt, "test-pepper");
    expect(verifyOtp("654321", salt, hash, "test-pepper")).toBe(false);
    expect(verifyOtp("", salt, hash, "test-pepper")).toBe(false);
  });

  it("binds the hash to the salt and pepper", () => {
    const hash = hashOtp("123456", newOtpSalt(), "test-pepper");
    expect(verifyOtp("123456", newOtpSalt(), hash, "test-pepper")).toBe(false);
    expect(verifyOtp("123456", newOtpSalt(), hash, "other-pepper")).toBe(false);
  });
});

describe("OTP expiry", () => {
  it("is valid before expiry and invalid at/after expiry", () => {
    const expiresAt = new Date("2026-01-01T00:02:00.000Z");
    expect(isExpired(expiresAt, new Date("2026-01-01T00:01:59.999Z"))).toBe(false);
    expect(isExpired(expiresAt, expiresAt)).toBe(true);
    expect(isExpired(expiresAt, new Date("2026-01-01T00:02:00.001Z"))).toBe(true);
  });

  it("uses the ratified 2-minute TTL", () => {
    expect(OTP_TTL_SECONDS).toBe(120);
  });
});

describe("attempt limit helpers", () => {
  it("starts at 0 and exhausts after 5 wrong attempts", () => {
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    expect(hasAttemptsLeft(0, OTP_MAX_ATTEMPTS)).toBe(true);
    expect(hasAttemptsLeft(4, OTP_MAX_ATTEMPTS)).toBe(true);
    expect(hasAttemptsLeft(5, OTP_MAX_ATTEMPTS)).toBe(false);
    expect(hasAttemptsLeft(6, OTP_MAX_ATTEMPTS)).toBe(false);
  });
});

describe("resend cooldown state", () => {
  it("uses the ratified 60-second cooldown", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
    const availableAt = new Date("2026-01-01T00:01:00.000Z");
    expect(canResend(availableAt, new Date("2026-01-01T00:00:59.999Z"))).toBe(false);
    expect(canResend(availableAt, availableAt)).toBe(true);
    expect(canResend(availableAt, new Date("2026-01-01T00:01:00.001Z"))).toBe(true);
  });

  it("records the future per-email send budget constants", () => {
    expect(OTP_SEND_LIMIT).toBe(5);
    expect(OTP_SEND_WINDOW_SECONDS).toBe(600);
  });
});
