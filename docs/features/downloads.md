# Downloads

## Purpose

Permanent, user-owned offline PDFs (device blobs) plus the
account-level download history (server record). Separate system from
temp cache (see `offline-cache.md`).

## Current implementation

```text
Download click → LibraryProvider.startDownload (duplicate-safe)
→ GET /api/resources/:id/file → presigned B2 URL
→ streamed fetch → real byte progress → Blob
→ %PDF- validation → IndexedDB put → completed
→ PUT /api/me/downloads/:id (history) only after local write
```

- IndexedDB `meronote-downloads` / store `files`, keyPath `resourceId`:
  `{ resourceId, blob, fileName, mimeType, fileSize, downloadedAt }`.
  One blob per resource. `DownloadStorageError`: `unavailable` /
  `quota` (“Not enough device storage…”) / `corrupt`.
- Lifecycle (`downloadManager.ts`, one AbortController per resource):
  `idle → downloading → completed | failed | cancelled`. Real
  `bytes / Content-Length` progress (99 cap mid-stream, exact 100 on
  completion) or indeterminate spinner without a length (never faked).
  Same-resource double-start refused; parallel across resources; cancel
  aborts and stores nothing; retry starts clean; remove deletes the blob
  + state only (never B2/MongoDB). Partial/failed never stored.
- Two truths → combined state (`downloadRegistry.ts`): account
  `download_history` row × device blob =
  `saved | remote | local-only | none`. Completed device rows rebuild
  strictly from **history ∩ blobs**; failed/cancelled are session-only.
- History API (`/api/me/downloads`): `GET` (paginated, missing resource
  → `resource: null`), `PUT /:id {fileSize?}` (live-only, idempotent
  re-download refresh, 201/200), `PATCH /:id {verify,fileSize?}`
  (stamps `lastVerifiedAt`, never reorders), `DELETE /:id` (history-only,
  idempotent; blob becomes orphan). Status enum is `["active"]`
  (`"removed"` reserved).
- Orphans: blobs without history/account rows; explicit adopt flow
  verifies the blob then registers history. Hydration auto-retries
  unregistered mirror rows and runs a bounded verify pass (≤100,
  7-day staleness).
- Reader: blob is the primary source (“Saved on device”); corrupt blobs
  deleted with remote fallback. UI: idle `[Download]` → downloading
  `[bar %] [Cancel]` → completed `[✓ Downloaded] [Remove]` →
  failed/cancelled `[Retry]` + reason.

## Important files

- Client: `lib/downloadStore.ts`, `downloadManager.ts`,
  `downloadRegistry.ts`, `downloadHistoryApi.ts`, `state/LibraryProvider.tsx`,
  `pages/Downloads.tsx`, `components/cards/DownloadCard.tsx`
- Server: `controllers/downloads.controller.ts`,
  `repositories/downloads.ts`, `models/downloadHistory.model.ts`

## Data / ownership

- Blobs: device-local, shared physical layer, viewed per-user; survive
  logout; absent on new devices (state shows `remote`).
- History rows: per-user server truth; roam across devices.
- Mirror: completed-row index in localStorage, namespaced per user
  (guest `…v1`, authed `…v2.<uid>`); legacy v1 never auto-migrated.

## Security / constraints

- Only the presigned URL crosses the network; no B2 keys/buckets/creds,
  no JWT in localStorage. Empty/non-`%PDF-` payloads rejected.

## Known limitations

- No server analytics, no cloud sync of bytes, no storage-manager UI
  beyond the Downloads page. Unbounded blob growth (user-managed).

## Change rules

- Never mix cache eviction with download deletion.
- Register history only after the local blob write wins.
- Keep failed/cancelled rows out of rebuilds.
