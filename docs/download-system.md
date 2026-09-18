# Mero Note — Download System (Phase 8)

> Status: REAL CLIENT-SIDE DOWNLOADS. IndexedDB blobs + in-memory state.
> No MongoDB downloads collection exists by design — the server never learns
> what a user downloaded. Temporary cache and permanent downloads are
> separate systems (no Service Worker download management in this phase).

## 1. Architecture

```
User clicks Download
  → LibraryProvider.startDownload (duplicate-safe)
  → GET /api/resources/:id/file (existing secure endpoint, unchanged)
  → presigned B2 URL (unchanged backend)
  → streamed fetch → real byte progress → Blob
  → %PDF- magic validation → IndexedDB put → completed
```

Only the presigned URL crosses the network boundary. No B2 keys, no bucket
credentials, no JWT in localStorage (session cookie unchanged).

## 2. IndexedDB design (`lib/downloadStore.ts`)

Database `meronote-downloads`, store `files`, keyPath `resourceId`:

| Field | Purpose |
|---|---|
| `resourceId` | key — one blob per resource |
| `blob` | the actual PDF bytes |
| `fileName` / `mimeType` / `fileSize` | display + reopen info |
| `downloadedAt` | history sort |

Typed `DownloadStorageError` (`unavailable` / `quota` / `corrupt`) — quota
maps to "Not enough device storage to save this PDF." Nothing else is
stored: progress/state live in React state, row index of *completed*
downloads in localStorage (`meronote.library.downloads.v1`, reconciled
against IndexedDB on boot, orphans pruned).

## 3. Lifecycle (`lib/downloadManager.ts`, one AbortController per resource)

`idle → downloading → completed | failed | cancelled`. Progress is
`downloadedBytes / Content-Length × 100` (capped at 99 mid-stream, exact
100 on completion) or indeterminate (spinner, no fake numbers) without a
length. Same-resource double-start refused; resources download in parallel.
Cancel aborts the fetch, stores nothing, stays retryable. Retry always
starts a clean operation. Remove deletes the IndexedDB record + state only
(existing ConfirmDialog kept) — never touches B2 or MongoDB.

## 4. Local reader (`ReaderShell`)

Downloaded blob → `URL.createObjectURL` → existing PDF.js path; corrupt
records are deleted and fall back to remote; URLs revoked on
change/unmount. Online flow untouched.

## 5. UI states

Idle `[Download]` → downloading `[ bar % ] [Cancel]` → completed
`[✓ Downloaded] [Remove]` → failed/cancelled `[Retry]` (+ reason text).
Existing cards, pages, icons, and both navigations unchanged.

## 6. Errors

Offline, expired URL, HTTP failure, empty/invalid (non-`%PDF-`) payload,
quota, and aborts each map to a concise message; failed downloads never
leave completed records. No stack traces or backend internals shown.

## 7. Verification

`npm run verify:downloads` (vitest + fake-indexeddb, 14 tests): store
CRUD, missing/removed records, magic accept/reject, real progress math,
indeterminate mode, abort cleanup, duplicate refusal, error mapping,
blob-URL round-trip + revoke, corrupt-drop, and the no-downloads-model
repo assertion. Full battery (typechecks/builds, all server suites,
`verify:pdf`) re-run green; Atlas proven empty read-only afterward.

## 8. Intentionally NOT implemented

Server download records/history, offline sync, Service Worker/PWA cache
work, admin CMS/uploads, search, download analytics, cloud sync of
downloads, storage-manager UI beyond the existing Downloads page.
