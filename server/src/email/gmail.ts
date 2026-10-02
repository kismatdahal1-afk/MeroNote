import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { env } from "../config/env";

/**
 * Gmail API OTP email provider (thin boundary, no business logic).
 *
 * Delivery path: OAuth2 refresh-token flow (access tokens live only in
 * memory, minted on demand by google-auth-library) → Gmail API
 * `users.messages.send` over HTTPS :443. No SMTP, no passwords, no stored
 * tokens. Replaces the previous Nodemailer SMTP transport behind the
 * identical export surface, so OTP controller logic is unchanged: throws
 * `EmailProviderError` on every failure, and callers map that to the
 * existing generic client error (fail closed).
 *
 * Backend-only: `GMAIL_USER` / `GMAIL_OAUTH_*` come from server env, are
 * never exposed to the frontend, never returned from an API, and never
 * logged.
 */

export interface RegistrationOtpEmail {
  to: string;
  otp: string;
}

/** Machine-readable send failure classes (safe for logs; never secrets). */
export type OtpSendErrorType = "configuration" | "provider_rejection" | "transport" | "unexpected";

/**
 * Typed email-provider failure. Carries only safe metadata — never OAuth
 * secrets, OTPs, addresses, or provider message text. Callers keep mapping
 * every failure to the existing generic client error.
 */
export class EmailProviderError extends Error {
  readonly errorType: OtpSendErrorType;
  readonly statusCode: number | null;
  readonly providerErrorName?: string;

  constructor(
    errorType: OtpSendErrorType,
    message: string,
    options?: { statusCode?: number | null; providerErrorName?: string },
  ) {
    super(message);
    this.name = "EmailProviderError";
    this.errorType = errorType;
    this.statusCode = options?.statusCode ?? null;
    if (options?.providerErrorName) this.providerErrorName = options.providerErrorName;
  }
}

/**
 * Keep provider error codes log-safe: short tokens only (`401`,
 * `ECONNREFUSED`, …). Anything else is omitted rather than risked.
 */
function safeProviderErrorName(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 64) return undefined;
  return /^[\w-]+$/.test(value) ? value : undefined;
}

function errorNameOf(err: unknown): string | undefined {
  return err instanceof Error ? safeProviderErrorName(err.name) : undefined;
}

/** Network failure codes that indicate transport, not rejection. */
const TRANSPORT_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EPIPE",
  "ERR_NETWORK",
]);

/**
 * Minimal structural view of a Gmail API send failure (never logged whole).
 * Gaxios failures carry the HTTP `response.status` and/or a `code`.
 */
interface GmailApiFailure {
  response?: { status?: unknown } | null;
  code?: unknown;
}

/**
 * Structured server-side diagnostic for production failures. Logs ONLY
 * routing metadata — no OAuth secrets, OTP, addresses, bodies, or headers.
 */
function logOtpSendFailure(detail: {
  errorType: OtpSendErrorType;
  statusCode: number | null;
  providerErrorName?: string;
}): void {
  console.error("[OTP][Gmail] Registration email send failed", {
    provider: "gmail",
    errorType: detail.errorType,
    statusCode: detail.statusCode,
    ...(detail.providerErrorName ? { providerErrorName: detail.providerErrorName } : {}),
  });
}

/** Gmail API request timeout: failures surface in seconds, never hang. */
const GMAIL_API_TIMEOUT_MS = 20000;

function registrationOtpText(otp: string): string {
  return [
    "MeroNote",
    "",
    "Your verification code is:",
    "",
    otp,
    "",
    "This code expires in 2 minutes.",
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
}

function registrationOtpHtml(otp: string): string {
  return [
    "<p>MeroNote</p>",
    "<p>Your verification code is:</p>",
    `<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otp}</p>`,
    "<p>This code expires in 2 minutes.</p>",
    "<p>If you did not request this, you can ignore this email.</p>",
  ].join("\n");
}

/**
 * Build the RFC 2822 MIME message (multipart/alternative, CRLF line
 * endings throughout). Subject/recipient are ASCII-safe by construction
 * (fixed subject, validated email), so no RFC 2047 encoding is needed.
 */
export function buildOtpMimeMessage(to: string, otp: string): string {
  const boundary = `meronote-${crypto.randomBytes(16).toString("hex")}`;
  // Bodies are authored with LF; normalize to CRLF (collapsing any existing
  // CRLF first so this never produces `\r\r\n`).
  const textBody = registrationOtpText(otp).replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  const htmlBody = registrationOtpHtml(otp).replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  return [
    `From: ${env.gmailUser}`,
    `To: ${to}`,
    "Subject: Your MeroNote verification code",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    textBody,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    htmlBody,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Base64url without padding, as required by `messages.send`. */
export function encodeMimeMessage(mime: string): string {
  return Buffer.from(mime, "utf8").toString("base64url");
}

/** Send the registration OTP to `to`. Never logs the OTP or credentials. */
export async function sendRegistrationOtpEmail(input: RegistrationOtpEmail): Promise<void> {
  if (!env.gmailUser || !env.gmailOAuthClientId || !env.gmailOAuthClientSecret || !env.gmailOAuthRefreshToken) {
    logOtpSendFailure({ errorType: "configuration", statusCode: null });
    throw new EmailProviderError("configuration", "Email provider is not configured.");
  }
  const oauth = new OAuth2Client(env.gmailOAuthClientId, env.gmailOAuthClientSecret);
  oauth.setCredentials({ refresh_token: env.gmailOAuthRefreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth });
  const raw = encodeMimeMessage(buildOtpMimeMessage(input.to, input.otp));
  try {
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } }, { timeout: GMAIL_API_TIMEOUT_MS });
  } catch (err) {
    // Gaxios failures carry HTTP `response.status` for provider rejections
    // and a bare `code` for network failures. Anything else is unexpected.
    const failure = err as GmailApiFailure | null;
    const responseStatus = failure?.response?.status;
    const statusCode = typeof responseStatus === "number" ? responseStatus : null;
    const code = typeof failure?.code === "string" ? failure.code : undefined;
    const errorType: OtpSendErrorType =
      statusCode !== null
        ? "provider_rejection"
        : code !== undefined && TRANSPORT_CODES.has(code)
          ? "transport"
          : "unexpected";
    const providerErrorName = safeProviderErrorName(code) ?? errorNameOf(err);
    logOtpSendFailure({ errorType, statusCode, providerErrorName });
    throw new EmailProviderError(errorType, "Failed to send verification email.", {
      statusCode,
      providerErrorName,
    });
  }
}
