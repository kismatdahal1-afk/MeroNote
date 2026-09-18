# Mero Note — Backblaze B2 Storage (Phase 5)

> Status: STORAGE FOUNDATION ONLY. Service layer + validation, no HTTP routes, no admin CMS, no seeding.
> SDK: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` against B2's S3-compatible API.
> MongoDB stores pointers only (`Resource.file { key, bucket, mime, checksum? }` + mirrored `fileName/fileSize/pageCount`). PDF bytes never enter MongoDB.

## 1. Purpose

The server can validate, store, retrieve (time-limited), and delete PDF binaries in Backblaze B2 while MongoDB keeps only metadata. Buckets stay private; access is via presigned URLs minted per request.

## 2. Environment variables (`server/.env`; placeholders in `server/.env.example`)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `B2_REGION` | no | `us-west-004` | Bucket region, e.g. `eu-central-003` |
| `B2_ENDPOINT` | no | `https://s3.<B2_REGION>.backblaze.com` | Override only for non-standard endpoints |
| `B2_KEY_ID` | yes (for storage ops) | — | Application key ID, env-only |
| `B2_APPLICATION_KEY` | yes (for storage ops) | — | Secret, env-only, never logged |
| `B2_BUCKET_NAME` | yes (for storage ops) | — | Private bucket; never made public for dev convenience |
| `MAX_PDF_BYTES` | no | `104857600` (100 MB) | Rejects larger uploads |

Missing credentials fail fast with a credential-free error at first storage use. MongoDB boot never depends on B2 (`requireB2Config` is lazy; importing storage opens no connections).

## 3. Object key strategy (`storage/objectKeys.ts`)

`resources/{resourceId}/{safeFileName}.pdf` — e.g. `resources/abc123/my-notes.pdf`.

- `resourceId` allowlist `[A-Za-z0-9_-]{1,64}`; anything else throws `UnsafeKeyError`.
- File names are basenamed (strips `../`, `..\`, absolute paths) then slugified to `[a-z0-9._-]`; empty results throw.
- Deterministic per resource: re-upload overwrites the same key (no collisions, no orphans on replace). Max key length 512.

## 4. PDF acceptance rules (`storage/fileRules.ts`)

PDFs only: `.pdf` extension + `application/pdf` declared MIME + `%PDF-` magic-byte sniff (client MIME never trusted alone). Non-empty, `≤ MAX_PDF_BYTES`. Violations throw `FileRejectedError` with a safe reason string.

## 5. Service surface (`storage/b2.service.ts`; only module importing the SDK)

- `uploadPdf({resourceId,fileName,mime,body})` → `{key,bucket,mime,checksum,sizeBytes}` (sha256 computed server-side; fits `Resource.file` 1:1).
- `uploadResourceFile({...persist})` → put-then-persist with compensating delete on persist failure.
- `getDownloadUrl(key, expiresInSeconds=900)` → presigned GET (default 15 min); missing object → `StorageMissingError`.
- `deleteObject(key)` → idempotent (missing tolerated); other failures throw.
- `objectExists(key)` → boolean; `checkBucketAccess()` → reachability probe.
- No model changes were needed: `Resource.file` already matches exactly.

## 6. MongoDB ↔ B2 consistency (no distributed transactions)

| Case | Behavior |
|------|----------|
| A. B2 put fails | Error propagates; MongoDB never touched (validate → put → persist order) |
| B. B2 ok, MongoDB write fails | `uploadResourceFile` deletes the fresh object best-effort, then rethrows |
| C. MongoDB points at missing object | `StorageMissingError` with the key (no secret material) |
| D. Delete fails | Error propagates; never reported as success |

## 7. Retrieval & deletion posture

Private bucket; per-request presigned URLs (no permanent public URLs, no exposed keys). No HTTP routes in this phase — endpoints arrive with the admin CMS (Phase 11), reusing this service plus `requireAuth`/`requireAdmin`.

## 8. Logging safety

Loggable: operation, resourceId, key, size, outcome. Never logged: key ID, application key, URIs, secrets, passwords, signed URLs.

## 9. Verification

`npm run verify-b2`: Tier 1 offline (config, endpoint, key vectors incl. traversal, validation incl. 100 MB oversize, sha256 vector, no-creds failure path) always runs; Tier 2 live (bucket HEAD → upload temp `resources/phase5-verify/*.pdf` → byte round-trip via presigned URL → delete → confirm gone) runs only with all three B2 vars set, otherwise reports `LIVE SKIPPED`. No real credentials are documented anywhere.
