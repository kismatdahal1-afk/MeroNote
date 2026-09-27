# Personalization

## Purpose

Per-user study state: favorites, bookmarks, reading progress, semester
plan, preferences (recents + continue-reading), download history.
Documents the final model after the Phase 16–21 evolution — not the old
Phase 15 audit.

## Current implementation

Every row carries `userId`; every `/api/me` endpoint runs behind
`requireAuth + requireCsrf` and derives ownership from `req.user`.
Client-supplied user ids do not exist. ADMIN has no cross-user access.

| Method + path | Behavior |
|---|---|
| `GET /me/favorites[?targetType]` | own list + target summaries, paginated |
| `PUT /me/favorites/:type/:id` | idempotent save (201 new / 200 existing; 404 unless target live) |
| `DELETE /me/favorites/:type/:id` | scoped delete, always 200 `{removed}` |
| `GET /me/bookmarks` | own list + summaries, paginated |
| `POST /me/bookmarks` | `{targetType,targetId,page?,note?}`; resource page default 1, bounded by real `pageCount` (400 “no readable file” when fileless); subject rejects `page`; `note ≤ 1000`; 201/200 |
| `PATCH /me/bookmarks/:id` | ownership-scoped note/page edit; 404 otherwise |
| `DELETE /me/bookmarks/:id` | ownership-scoped; 404 otherwise |
| `GET /me/progress` | own feed, `updatedAt` desc (Continue Reading) |
| `GET /me/progress/:resourceId` | 404 when never read |
| `PUT /me/progress/:resourceId` | `{lastPage}` only; `1 ≤ lastPage ≤ pageCount`; atomic upsert, server computes `progress = min(1, lastPage/pageCount)` |
| `GET /me/semester-plan` | whole per-user list, `updatedAt` desc (no pagination) |
| `PATCH /me/semester-plan/:semesterId` | semester must be live; ≥1 field; strict `yyyy-mm-dd` UTC dates, `endDate > startDate`; demote-others then promote (single `ongoing`); 409 on races |
| `GET /me/downloads` | own history + resource summaries, paginated (see `downloads.md`) |
| `PUT / PATCH / DELETE /me/downloads/:id` | register / verify / history-only remove (see `downloads.md`) |
| `GET /me/preferences` | never 404 — absent returns empty defaults |
| `POST /me/preferences/recent` | atomic dedupe + prepend, cap 20, always 200 |
| `PUT / DELETE /me/preferences/continue-reading/:id` | explicit-only add (`$addToSet`, uncapped, 201/200) / idempotent remove |

Uniqueness: favorites and bookmarks `(userId,targetType,targetId)`;
progress `(userId,resourceId)`; plans `(userId,semesterId)` + partial
unique `{userId}` where `ongoing`; download history
`(userId,resourceId)`; preferences `(userId)`. One bookmark per target;
one `ongoing` semester per user.

## Architecture / flow

- Hydration (`LibraryProvider`): guests reload local mirrors only (no
  requests). Authed: clear in-memory (no cross-user flash) → one-time
  guest→account merge → parallel fetch of all personal lists,
  server-wins, each list applied independently (partial failure surfaces
  `libraryError`, never mistaken for empty).
- Frontend sync is optimistic + best-effort with actor/generation guards
  (late responses after logout/switch dropped). Reader persists progress
  debounced (1.5 s + unmount flush) and seeds from server once per
  resource. Recents fire-and-forget; continue-reading reverts on failure.
- Guest→account merge (once per session, cap 500 ops): valid favorites /
  bookmarks pushed through idempotent endpoints; mock/junk dropped.
  Never merged: guest progress, guest continue-reading, legacy download
  registry, semester plan except one-time migration when the server is
  empty.
- Same-user new device: full server hydrate; downloads show `remote`
  until bytes fetched. Different-user same device: full state reset,
  per-user mirror namespaces, claimed-guest prune.
- Dashboard: recents (first 4 resolved, 2 shown) + explicit
  continue-reading (newest first), vanished resources filtered without
  touching membership; Downloaded stat counts device-completed.

## Important files

- Server: `routes/me.route.ts`, `controllers/{favorites,bookmarks,progress,semesterPlan,downloads,preferences}.controller.ts`,
  `repositories/{preferences,semesterPlans,downloads,content}.ts`
- Client: `lib/{studyApi,semesterPlanApi,preferencesApi,downloadHistoryApi,personalAdapters,librarySync,semesterProgress}.ts`,
  `state/{LibraryProvider,UserProvider,SemesterStatusProvider}.tsx`,
  `components/reader/ReaderShell.tsx`, `pages/Dashboard.tsx`

## Data / ownership

- SERVER TRUTH: favorites, bookmarks, progress, plans, preferences,
  download history.
- LOCAL MIRROR: namespaced localStorage rows + in-memory state
  (optimistic, reconciled against server).
- DEVICE-ONLY: downloaded blobs, temp cache, guest progress /
  continue-reading (memory-only, never merged).

## Security / constraints

- Anonymous → 401 everywhere on `/api/me`. No secrets in payloads.
- `page`/`note` rules and `pageCount` bounds enforced server-side.

## Known limitations

- Recents cap 20; continue-reading uncapped but explicit-only (opens and
  progress never create entries).
- Offline edits to personal state are not queued (fail silent / revert).

## Change rules

- Keep server-wins hydration with per-list independence.
- Keep the merge exclusion list (progress, continue-reading, download
  registry).
- Keep single-`ongoing` enforcement on both client and server.
