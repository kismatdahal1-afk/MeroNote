# Mero Note — Temporary Cache & Offline Access (Phase 9)

> Status: TEMPORARY CACHE + BASIC OFFLINE READS. Permanent IndexedDB
> downloads (Phase 8) are untouched and always win.
>
> Core rule: **temporary cache is disposable; permanent downloads are
> user-owned. Temporary cache is NOT a download** — it never updates
> download state, counts, or UI.

## 1. Layers

| Layer | Where | What | Lifetime |
|---|---|---|---|
| Static assets | Cache API `meronote-static-v1` | Same-origin JS/CSS/images/fonts, app shell | Versioned; old versions purged on SW activate |
| Academic API | Cache API `meronote-api-v1` | Public GETs (semesters/subjects/topics/resources/books/notices) | Network-first; refreshed on every online read |
| Temp PDFs | IndexedDB `meronote-temp-cache` (separate DB) | Small PDFs (≤ 15 MB), LRU max 3 files / 30 MB | Evictable any time; corrupt entries dropped on read |
| Permanent | IndexedDB `meronote-downloads` (Phase 8) | Explicit user downloads | Until the user removes them |

## 2. Service Worker (`client/public/sw.js`, vanilla, no build step)

Registered from `main.tsx` in production builds only (dev skips it to
avoid stale bundles). Strategies: navigations → network-first falling
back to the cached shell; static assets → cache-first; allowlisted
academic GETs → network-first with cache fallback. Everything else
(auth, `/api/me/*`, `/api/admin/*`, `*/file`, mutations, cross-origin
PDFs) goes to the network untouched. Only `200` + same-origin (`basic`)
responses are stored — never 401/403/5xx, never opaque, never credentials.
Activation deletes old `meronote-*` caches; IndexedDB is never touched by
the worker, so updates can never erase permanent downloads.

Policy lives in `src/lib/cachePolicy.ts`; `sw.js` mirrors its constants
and `verify:cache` asserts the mirror (versions, prefixes, denylist).

## 3. Reader priority (`ReaderShell`)

1. Permanent download → "Saved on device"
2. Valid temp cache → "Cached copy"
3. Network, file ≤ 15 MB → fetch bytes once, validate `%PDF-`, write temp
   cache best-effort, render from the same bytes (no double download)
4. Network, larger file → existing presigned-URL streaming (temp caching
   skipped by design; permanent download remains the offline path)
5. Nothing available → existing friendly offline error

B2 presigned URLs are deliberately NOT cached: they expire, so any cached
copy would be useless, and caching them weakens the security model for
zero benefit. Large PDFs follow the same rule.

## 4. Offline UI

`useOnlineStatus()` (`navigator.onLine` + online/offline events, advisory
only — requests stay authoritative): a small Offline pill appears in the
`Header` (renders nothing while online, zero layout change), and the
reader shows the source badge above. No other UI changed; both navigations
untouched.

## 5. What is never cached

POST/PUT/PATCH/DELETE, `/api/auth/*`, `/api/me/*`, `/api/admin/*`,
`*/file` responses, JWTs/cookies, personal study data, B2 keys, arbitrary
URLs, opaque responses. Personal data stays server-backed (Phase 7).

## 6. Verification

`npm run verify:cache` (vitest, 17 tests): versions + activation purge
safety, allowlist/denylist incl. prefix-confusion and cross-origin,
response/static admittance, temp size bounds + LRU eviction + corrupt
drop + DB separation, reading-source priority matrix, offline classifier,
sw.js credential scan + policy-mirror check, no-downloads-model repo
assertion. SW lifecycle itself is browser-only (reviewed + production
build emits `sw.js` + worker assets). Full battery re-run green; Atlas
proven empty read-only afterward.

## 7. Limitations

First-ever visit must be online (nothing pre-cached); temp PDFs cover
only files ≤ 15 MB; offline search/progress-sync/favorites-sync belong to
later phases; `navigator.onLine` is a hint, not proof of reachability.
