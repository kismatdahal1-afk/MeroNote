import nodemailer from "nodemailer";
import { env } from "../config/env";

/**
 * Gmail SMTP OAuth2 OTP email provider (thin boundary, no business logic).
 *
 * - Backend-only: `GMAIL_USER` / `GMAIL_OAUTH_*` come from server env, are
 *   never exposed to the frontend, never returned from an API, and never
 *   logged. No Gmail password or app password is used — authentication is
 *   OAuth2 via the long-lived refresh token; Nodemailer mints short-lived
 *   access tokens itself and they never leave memory.
 * - Same export surface as the previous provider, so OTP controller logic
 *   is unchanged: throws `EmailProviderError` on every failure, and callers
 *   map that to the existing generic client error (fail closed).
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
 * Keep provider error codes log-safe: Nodemailer/SMTP uses short codes
 * (`EAUTH`, `ECONNECTION`, …). Anything else is omitted rather than risked.
 */
function safeProviderErrorName(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 64) return undefined;
  return /^[\w-]+$/.test(value) ? value : undefined;
}

function errorNameOf(err: unknown): string | undefined {
  return err instanceof Error ? safeProviderErrorName(err.name) : undefined;
}

/**
 * Keep Node socket fields log-safe: `errno`/`syscall` are short lowercase
 * tokens (`ETIMEDOUT`, `connect`, `getaddrinfo`). Anything else (IPs,
 * messages, objects) is omitted rather than risked.
 */
function safeSocketField(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 32) return undefined;
  return /^[A-Za-z_]+$/.test(value) ? value : undefined;
}

/** SMTP/network failure codes that indicate transport, not rejection. */
const TRANSPORT_CODES = new Set([
  "ECONNECTION",
  "ETIMEDOUT",
  "EDNS",
  "ESOCKET",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
]);

/** Minimal structural view of a Nodemailer send failure (never logged whole). */
interface SmtpFailure {
  code?: unknown;
  responseCode?: unknown;
  errno?: unknown;
  syscall?: unknown;
}

/**
 * Structured server-side diagnostic for production failures. Logs ONLY
 * routing metadata — no OAuth secrets, OTP, addresses, bodies, or headers.
 */
function logOtpSendFailure(detail: {
  errorType: OtpSendErrorType;
  statusCode: number | null;
  providerErrorName?: string;
  errno?: string;
  syscall?: string;
}): void {
  console.error("[OTP][Gmail] Registration email send failed", {
    provider: "gmail",
    errorType: detail.errorType,
    statusCode: detail.statusCode,
    ...(detail.providerErrorName ? { providerErrorName: detail.providerErrorName } : {}),
    ...(detail.errno ? { errno: detail.errno } : {}),
    ...(detail.syscall ? { syscall: detail.syscall } : {}),
  });
}

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

/** Send the registration OTP to `to`. Never logs the OTP or credentials. */
export async function sendRegistrationOtpEmail(input: RegistrationOtpEmail): Promise<void> {
  if (!env.gmailUser || !env.gmailOAuthClientId || !env.gmailOAuthClientSecret || !env.gmailOAuthRefreshToken) {
    logOtpSendFailure({ errorType: "configuration", statusCode: null });
    throw new EmailProviderError("configuration", "Email provider is not configured.");
  }
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      type: "OAuth2",
      user: env.gmailUser,
      clientId: env.gmailOAuthClientId,
      clientSecret: env.gmailOAuthClientSecret,
      refreshToken: env.gmailOAuthRefreshToken,
    },
  });
  try {
    await transporter.sendMail({
      from: env.gmailUser,
      to: input.to,
      subject: "Your MeroNote verification code",
      text: registrationOtpText(input.otp),
      html: registrationOtpHtml(input.otp),
    });
  } catch (err) {
    // Nodemailer SMTP failures carry `code` (EAUTH/ECONNECTION/…) and, for
    // server rejections, a numeric `responseCode` (535/550/…). A numeric
    // reply means Gmail answered and refused; a transport code (or neither)
    // means the message never got an answer.
    const failure = err as SmtpFailure | null;
    const statusCode = typeof failure?.responseCode === "number" ? failure.responseCode : null;
    const code = typeof failure?.code === "string" ? failure.code : undefined;
    const errorType: OtpSendErrorType =
      statusCode !== null || code === "EAUTH"
        ? "provider_rejection"
        : code !== undefined && TRANSPORT_CODES.has(code)
          ? "transport"
          : "unexpected";
    const providerErrorName = safeProviderErrorName(code) ?? errorNameOf(err);
    // Underlying Node socket fields survive Nodemailer's ESOCKET wrap and
    // pinpoint the layer (ETIMEDOUT/connect = silent drop; getaddrinfo = DNS).
    const errno = safeSocketField(failure?.errno);
    const syscall = safeSocketField(failure?.syscall);
    logOtpSendFailure({ errorType, statusCode, providerErrorName, errno, syscall });
    throw new EmailProviderError(errorType, "Failed to send verification email.", {
      statusCode,
      providerErrorName,
    });
  }
}
