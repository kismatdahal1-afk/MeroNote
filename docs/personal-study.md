# Mero Note — Personal Study Data (Phase 7)

> Status: AUTHENTICATED PERSONAL LAYER. Favorites, bookmarks, reading
> progress under `/api/me` + graceful frontend sync. No schema changes
> (unified models from Phase 1 stand as designed), no seeding.

## 1. Ownership model

Every row carries `userId`; every endpoint runs behind `requireAuth` and
derives ownership from `req.user.id`. Client-supplied user ids do not exist
in any request shape. ADMIN has no cross-user access — only their own rows.

## 2. Routes (`/api/me`, envelope `{status,data(,pagination)}`)

| Method + path | Auth | Behavior |
|---|---|---|
| `GET /me/favorites[?targetType]` | user | Own list, each row with `target` summary (resource title / subject name+code), paginated |
| `PUT /me/favorites/:targetType/:targetId` | user | Idempotent save: 201 first, 200 already-saved; 404 unless target is live |
| `DELETE /me/favorites/:targetType/:targetId` | user | Scoped delete, always 200 `{removed}` |
| `GET /me/bookmarks` | user | Own list with `target` summaries, paginated |
| `POST /me/bookmarks` | user | `{targetType,targetId,page?,note?}`; 201 / 200-existing; subject rejects `page`; page bounds vs real `pageCount` |
| `PATCH /me/bookmarks/:id` | user | Ownership-scoped note/page edit; 404 otherwise |
| `DELETE /me/bookmarks/:id` | user | Ownership-scoped; 404 otherwise |
| `GET /me/progress[?]` | user | Own feed, `updatedAt` desc (Continue Reading) |
| `GET /me/progress/:resourceId` | user | 404 when never read |
| `PUT /me/progress/:resourceId` | user | `{lastPage}` only; 400 unless `1 ≤ lastPage ≤ pageCount`; atomic upsert computing `progress = min(1, lastPage/pageCount)` |

Anonymous → 401 everywhere. No `passwordHash`, no secrets in any payload.

## 3. Uniqueness (pre-existing indexes, verified)

- favorites `(userId, targetType, targetId)` unique — toggle-safe, no duplicates
- bookmarks `(userId, targetType, targetId)` unique — one mark per target
- readingProgress `(userId, resourceId)` unique — upsert key, one row each

## 4. Frontend sync (`lib/studyApi.ts`, best-effort)

`LibraryProvider` toggles fire-and-forget `PUT`/`DELETE`/`POST` and keep
local state authoritative; `ReaderShell` persists page changes debounced
(1.5 s trailing edge, flushed on unmount) and seeds local progress from
the server once per resource. All calls no-op for guests and mock ids
(24-hex check) and fail silent — the demo works identically offline and
pre-integration. No UI redesign, no new buttons.

## 5. Verification

`npm run verify:personal-study`: 24 checks over real HTTP + ephemeral DB
(401 matrix, idempotent favorites incl. hidden-target 404, bookmark CRUD +
PATCH + bounds, progress upsert/get/validation/computed fractions,
cross-user + ADMIN-self isolation, fixture cleanup audit, regressions).
Full battery (parity/db/auth/content/b2/resource-file/pdf) re-run green;
Atlas proven empty read-only afterward.
