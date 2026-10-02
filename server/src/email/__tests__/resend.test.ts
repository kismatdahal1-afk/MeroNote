/**
 * Step 3 provider unit tests + production diagnostics (no database, no network).
 *
 * The Resend SDK is mocked; asserts fail-closed behavior: missing
 * configuration throws before any send, provider errors map to a generic
 * error, and no credentials ever appear in thrown messages. Diagnostic
 * logging captures only safe metadata (errorType/statusCode/provider name).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Resend } from "resend";
import { env } from "../../config/env";
import { EmailProviderError, sendRegistrationOtpEmail } from "../resend";

vi.mock("resend", () => ({ Resend: vi.fn() }));

const sendMock = vi.fn();
const MockedResend = Resend as unknown as ReturnType<typeof vi.fn>;

const savedEnv = { resendApiKey: env.resendApiKey, otpFromEmail: env.otpFromEmail };

function loggedPayloads(errorSpy: ReturnType<typeof vi.fn>): string[] {
  return errorSpy.mock.calls.map((call) =>
    call.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ data: { id: "msg_test" }, error: null });
  MockedResend.mockImplementation(function (this: unknown) {
    void this;
    return { emails: { send: sendMock } } as unknown as Resend;
  });
  env.resendApiKey = "test-resend-key";
  env.otpFromEmail = "MeroNote <no-reply@test.example>";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  env.resendApiKey = savedEnv.resendApiKey;
  env.otpFromEmail = savedEnv.otpFromEmail;
  vi.restoreAllMocks();
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
    expect(err).toBeInstanceOf(EmailProviderError);
    expect((err as EmailProviderError).errorType).toBe("transport");
    expect((err as EmailProviderError).statusCode).toBeNull();
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
    expect(err).toBeInstanceOf(EmailProviderError);
    expect((err as EmailProviderError).errorType).toBe("unexpected");
    expect(err?.message).not.toContain("test-resend-key");
    expect(err?.message).not.toContain("socket hang up");
  });
});

describe("Resend failure diagnostics", () => {
  it("logs safe metadata for HTTP rejections without secrets", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "invalid_api_key", statusCode: 401, message: "Invalid API key" },
    });
    const errorSpy = vi.spyOn(console, "error");
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(EmailProviderError);
    expect((err as EmailProviderError).errorType).toBe("provider_rejection");
    expect((err as EmailProviderError).statusCode).toBe(401);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("provider_rejection");
    expect(logged).toContain("401");
    expect(logged).toContain("invalid_api_key");
    for (const secret of ["test-resend-key", "123456", "user@example.com", "no-reply@test.example"]) {
      expect(logged).not.toContain(secret);
    }
  });

  it("logs transport failures with null statusCode and no secrets", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "application_error", statusCode: null, message: "Unable to fetch data." },
    });
    const errorSpy = vi.spyOn(console, "error");
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect((err as EmailProviderError).errorType).toBe("transport");
    expect((err as EmailProviderError).statusCode).toBeNull();

    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("transport");
    for (const secret of ["test-resend-key", "123456", "user@example.com"]) {
      expect(logged).not.toContain(secret);
    }
  });

  it("logs missing configuration without values and stays generic externally", async () => {
    env.resendApiKey = "";
    const errorSpy = vi.spyOn(console, "error");
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(EmailProviderError);
    expect((err as EmailProviderError).errorType).toBe("configuration");
    expect((err as Error).message).toBe("Email provider is not configured.");

    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("configuration");
    expect(logged).not.toContain("RESEND_API_KEY");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("omits suspicious provider error names instead of logging them", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "weird name with spaces + secrets?", statusCode: 422, message: "x" },
    });
    const errorSpy = vi.spyOn(console, "error");
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch(() => undefined);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("provider_rejection");
    expect(logged).toContain("422");
    expect(logged).not.toContain("weird name");
  });
});
