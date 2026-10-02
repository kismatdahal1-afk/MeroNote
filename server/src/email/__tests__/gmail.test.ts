/**
 * Gmail API provider unit tests (no database, no network).
 *
 * The `googleapis` client and `google-auth-library` OAuth2 client are
 * mocked; no real Gmail delivery is attempted and no real credentials exist
 * in this file (synthetic values only). Asserts the Gmail API send contract
 * (endpoint, userId, MIME, base64url), the existing error taxonomy, and that
 * neither thrown errors nor diagnostic logs expose secrets.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { env } from "../../config/env";
import {
  EmailProviderError,
  buildOtpMimeMessage,
  encodeMimeMessage,
  sendRegistrationOtpEmail,
} from "../gmail";

vi.mock("googleapis", () => ({ google: { gmail: vi.fn() } }));
vi.mock("google-auth-library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("google-auth-library")>();
  return { ...actual, OAuth2Client: vi.fn() };
});

const sendMock = vi.fn();
const setCredentialsMock = vi.fn();
const MockedGmail = google.gmail as unknown as ReturnType<typeof vi.fn>;
const MockedOAuth2Client = OAuth2Client as unknown as ReturnType<typeof vi.fn>;

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

function sentRaw(): string {
  const calls = sendMock.mock.calls;
  const last = calls[calls.length - 1][0] as { requestBody: { raw: string } };
  return last.requestBody.raw;
}

function decodeRaw(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

function apiError(fields: Record<string, unknown>): Error {
  return Object.assign(new Error("gmail api failure"), fields);
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ data: { id: "msg_test" } });
  MockedOAuth2Client.mockImplementation(function (this: unknown) {
    void this;
    return { setCredentials: setCredentialsMock };
  });
  MockedGmail.mockReturnValue({ users: { messages: { send: sendMock } } });
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

describe("Gmail API provider", () => {
  it("sends via users.messages.send with OAuth2 and a bounded timeout", async () => {
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" });
    expect(MockedOAuth2Client).toHaveBeenCalledWith(TEST_ENV.gmailOAuthClientId, TEST_ENV.gmailOAuthClientSecret);
    expect(setCredentialsMock).toHaveBeenCalledWith({ refresh_token: TEST_ENV.gmailOAuthRefreshToken });
    expect(MockedGmail).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [params, options] = sendMock.mock.calls[0] as [
      { userId: string; requestBody: { raw: string } },
      { timeout: number },
    ];
    expect(params.userId).toBe("me");
    expect(typeof params.requestBody.raw).toBe("string");
    expect(options.timeout).toBeGreaterThanOrEqual(15000);
    expect(options.timeout).toBeLessThanOrEqual(20000);
  });

  it("encodes a valid MIME message with the existing OTP content", async () => {
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" });
    const raw = sentRaw();
    expect(raw).toMatch(/^[A-Za-z0-9-_]+$/);
    expect(raw).not.toContain("+");
    expect(raw).not.toContain("/");
    const mime = decodeRaw(raw);
    expect(mime).toContain(`From: ${TEST_ENV.gmailUser}`);
    expect(mime).toContain("To: user@example.com");
    expect(mime).toContain("Subject: Your MeroNote verification code");
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain("123456");
    expect(mime).toContain("This code expires in 2 minutes.");
    expect(mime).toContain("<p>MeroNote</p>");
  });

  it("builds MIME messages that round-trip through base64url", async () => {
    const mime = buildOtpMimeMessage("user@example.com", "123456");
    expect(mime).toContain("\r\n");
    const roundTripped = decodeRaw(encodeMimeMessage(mime));
    expect(roundTripped).toBe(mime);
    expect(encodeMimeMessage(mime)).toMatch(/^[A-Za-z0-9-_]+$/);
  });

  it("uses CRLF throughout with no lone LF and no doubled carriage returns", async () => {
    const mime = buildOtpMimeMessage("user@example.com", "123456");
    expect(mime).toContain("\r\n");
    expect(mime).not.toContain("\r\r\n");
    const withoutCrlf = mime.split("\r\n").join("");
    expect(withoutCrlf).not.toContain("\n");
    expect(withoutCrlf).not.toContain("\r");
    // Bodies survive normalization with content intact.
    expect(mime).toContain("Your verification code is:");
    expect(mime).toContain("This code expires in 2 minutes.");
    expect(mime).toContain("<p>MeroNote</p>");
    const roundTripped = decodeRaw(encodeMimeMessage(mime));
    expect(roundTripped).toBe(mime);
    expect(encodeMimeMessage(mime)).toMatch(/^[A-Za-z0-9-_]+$/);
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
    expect(MockedGmail).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("maps HTTP 400/401/403 rejections without secrets", async () => {
    for (const statusCode of [400, 401, 403]) {
      sendMock.mockRejectedValueOnce(apiError({ response: { status: statusCode }, code: String(statusCode) }));
      const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
      expect(err).toBeInstanceOf(EmailProviderError);
      expect((err as EmailProviderError).errorType).toBe("provider_rejection");
      expect((err as EmailProviderError).statusCode).toBe(statusCode);
      expect((err as Error).message).toBe("Failed to send verification email.");
    }
  });

  it("maps timeout/network failure to transport with null statusCode", async () => {
    sendMock.mockRejectedValueOnce(apiError({ code: "ETIMEDOUT" }));
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect((err as EmailProviderError).errorType).toBe("transport");
    expect((err as EmailProviderError).statusCode).toBeNull();
    expect((err as Error).message).toBe("Failed to send verification email.");
  });

  it("maps unexpected failures without leaking details", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));
    const err = await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch((e: Error) => e);
    expect((err as EmailProviderError).errorType).toBe("unexpected");
    expect((err as Error).message).toBe("Failed to send verification email.");
    expect((err as Error).message).not.toContain("boom");
  });
});

describe("Gmail API failure diagnostics", () => {
  it("logs safe metadata and redacts every secret", async () => {
    sendMock.mockRejectedValueOnce(apiError({ response: { status: 401 }, code: "401" }));
    const errorSpy = vi.spyOn(console, "error");
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch(() => undefined);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("provider_rejection");
    expect(logged).toContain("401");
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
    sendMock.mockRejectedValueOnce(apiError({ code: "ENOTFOUND" }));
    const errorSpy = vi.spyOn(console, "error");
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch(() => undefined);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("transport");
    expect(logged).not.toContain(TEST_ENV.gmailOAuthRefreshToken);
    expect(logged).not.toContain("123456");
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
    sendMock.mockRejectedValueOnce(apiError({ code: "weird code + secrets?", response: "x" }));
    const errorSpy = vi.spyOn(console, "error");
    await sendRegistrationOtpEmail({ to: "user@example.com", otp: "123456" }).catch(() => undefined);
    const logged = loggedPayloads(errorSpy).join(" ");
    expect(logged).toContain("unexpected");
    expect(logged).not.toContain("weird code");
  });
});
