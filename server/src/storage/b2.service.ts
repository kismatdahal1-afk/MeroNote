import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { b2Bucket, getB2Client, StorageNotConfiguredError } from "./b2.client";
import { ALLOWED_PDF_MIME, validatePdfUpload } from "./fileRules";
import { buildResourceKey } from "./objectKeys";

export { StorageNotConfiguredError };

export class StorageMissingError extends Error {
  key: string;

  constructor(key: string) {
    super(`Stored object not found: ${key}`);
    this.name = "StorageMissingError";
    this.key = key;
  }
}

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageUnavailableError";
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
  if (err instanceof StorageNotConfiguredError || err instanceof StorageMissingError) return err;
  const name = (err as { name?: string })?.name ?? "";
  const message = err instanceof Error ? err.message : String(err);
  if (name === "NotFound" || name === "NoSuchKey" || name === "NoSuchBucket") {
    return new StorageMissingError(key ?? "(unknown key)");
  }
  if (name === "AccessDenied" || name === "Forbidden") {
    return new StorageUnavailableError(`Access denied for storage object${key ? `: ${key}` : ""}.`);
  }
  if (name === "RequestTimeout" || name === "NetworkingError" || name === "TimeoutError" || /timeout|network/i.test(message)) {
    return new StorageUnavailableError(`Storage service temporarily unavailable${key ? ` for ${key}` : ""}.`);
  }
  return new StorageUnavailableError(`Storage operation failed${key ? ` for ${key}` : ""}: ${message}`);
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
  const _t0 = Date.now();
  console.log(`[TIMING] uploadPdf START resourceId=${input.resourceId} fileName=${input.fileName} bodySize=${input.body.length}`);
  const valid = validatePdfUpload(input);
  const key = buildResourceKey(input.resourceId, valid.fileName);
  const bucket = b2Bucket();
  const body = Buffer.from(input.body);
  try {
    const t1 = Date.now();
    await getB2Client().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: valid.mime }),
    );
    console.log(`[TIMING] uploadPdf B2 PutObjectCommand done in ${Date.now() - t1}ms (total ${Date.now() - _t0}ms) key=${key}`);
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
  const _t0 = Date.now();
  const t1 = Date.now();
  const meta = await uploadPdf(input);
  console.log(`[TIMING] uploadResourceFile uploadPdf done in ${Date.now() - t1}ms (total ${Date.now() - _t0}ms)`);
  try {
    const t2 = Date.now();
    const result = await input.persist(meta);
    console.log(`[TIMING] uploadResourceFile persist done in ${Date.now() - t2}ms (total ${Date.now() - _t0}ms)`);
    return result;
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
 * Time-limited retrieval for a stored key (default 15 min).
 * Accepts skipExistsCheck to avoid a redundant B2 HEAD when the caller
 * already verified existence (e.g., in the resource file endpoint).
 */
export async function getDownloadUrl(
  key: string,
  expiresInSeconds = 900,
  skipExistsCheck = false,
): Promise<string> {
  if (!skipExistsCheck && !(await objectExists(key))) {
    throw new StorageMissingError(key);
  }
  const t0 = Date.now();
  try {
    const url = await getSignedUrl(getB2Client(), new GetObjectCommand({ Bucket: b2Bucket(), Key: key }), {
      expiresIn: expiresInSeconds,
    });
    console.log(`[TIMING] getDownloadUrl done in ${Date.now() - t0}ms key=${key.substring(0, 40)}...`);
    return url;
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
