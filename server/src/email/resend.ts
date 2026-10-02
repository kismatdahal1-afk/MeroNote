import { Resend } from "resend";
import { env } from "../config/env";

/**
 * Step 3 Resend OTP email provider (thin boundary, no business logic).
 *
 * - Backend-only: `RESEND_API_KEY` / `OTP_FROM_EMAIL` come from server env,
 *   are never exposed to the frontend, never returned from an API, and never
 *   logged.
 * - Throws on missing configuration and on provider failures. Callers map
 *   every failure to a generic client error (fail closed) without leaking
 *   provider internals, keys, OTPs, or the email body.
 */

export interface RegistrationOtpEmail {
  to: string;
  otp: string;
}

/** Machine-readable Resend failure classes (safe for logs; never secrets). */
export type OtpSendErrorType = "configuration" | "provider_rejection" | "transport" | "unexpected";

/**
 * Typed Resend failure. Carries only safe metadata — never the API key,
 * OTP, addresses, or provider message text. Callers keep mapping every
 * failure to the existing generic client error.
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
 * Keep provider error names log-safe: Resend uses short snake_case codes
 * (`validation_error`, …). Anything else is omitted rather than risked.
 */
function safeProviderErrorName(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 64) return undefined;
  return /^[\w-]+$/.test(value) ? value : undefined;
}

function errorNameOf(err: unknown): string | undefined {
  return err instanceof Error ? safeProviderErrorName(err.name) : undefined;
}

/**
 * Structured server-side diagnostic for the next production failure. Logs
 * ONLY routing metadata — no key, OTP, addresses, bodies, or headers.
 */
function logOtpSendFailure(detail: {
  errorType: OtpSendErrorType;
  statusCode: number | null;
  providerErrorName?: string;
}): void {
  console.error("[OTP][Resend] Registration email send failed", {
    provider: "resend",
    errorType: detail.errorType,
    statusCode: detail.statusCode,
    ...(detail.providerErrorName ? { providerErrorName: detail.providerErrorName } : {}),
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
  if (!env.resendApiKey || !env.otpFromEmail) {
    logOtpSendFailure({ errorType: "configuration", statusCode: null });
    throw new EmailProviderError("configuration", "Email provider is not configured.");
  }
  let result: Awaited<ReturnType<Resend["emails"]["send"]>>;
  try {
    const resend = new Resend(env.resendApiKey);
    result = await resend.emails.send({
      from: env.otpFromEmail,
      to: input.to,
      subject: "Your MeroNote verification code",
      text: registrationOtpText(input.otp),
      html: registrationOtpHtml(input.otp),
    });
  } catch (err) {
    // SDK-level throw (the SDK itself returns transport failures as
    // `{ error }` values — see below — so anything caught here is unexpected).
    logOtpSendFailure({ errorType: "unexpected", statusCode: null, providerErrorName: errorNameOf(err) });
    throw new EmailProviderError("unexpected", "Failed to send verification email.", {
      providerErrorName: errorNameOf(err),
    });
  }
  if (result.error) {
    // The SDK surfaces HTTP rejections as `{ error: { name, statusCode } }`
    // and transport failures with `statusCode: null`.
    const statusCode = typeof result.error.statusCode === "number" ? result.error.statusCode : null;
    const providerErrorName = safeProviderErrorName(result.error.name);
    logOtpSendFailure({
      errorType: statusCode === null ? "transport" : "provider_rejection",
      statusCode,
      providerErrorName,
    });
    throw new EmailProviderError(
      statusCode === null ? "transport" : "provider_rejection",
      "Failed to send verification email.",
      { statusCode, providerErrorName },
    );
  }
}
