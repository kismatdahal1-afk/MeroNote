import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { b2Bucket, getB2Client, StorageNotConfiguredError } from "./b2.client";
import { ALLOWED_PDF_MIME, validatePdfUpload } from "./fileRules";
import { buildResourceKey } from "./objectKeys";
import { env } from "../config/env";

/**
 * Phase 5 storage service — the ONLY module that talks to B2.
 * Controllers/models never import the SDK directly.
 *
 * Consistency contract (no distributed transactions):
 * A. B2 upload fails → MongoDB is never touched (validate + put first).
 * B. B2 succeeds but the MongoDB write fails → the fresh object is deleted
 *    via `uploadResourceFile` compensating cleanup before rethrowing.
 * C. MongoDB points at a missing object → `objectExists`/`getDownloadUrl`
 *    surface a clear StorageMissingError.
 * D. Delete failures propagate — never reported as success.
 *
 * Logging contract: callers may log operation, resourceId, key, size and
 * outcome. Keys, secrets, bucket passwords and signed URLs with embedded
 * auth material are never logged here.
 */

export { StorageNotConfiguredError };

export class StorageMissingError extends Error {
  key: string;

  constructor(key: string) {
    super(`Stored object not found: ${key}`);
    this.name = "StorageMissingError";
    this.key = key;
  }
}

export interface StoredFileMeta {
  key: string;
  bucket: string;
  mime: typeof ALLOWED_PDF_MIME;
  checksum: string;
  sizeBytes: number;
}

export function sha256Hex(body: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(body)).digest("hex");
}

function toStorageError(err: unknown, key?: string): Error {
  // Preserve typed errors (config state, missing objects) for callers that
  // map them to status codes — never wrap them into generic messages.
  if (err instanceof StorageNotConfiguredError || err instanceof StorageMissingError) return err;
  const name = (err as { name?: string })?.name ?? "";
  const message = err instanceof Error ? err.message : String(err);
  if (name === "NotFound" || name === "NoSuchKey" || name === "NoSuchBucket") {
    return new StorageMissingError(key ?? "(unknown key)");
  }
  return new Error(`Storage operation failed${key ? ` for ${key}` : ""}: ${message}`);
}

/** Bucket reachability probe (used by verification, never exposes secrets). */
export async function checkBucketAccess(): Promise<{ bucket: string; reachable: boolean }> {
  const bucket = b2Bucket();
  try {
    await getB2Client().send(new HeadBucketCommand({ Bucket: bucket }));
    return { bucket, reachable: true };
  } catch (err) {
    throw toStorageError(err);
  }
}

/**
 * Ensure the B2 bucket has CORS rules allowing the app origin
 * for GET/HEAD/OPTIONS so browser PDF.js fetches of presigned URLs work.
 * This is a fire-and-forget startup operation; failures are non-fatal.
 */
export async function ensureB2Cors(): Promise<void> {
  const client = getB2Client();
  const bucket = b2Bucket();
  const appOrigin = env.clientUrl.replace(/\/$/, "");
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "HEAD"],
              AllowedOrigins: [appOrigin],
              ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  } catch (err) {
    // Non-fatal: presigned URLs still work within the same origin;
    // this only affects cross-origin browser fetches.
    console.warn("B2 CORS configuration failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}

/** HEAD check that returns false (not throw) for a missing object. */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await getB2Client().send(new HeadObjectCommand({ Bucket: b2Bucket(), Key: key }));
    return true;
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "NotFound" || name === "NoSuchKey") return false;
    throw toStorageError(err, key);
  }
}

/**
 * Validate + upload a PDF for a resource. Returns MongoDB-ready
 * `Resource.file` metadata (key/bucket/mime/checksum) plus sizeBytes for the
 * mirrored `fileSize`. The binary stays in B2 — never returned, never logged.
 */
export async function uploadPdf(input: {
  resourceId: string;
  fileName: string;
  mime: string;
  body: Uint8Array;
}): Promise<StoredFileMeta> {
  const valid = validatePdfUpload(input);
  const key = buildResourceKey(input.resourceId, valid.fileName);
  const bucket = b2Bucket();
  const body = Buffer.from(input.body);
  try {
    await getB2Client().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: valid.mime }),
    );
  } catch (err) {
    throw toStorageError(err, key);
  }
  return { key, bucket, mime: valid.mime, checksum: sha256Hex(body), sizeBytes: valid.sizeBytes };
}

/**
 * Upload-then-persist with compensating cleanup (failure case B):
 * runs `persist(meta)` after a successful put; if persist throws, the fresh
 * object is deleted best-effort before the original error propagates.
 */
export async function uploadResourceFile<T>(input: {
  resourceId: string;
  fileName: string;
  mime: string;
  body: Uint8Array;
  persist: (meta: StoredFileMeta) => Promise<T>;
}): Promise<T> {
  const meta = await uploadPdf(input);
  try {
    return await input.persist(meta);
  } catch (persistErr) {
    try {
      await deleteObject(meta.key);
    } catch {
      // Cleanup is best-effort; the caller's error is what matters.
    }
    throw persistErr;
  }
}

/**
 * Time-limited retrieval for a stored key (default 15 min). Throws
 * StorageMissingError when the object is gone (failure case C).
 */
export async function getDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  if (!(await objectExists(key))) throw new StorageMissingError(key);
  try {
    return await getSignedUrl(getB2Client(), new GetObjectCommand({ Bucket: b2Bucket(), Key: key }), {
      expiresIn: expiresInSeconds,
    });
  } catch (err) {
    throw toStorageError(err, key);
  }
}

/** Delete a stored key. Missing objects are tolerated (idempotent); other failures throw (case D). */
export async function deleteObject(key: string): Promise<{ key: string; deleted: boolean }> {
  try {
    await getB2Client().send(new DeleteObjectCommand({ Bucket: b2Bucket(), Key: key }));
    return { key, deleted: true };
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "NoSuchKey" || name === "NotFound") return { key, deleted: false };
    throw toStorageError(err, key);
  }
}
