# File Storage (Backblaze B2)

## Purpose

Private-bucket PDF storage with MongoDB pointers and per-request
presigned access. STABLE — do not redesign without a specific
requirement.

## Current implementation

```text
Admin upload
  → Render API (validate type/size/quota)
    → Backblaze B2 private bucket (bytes)
      → MongoDB stores file reference/key metadata
        → GET /api/resources/:id/file (presigned B2 URL, 15 min)
          → PDF.js / client download streaming
```

- SDK: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` against
  the B2 S3-compatible API. Only `storage/b2.service.ts` imports the SDK.
- Bucket stays private; access is per-request presigned GET (default
  `expiresIn = 900` s). No permanent public URLs, no exposed keys.
- MongoDB stores pointers only: `Resource.file { key, bucket, mime,
  checksum }` + mirrored `fileName/fileSize/pageCount`.
- PDF binary in MongoDB: NO. Public B2 files: NO. Full-PDF proxying: NO.

## Architecture / flow

- Object keys (`storage/objectKeys.ts`):
  `resources/{resourceId}/{safeFileName}.pdf`. Resource ids allowlisted
  `[A-Za-z0-9_-]{1,64}`; names basenamed (traversal stripped), slugified
  to `[a-z0-9._-]`, max key 512. Deterministic per resource — re-upload
  overwrites the same key.
- Acceptance (`storage/fileRules.ts`): `.pdf` extension +
  `application/pdf` MIME + `%PDF-` magic-byte sniff (client MIME never
  trusted alone); non-empty; `≤ MAX_PDF_BYTES` (default 100 MB).
- Service (`storage/b2.service.ts`): `uploadPdf` (validates, puts,
  returns `{key,bucket,mime,checksum,sizeBytes}` with server-computed
  SHA-256), `uploadResourceFile` (put-then-persist with compensating
  delete on persist failure), `getDownloadUrl` (optional existence HEAD
  + presigned GET), `deleteObject` (idempotent, missing tolerated),
  `objectExists`, `checkBucketAccess` (probe).
- Consistency (no distributed transactions): B2-put failure → MongoDB
  never touched; persist failure → fresh object deleted best-effort;
  replacement deletes the old key only after new metadata wins; delete
  failures propagate (never reported as success).
- File endpoint (`GET /api/resources/:id/file`): 400 invalid id; 404
  missing/draft/hidden/soft-deleted or B2 object missing; 410 live
  resource with no file; 503 storage unavailable; 200
  `{ url, expiresIn: 900 }`. B2 `StorageNotConfiguredError` escapes to
  the global handler here (admin upload maps it to 503 explicitly).
- Admin file ops: `POST /api/admin/resources/:id/file` (multer single
  `file` → byte validation → put-then-persist → 200 safe metadata; no
  creds → 503), `DELETE /api/admin/resources/:id/file` (removes object,
  clears metadata, forces `draft`; none attached → 410).

## Important files

- `server/src/storage/` — `b2.client.ts`, `b2.service.ts`,
  `objectKeys.ts`, `fileRules.ts`, `index.ts`
- `server/src/controllers/resourceFile.controller.ts`,
  `server/src/controllers/admin/resources.controller.ts`
  (upload/delete paths), `server/src/middleware/upload.middleware.ts`
- `client/src/lib/resourceFileApi.ts` (URL fetch + friendly error map)

## Data / ownership

- Env: `B2_REGION` (default `us-east-005`), `B2_ENDPOINT` (derived
  `https://s3.<region>.backblaze.com` unless overridden), `B2_KEY_ID`,
  `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `MAX_PDF_BYTES`. Missing
  credentials fail fast with a credential-free error at first storage
  use; MongoDB boot never depends on B2.
- Loggable: operation, resourceId, key, size, outcome. Never logged:
  key id, application key, URIs, secrets, signed URLs.

## Security / constraints

- Credentials env-only, lazy-validated, never leave the server.
- Magic-byte validation is mandatory; multer's extension/MIME filter is
  only a first gate.
- Presigned URLs expire — never cache them (SW, temp cache, or logs).

## Known limitations

- `pageCount` is admin-supplied; no server PDF parsing exists.
- No server-side quota beyond the per-file byte cap.

## Change rules

- Keep the private-bucket + presigned-URL model.
- Keep put-then-persist ordering and old-key-after-win replacement.
- Update `../operations/deployment.md` if env requirements change.
