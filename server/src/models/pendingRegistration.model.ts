import { Schema, model, type Document } from "mongoose";

/**
 * Pending manual-registration records (Step 2 OTP foundation).
 *
 * A document exists only between registration validation and successful OTP
 * verification. No `User` document and no session is created while a pending
 * record is alive. After successful verification (a later step) the bcrypt
 * `passwordHash` is copied to `users.passwordHash` and this record is deleted.
 *
 * Security rules:
 * - `passwordHash` is bcrypt only (created with the existing `hashPassword`
 *   helper). Plaintext passwords are never stored, logged, or returned.
 * - Only `otpHash` (+ per-record `otpSalt`) is stored. Plaintext OTPs are
 *   never persisted, logged, or returned in JSON.
 * - `expiresAt` uses a TTL index for eventual cleanup only. Verification
 *   must explicitly check `expiresAt > now`; TTL deletion is lazy.
 * - `resendAvailableAt` records when another OTP may be requested (actual
 *   backend enforcement lands in the later endpoint step).
 * - `sendCount` / `firstSentAt` record OTP-send usage so the later endpoint
 *   step can enforce "5 sends per email per 10 minutes". Step 2 records the
 *   state but does not enforce the limit.
 */

export interface IPendingRegistration extends Document {
  email: string;
  name: string;
  /** Bcrypt hash of the requested password (never plaintext). */
  passwordHash: string;
  /** HMAC-SHA256 of the OTP with server pepper + per-record salt. */
  otpHash: string;
  /** Per-record 16-byte hex salt mixed into the OTP hash. */
  otpSalt: string;
  /** Wrong OTP attempts consumed so far. */
  attempts: number;
  /** Hard cap for wrong attempts (always 5; not user-configurable). */
  maxAttempts: number;
  /** OTP validity deadline (createdAt + 2 minutes). Explicitly checked. */
  expiresAt: Date;
  /** Earliest time another OTP may be requested (sentAt + 60 seconds). */
  resendAvailableAt: Date;
  /** OTP sends consumed in the current window (for the later 5/10min rule). */
  sendCount: number;
  /** Start of the current send-count window. */
  firstSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pendingRegistrationSchema = new Schema<IPendingRegistration>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: EMAIL_PATTERN,
    },
    // Same constraints as users.name and the manual registration validator.
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    // Bcrypt hash only. Never selected by default; never returned via API.
    passwordHash: { type: String, required: true, select: false },
    // OTP hash material. Never selected by default; never returned via API.
    otpHash: { type: String, required: true, select: false },
    otpSalt: { type: String, required: true, select: false },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, default: 5 },
    expiresAt: { type: Date, required: true },
    resendAvailableAt: { type: Date, required: true },
    sendCount: { type: Number, required: true, default: 1, min: 0 },
    firstSentAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Never leak credential material through JSON serialization.
pendingRegistrationSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.otpHash;
    delete ret.otpSalt;
    return ret;
  },
});
pendingRegistrationSchema.set("toObject", {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.otpHash;
    delete ret.otpSalt;
    return ret;
  },
});

// Expired-record cleanup only; never a substitute for explicit expiry checks.
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingRegistration = model<IPendingRegistration>(
  "PendingRegistration",
  pendingRegistrationSchema,
  "pending_registrations",
);
