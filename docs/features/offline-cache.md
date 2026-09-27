# Offline & Cache

## Purpose

Temporary, evictable offline reads — distinct from permanent user
downloads (see `downloads.md`). Core rule: **temp cache is disposable;
permanent downloads are user-owned. Temp cache is never a download** —
it never updates download state, counts, or UI.

## Current implementation

| Layer | Where | What | Lifetime |
|---|---|---|---|
| Static assets | Cache API `meronote-static-v*` | same-origin JS/CSS/images/fonts, app shell | versioned; old purged on SW activate |
| Academic API | Cache API `meronote-api-v*` | public GETs (semesters/subjects/topics/resources/books/notices) | network-first, refreshed on every online read |
| Temp PDFs | IndexedDB `meronote-temp-cache` | small PDFs (≤ 15 MB), LRU max 3 files / 30 MB | evictable anytime; corrupt dropped on read |
| Permanent | IndexedDB `meronote-downloads` | explicit user downloads | until user removes (see `downloads.md`) |

- Service Worker (`client/public/sw.js`, vanilla, no build step),
  registered from `main.tsx` in production only: navigations →
  network-first with cached-shell fallback; static → cache-first;
  allowlisted academic GETs → network-first with cache fallback. Only
  `200` same-origin (`basic`) responses stored — never 401/403/5xx,
  opaque, credentials, auth/personal/admin/file endpoints, mutations, or
  cross-origin PDFs. Activation purges old `meronote-*` caches; IndexedDB
  is never touched, so updates can't erase downloads.
- Policy lives in `lib/cachePolicy.ts` (`CACHE_VERSION`, allowlist
  `/api/semesters|subjects|topics|resources|books|notices`, `/file`
  denylist, admittance checks, temp bounds, source labels, offline
  classifier); `sw.js` mirrors it.
- Reader priority: permanent → temp → network-fetch-and-cache (≤15 MB)
  → network-stream → offline error (see `pdf-reader.md`). Presigned URLs
  are deliberately never cached (they expire; caching weakens security).
- Offline UI: `useOnlineStatus()` (`navigator.onLine` + events, advisory
  only) drives a header Offline pill (renders nothing while online) and
  the reader source badge.

## Important files

- `client/public/sw.js`, `client/src/main.tsx` (registration)
- `client/src/lib/` — `cachePolicy.ts`, `tempPdfCache.ts`,
  `connectivity.ts`

## Data / ownership

- Never cached: non-GET, `/api/auth|me|admin`, `*/file`, JWTs/cookies,
  personal data, B2 keys, arbitrary URLs, opaque responses.
- Temp cache is device-local, user-agnostic, survives logout (no logout
  eviction), does not roam to new devices.

## Security / constraints

- `verify:cache` asserts the policy↔SW mirror, bounds, LRU, corrupt
  drop, DB separation, and credential scan.

## Known limitations

- First-ever visit must be online (nothing pre-cached).
- Temp PDFs cover ≤ 15 MB only; offline search and background sync are
  unavailable (`navigator.onLine` is a hint, not proof).
- SW declares cache `v2` while `cachePolicy.ts` declares `v1`
  (version drift — see `../operations/known-issues.md`).
- Settings “Clear cache” is currently a placeholder toast; temp usage
  display is hardcoded `0 B`.

## Change rules

- Keep temp and permanent systems on separate IndexedDB databases.
- Never cache expiring URLs, credentials, or personal endpoints.
- Keep the SW mirror in sync with `cachePolicy.ts` (fix the v1/v2 drift
  when touched).
