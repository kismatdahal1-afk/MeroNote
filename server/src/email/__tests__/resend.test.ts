/**
 * Step 3 provider unit tests (no database, no network).
 *
 * The Resend SDK is mocked; asserts fail-closed behavior: missing
 * configuration throws before any send, provider errors map to a generic
 * error, and no credentials ever appear in thrown messages.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Resend } from "resend";
import { env } from "../../config/env";
import { sendRegistrationOtpEmail } from "../resend";

vi.mock("resend", () => ({ Resend: vi.fn() }));

const sendMock = vi.fn();
const MockedResend = Resend as unknown as ReturnType<typeof vi.fn>;

const savedEnv = { resendApiKey: env.resendApiKey, otpFromEmail: env.otpFromEmail };

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ data: { id: "msg_test" }, error: null });
  MockedResend.mockImplementation(function (this: unknown) {
    void this;
    return { emails: { send: sendMock } } as unknown as Resend;
  });
  env.resendApiKey = "test-resend-key";
  env.otpFromEmail = "MeroNote <no-reply@test.example>";
});

afterEach(() => {
  env.resendApiKey = savedEnv.resendApiKey;
  env.otpFromEmail = savedEnv.otpFromEmail;
});

describe("Resend OTP provider", () => {
  it("sends the OTP email with the configured sender", async () => {
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" });
    expect(MockedResend).toHaveBeenCalledWith("test-resend-key");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.to).toBe("user@example.com");
    expect(payload.from).toBe("MeroNote <no-reply@test.example>");
    expect(payload.text).toContain("123456");
    expect(payload.text).toContain("2 minutes");
    expect(payload.html).toContain("123456");
  });

  it("fails closed when configuration is missing", async () => {
    env.resendApiKey = "";
    await expect(sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" })).rejects.toThrow(
      "not configured",
    );
    env.resendApiKey = "test-resend-key";
    env.otpFromEmail = "";
    await expect(sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" })).rejects.toThrow(
      "not configured",
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("maps provider errors to a generic error without leaking details", async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: "validation_error", message: "internal-sdk-detail" } });
    let err: Error | null = null;
    try {
      await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" });
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).not.toContain("internal-sdk-detail");
    expect(err?.message).not.toContain("test-resend-key");
    expect(err?.message).not.toContain("123456");
  });

  it("propagates SDK transport failures without credentials", async () => {
    sendMock.mockRejectedValue(new Error("socket hang up"));
    let err: Error | null = null;
    try {
      await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" });
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).not.toContain("test-resend-key");
  });
});
