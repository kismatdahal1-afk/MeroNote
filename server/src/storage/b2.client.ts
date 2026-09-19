import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

/**
 * Backblaze B2 client (S3-compatible API).
 *
 * - Constructed lazily on first use: importing this module never opens a
 *   connection, so MongoDB boot and all non-storage features work with no
 *   B2 configuration present.
 * - Credentials come from environment only and are never logged.
 */

let client: S3Client | null = null;

export interface B2Config {
  region: string;
  endpoint: string;
  bucket: string;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Backblaze B2 is not configured. Set B2_KEY_ID, B2_APPLICATION_KEY and B2_BUCKET_NAME (see server/.env.example).",
    );
    this.name = "StorageNotConfiguredError";
  }
}

export function b2Endpoint(): string {
  const raw = env.b2Endpoint.trim();
  const base = raw || `https://s3.${env.b2Region}.backblaze.com`;
  // Backblaze shows the endpoint host without a scheme; the SDK needs one.
  return /^https?:\/\//i.test(base) ? base : `https://${base}`;
}

/** Template markers (`<...>` from server/.env.example) are never real credentials. */
export function isB2Placeholder(value: string): boolean {
  const t = value.trim();
  return t.startsWith("<") && t.endsWith(">");
}

/**
 * Throws a credential-free error when B2 is not configured.
 * Missing, blank, and placeholder values all fail closed as unconfigured:
 * treating them as live config would point the SDK at a bogus endpoint
 * instead of the documented 503 offline behavior.
 */
export function requireB2Config(): B2Config {
  const trio = [env.b2KeyId, env.b2ApplicationKey, env.b2BucketName];
  if (trio.some((v) => !v.trim() || isB2Placeholder(v))) {
    throw new StorageNotConfiguredError();
  }
  return { region: env.b2Region, endpoint: b2Endpoint(), bucket: env.b2BucketName };
}

export function b2Bucket(): string {
  return requireB2Config().bucket;
}

export function getB2Client(): S3Client {
  if (client) return client;
  requireB2Config();
  client = new S3Client({
    region: env.b2Region,
    endpoint: b2Endpoint(),
    credentials: {
      accessKeyId: env.b2KeyId,
      secretAccessKey: env.b2ApplicationKey,
    },
    // B2 speaks virtual-hosted style on its S3 endpoint.
    forcePathStyle: false,
    // B2 rejects the SDK's default flexible-checksum headers — send a
    // checksum only when the operation requires one.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return client;
}

/** Test seam: drop the cached client (used by verification, never in prod). */
export function resetB2Client(): void {
  client = null;
}
