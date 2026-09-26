import crypto from "crypto";
import { Types } from "mongoose";
import { RefreshToken, User } from "../models";

/**
 * Opaque refresh-token lifecycle (F4).
 *
 * Raw tokens are 256-bit random hex carried only in the HttpOnly
 * `meronote_refresh` cookie. MongoDB stores SHA-256 hashes exclusively.
 * Rotation is one-time and atomic: exactly one concurrent request can claim
 * a record (usedAt/revokedAt/expiry are part of the update filter). Any
 * later presentation of the same hash is reuse → the whole family is
 * revoked and every response stays a generic 401.
 *
 * F1 integration: each record pins the users.sessionVersion epoch at
 * issuance. A bumped epoch (logout) fails rotation even for otherwise
 * active records, so refresh can never resurrect an invalidated session.
 */

const REFRESH_TOKEN_BYTES = 32;
const FAMILY_ID_BYTES = 16;

export function generateRefreshToken(): string {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

export function newRefreshFamilyId(): string {
  return crypto.randomBytes(FAMILY_ID_BYTES).toString("hex");
}

/** One-way lookup value. The raw token never leaves the holder's cookie. */
export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export interface IssuedRefreshToken {
  raw: string;
  expiresAt: Date;
}

export async function issueRefreshToken(input: {
  userId: string;
  familyId: string;
  sessionVersion: number;
  lifetimeDays: number;
}): Promise<IssuedRefreshToken> {
  const raw = generateRefreshToken();
  const expiresAt = new Date(Date.now() + input.lifetimeDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId: new Types.ObjectId(input.userId),
    familyId: input.familyId,
    tokenHash: hashRefreshToken(raw),
    sessionVersion: input.sessionVersion,
    lifetimeDays: input.lifetimeDays,
    expiresAt,
  });
  return { raw, expiresAt };
}

export type ConsumeRefreshResult =
  | {
      status: "rotated";
      userId: string;
      familyId: string;
      sessionVersion: number;
      newRaw: string;
      newExpiresAt: Date;
    }
  | { status: "rejected" };

/**
 * Atomically consume a presented refresh token.
 *
 * Winner: active + unexpired record claimed via a single conditional update,
 * user exists, issuance epoch still current → child minted in the same
 * family with a sliding lifetime. Loser (unknown hash, spent, expired, or
 * revoked record): if the hash exists anywhere the family is suspect and is
 * revoked; the response is always a generic rejection either way.
 */
export async function consumeRefreshToken(rawToken: string): Promise<ConsumeRefreshResult> {
  const now = new Date();
  const presentedHash = hashRefreshToken(rawToken);

  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash: presentedHash, usedAt: null, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: "after" },
  ).exec();

  if (!claimed) {
    const existing = await RefreshToken.findOne({ tokenHash: presentedHash }).select("familyId").lean().exec();
    if (existing) {
      await revokeRefreshFamily(existing.familyId);
    }
    return { status: "rejected" };
  }

  const user = await User.findById(claimed.userId).exec();
  if (!user || (user.sessionVersion ?? 0) !== claimed.sessionVersion) {
    await revokeRefreshFamily(claimed.familyId);
    return { status: "rejected" };
  }

  const childRaw = generateRefreshToken();
  const childHash = hashRefreshToken(childRaw);
  const childExpiresAt = new Date(now.getTime() + claimed.lifetimeDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId: claimed.userId,
    familyId: claimed.familyId,
    tokenHash: childHash,
    sessionVersion: claimed.sessionVersion,
    lifetimeDays: claimed.lifetimeDays,
    expiresAt: childExpiresAt,
  });
  await RefreshToken.updateOne({ _id: claimed._id }, { $set: { replacedBy: childHash } }).exec();

  return {
    status: "rotated",
    userId: String(claimed.userId),
    familyId: claimed.familyId,
    sessionVersion: claimed.sessionVersion,
    newRaw: childRaw,
    newExpiresAt: childExpiresAt,
  };
}

/** Revoke every record of one family (reuse response, user deletion). */
export async function revokeRefreshFamily(familyId: string): Promise<void> {
  await RefreshToken.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date() } }).exec();
}

/** Revoke every refresh family of a user (logout kills all sessions). */
export async function revokeUserRefreshFamilies(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { userId: new Types.ObjectId(userId), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).exec();
}

/** Locate the owning user of a presented raw token (logout identity fallback). */
export async function findRefreshTokenOwner(rawToken: string): Promise<string | null> {
  const record = await RefreshToken.findOne({ tokenHash: hashRefreshToken(rawToken) })
    .select("userId")
    .lean()
    .exec();
  return record ? String(record.userId) : null;
}
