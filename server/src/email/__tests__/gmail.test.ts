/**
 * Gmail SMTP OAuth2 provider unit tests (no database, no network).
 *
 * Nodemailer is mocked at the transport boundary; no real Gmail delivery is
 * attempted and no real credentials exist in this file (synthetic values
 * only). Asserts fail-closed behavior, the existing error taxonomy, and
 * that neither thrown errors nor diagnostic logs expose secrets.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { EmailProviderError, sendRegistrationOtpEmail } from "../gmail";

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));

const sendMock = vi.fn();
const mockedCreateTransport = nodemailer.createTransport as unknown as ReturnType<typeof vi.fn>;

const TEST_ENV = {
  gmailUser: "meronote.test@gmail.com",
  gmailOAuthClientId: "test-client-id",
  gmailOAuthClientSecret: "test-client-secret",
  gmailOAuthRefreshToken: "test-refresh-token",
};
const savedEnv = { ...TEST_ENV };
for (const key of Object.keys(savedEnv) as (keyof typeof savedEnv)[]) {
  savedEnv[key] = env[key];
}

function loggedPayloads(errorSpy: ReturnType<typeof vi.fn>): string[] {
  return errorSpy.mock.calls.map((call) =>
    call.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
  );
}

function smtpError(fields: Record<string, unknown>): Error {
  return Object.assign(new Error("smtp failure"), fields);
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ messageId: "test-message-id" });
  mockedCreateTransport.mockReturnValue({ sendMail: sendMock });
  env.gmailUser = TEST_ENV.gmailUser;
  env.gmailOAuthClientId = TEST_ENV.gmailOAuthClientId;
  env.gmailOAuthClientSecret = TEST_ENV.gmailOAuthClientSecret;
  env.gmailOAuthRefreshToken = TEST_ENV.gmailOAuthRefreshToken;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  env.gmailUser = savedEnv.gmailUser;
  env.gmailOAuthClientId = savedEnv.gmailOAuthClientId;
  env.gmailOAuthClientSecret = savedEnv.gmailOAuthClientSecret;
  env.gmailOAuthRefreshToken = savedEnv.gmailOAuthRefreshToken;
  vi.restoreAllMocks();
});

describe("Gmail OTP provider", () => {
  it("sends via Gmail SMTP OAuth2 with the configured sender", async () => {
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" });
    expect(mockedCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockedCreateTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: TEST_ENV.gmailUser,
        clientId: TEST_ENV.gmailOAuthClientId,
        clientSecret: TEST_ENV.gmailOAuthClientSecret,
        refreshToken: TEST_ENV.gmailOAuthRefreshToken,
      },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.to).toBe("user@example.com");
    expect(payload.from).toBe(TEST_ENV.gmailUser);
    expect(payload.subject).toContain("verification code");
    expect(payload.text).toContain("123456");
    expect(payload.text).toContain("2 minutes");
    expect(payload.html).toContain("123456");
  });

  it("fails closed when any Gmail configuration is missing", async () => {
    for (const key of Object.keys(TEST_ENV) as (keyof typeof TEST_ENV)[]) {
      env[key] = "";
      const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
      expect(err).toBeInstanceOf(EmailProviderError);
      expect((err as EmailProviderError).errorType).toBe("configuration");
      expect((err as Error).message).toBe("Email provider is not configured.");
      env[key] = TEST_ENV[key];
    }
    expect(mockedCreateTransport).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("maps SMTP auth rejection to provider_rejection without secrets", async () => {
    sendMock.mockRejectedValue(smtpError({ code: "EAUTH", responseCode: 535 }));
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(EmailProviderError);
    expect((err as EmailProviderError).errorType).toBe("provider_rejection");
    expect((err as EmailProviderError).statusCode).toBe(535);
    expect((err as Error).message).toBe("Failed to send verification email.");
  });

  it("maps SMTP mailbox rejection to provider_rejection", async () => {
    sendMock.mockRejectedValue(smtpError({ code: "EENVELOPE", responseCode: 550 }));
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect((err as EmailProviderError).errorType).toBe("provider_rejection");
    expect((err as EmailProviderError).statusCode).toBe(550);
  });

  it("maps connection failure to transport with null statusCode", async () => {
    sendMock.mockRejectedValue(smtpError({ code: "ECONNECTION" }));
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect((err as EmailProviderError).errorType).toBe("transport");
    expect((err as EmailProviderError).statusCode).toBeNull();
    expect((err as Error).message).toBe("Failed to send verification email.");
  });

  it("maps unexpected failures without leaking details", async () => {
    sendMock.mockRejectedValue(new Error("boom"));
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect((err as EmailProviderError).errorType).toBe("unexpected");
    expect((err as Error).message).toBe("Failed to send verification email.");
    expect((err as Error).message).not.toContain("boom");
  });
});

describe("Gmail failure diagnostics", () => {
  it("logs safe metadata and redacts every secret", async () => {
    sendMock.mockRejectedValue(smtpError({ code: "EAUTH", responseCode: 535 }));
    const errorSpy = vi.spyOn(console, "error");
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch(() => undefined);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("provider_rejection");
    expect(logged).toContain("535");
    expect(logged).toContain("EAUTH");
    for (const secret of [
      TEST_ENV.gmailUser,
      TEST_ENV.gmailOAuthClientId,
      TEST_ENV.gmailOAuthClientSecret,
      TEST_ENV.gmailOAuthRefreshToken,
      "123456",
      "user@example.com",
      "GMAIL_OAUTH",
    ]) {
      expect(logged).not.toContain(secret);
    }
  });

  it("logs transport failures without secrets", async () => {
    sendMock.mockRejectedValue(smtpError({ code: "ETIMEDOUT" }));
    const errorSpy = vi.spyOn(console, "error");
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch(() => undefined);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("transport");
    expect(logged).not.toContain(TEST_ENV.gmailOAuthRefreshToken);
    expect(logged).not.toContain("123456");
  });

  it("logs underlying socket errno/syscall for ESOCKET transport failures", async () => {
    sendMock.mockRejectedValue(
      smtpError({ code: "ESOCKET", errno: "ETIMEDOUT", syscall: "connect", address: "142.0.0.1", port: 465 }),
    );
    const errorSpy = vi.spyOn(console, "error");
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect((err as EmailProviderError).errorType).toBe("transport");
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("ETIMEDOUT");
    expect(logged).toContain("connect");
    expect(logged).not.toContain("142.0.0.1");
    expect(logged).not.toContain(TEST_ENV.gmailOAuthRefreshToken);
    expect(logged).not.toContain("123456");
  });

  it("rejects unsafe socket field values instead of logging them", async () => {
    sendMock.mockRejectedValue(
      smtpError({ code: "ESOCKET", errno: "ETIMEDOUT 142.0.0.1:465", syscall: { nested: "object" } }),
    );
    const errorSpy = vi.spyOn(console, "error");
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch(() => undefined);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("transport");
    expect(logged).not.toContain("142.0.0.1");
    expect(logged).not.toContain("nested");
  });

  it("logs missing configuration without values and stays generic externally", async () => {
    env.gmailOAuthRefreshToken = "";
    const errorSpy = vi.spyOn(console, "error");
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect((err as Error).message).toBe("Email provider is not configured.");
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("configuration");
    expect(logged).not.toContain("GMAIL_OAUTH_REFRESH_TOKEN");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("omits suspicious provider codes instead of logging them", async () => {
    sendMock.mockRejectedValue(smtpError({ code: "weird code + secrets?", response: "x" }));
    const errorSpy = vi.spyOn(console, "error");
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch(() => undefined);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("unexpected");
    expect(logged).not.toContain("weird code");
  });
});
