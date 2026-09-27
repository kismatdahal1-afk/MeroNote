# Known Issues

Only code-verified issues and real limitations. Normal limitations that
are documented in feature docs are not repeated here unless they need
tracking.

## 1. Service-Worker / policy cache-version drift

- **What:** `client/public/sw.js` declares `meronote-static-v2` /
  `meronote-api-v2`, while `client/src/lib/cachePolicy.ts` declares
  `…-v1`. Both files claim `verify:cache` keeps them in sync.
- **Impact:** version rotation and the mirror assertion disagree; stale
  caches may survive or fresh caches may be purged unexpectedly
  depending on which side runs.
- **State:** open. Production-blocking: no (caches are disposable;
  downloads live in IndexedDB, untouched by the worker).
- **Fix direction:** align both sides on one version and confirm
  `verify:cache` asserts it. Documentation-only task — code untouched.

## 2. Missing `server/.env.example`

- **What:** `config/env.ts`, `db/connection.ts`, and `tokens.ts`
  reference `server/.env.example`, but the file does not exist.
- **Impact:** onboarding friction only; `config/env.ts` is the variable
  reference.
- **State:** open. Production-blocking: no.

## 3. Stale collection-count comment

- **What:** `server/src/models/index.ts` header says “10 Phase 1
  collections”; 14 models are exported.
- **Impact:** comment-only confusion.
- **State:** open (comment fix, not tracked as a bug).

## 4. Dual semester-preference paths

- **What:** embedded `users.semesterPrefs` coexists with the canonical
  `user_semester_plans` collection.
- **Impact:** removal of either path needs confirmation; both currently
  work.
- **State:** tracked limitation, not a bug.

## 5. Single-instance rate limiter

- **What:** login/register/refresh limiters are in-memory (20/min each).
- **Impact:** limits don't share across horizontally scaled instances.
- **State:** accepted for current scale; revisit if multi-instance.

## 6. File-endpoint unconfigured-B2 path

- **What:** `GET /api/resources/:id/file` does not map
  `StorageNotConfiguredError` (escapes to the global handler), unlike
  admin upload which maps it to 503.
- **Impact:** unconfigured deployments get a generic 500 instead of a
  guided 503 on reads.
- **State:** open, minor.

## 7. Minor async-handler inconsistency

- **What:** only `PATCH /api/auth/me` uses `asyncHandler`; other auth
  routes rely on inner try/catch (Express 4 drops async rejections).
- **Impact:** none observed (register/login mitigate internally), but
  wrappers should be aligned if the routes are touched.
- **State:** open, minor.
