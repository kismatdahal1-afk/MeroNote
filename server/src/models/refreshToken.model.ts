import { Schema, model, type Document, type Types } from "mongoose";

/**
 * Opaque refresh-token records (F4 rotating refresh lifecycle).
 *
 * One document per issued token instance. Only the SHA-256 hash of the raw
 * token is stored — the raw value exists solely in the holder's HttpOnly
 * cookie and is never persisted, logged, or returned in JSON.
 *
 * Lifecycle: a record is active while usedAt/revokedAt are null and
 * expiresAt is in the future. Rotation atomically stamps usedAt (+replacedBy
 * lineage) and mints a child in the same family. Presenting a non-active
 * record is treated as reuse: the whole family is revoked. Logout (and any
 * sessionVersion bump) kills the family via the stored epoch + explicit
 * revocation, so refresh can never resurrect an invalidated session.
 *
 * The expiresAt TTL is hygiene only (removes dead records); every
 * security decision uses explicit active/expiry/epoch checks.
 */

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  /** F1 epoch at issuance — must still match users.sessionVersion to rotate. */
  sessionVersion: number;
  /** Sliding window (days) this family instance was issued with. */
  lifetimeDays: number;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  /** tokenHash of the child minted from this record (lineage, nullable). */
  replacedBy: string | null;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    sessionVersion: { type: Number, required: true },
    lifetimeDays: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, required: false, default: null },
    revokedAt: { type: Date, required: false, default: null },
    replacedBy: { type: String, required: false, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Expired-record cleanup only; never a substitute for explicit checks.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>("RefreshToken", refreshTokenSchema, "refresh_tokens");
