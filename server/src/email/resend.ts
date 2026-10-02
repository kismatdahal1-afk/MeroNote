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
    throw new Error("Email provider is not configured.");
  }
  const resend = new Resend(env.resendApiKey);
  const { error } = await resend.emails.send({
    from: env.otpFromEmail,
    to: input.to,
    subject: "Your MeroNote verification code",
    text: registrationOtpText(input.otp),
    html: registrationOtpHtml(input.otp),
  });
  if (error) {
    throw new Error("Failed to send verification email.");
  }
}
