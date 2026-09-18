# Mero Note — Backend Architecture & Schema Design (Phase 0)

> Status: DESIGN ONLY. No models, no connection, no auth, no APIs implemented.
> Source of truth: `client/src/types/index.ts`, `client/src/data/mock.ts`, `client/src/state/*`, `client/src/lib/*`, `client/src/pages/*`, `client/src/components/*`, `client/src/router.tsx`, `server/src/*`, prior metadata audit.
> Stack decision: MongoDB Atlas = structured metadata. Backblaze B2 = PDF bytes. MongoDB MUST NOT store PDF binaries.

---

## 1. Current backend state

`server/src` contains exactly 7 files, no sub-domains:

- `server.ts` — `app.listen(env.port)`.
- `app.ts` — `cors({origin: env.clientUrl})`, `express.json()`, mounts `/api` router, 404 + error middleware.
- `config/env.ts` — `PORT (default 5000)`, `NODE_ENV (default development)`, `CLIENT_URL (default http://localhost:5173)` via `dotenv`.
- `routes/index.ts` — aggregates router.
- `routes/health.route.ts` — `GET /health` → full path `GET /api/health`.
- `controllers/health.controller.ts` — `getHealth` returns `{ status: "ok", message: "Mero Note API is running", timestamp: ISO }`.
- `middleware/error.middleware.ts` — 404 `next(Error("Not found: METHOD URL"))`; error handler `{ status: "error", message, stack? (dev only) }`.

Dependencies (`server/package.json`): `express`, `cors`, `dotenv` (+ `@types/*`, `tsx`, `typescript`). No ODM, no validator, no auth lib.

Frontend coupling: the ONLY network call in `client/src` is `pages/Settings.tsx:26` → `fetch(${VITE_API_URL}/api/health)`. Everything else reads `state/cmsStore.ts` (localStorage key `meronote-cms-db-v1`) + `LibraryProvider` in-memory/localStorage state. There are no request/response DTOs to reuse.

---

## 2. Architecture overview

```
Desktop / Android (React + Vite PWA)
  → Express + TypeScript API (stateless, JWT-checked per request)
    → MongoDB Atlas (all structured metadata, pointers only)
    → Backblaze B2 (PDF object bytes, addressed by key)
  → PDF.js renders from short-lived B2 URL
  → Browser/device: temp cache (evictable) vs permanent downloads (user-owned files)
```

Principles:

1. Smallest clean set: 10 collections (see §3). No extra collections without evidence.
2. All personal data is `userId`-scoped. No global favorites/bookmarks/progress rows.
3. Content visibility uses two orthogonal flags: `status: PublishStatus` (CMS lifecycle) + `hidden: boolean` (published-but-invisible). No `visibility` string.
4. Files: MongoDB stores a B2 pointer (`file.key` + size/mime/checksum). Bytes live only in B2.
5. Soft delete (`deletedAt`) for admin content; hard delete for personal rows on user remove-action.
6. Counts are computed dynamically until proven slow (§10 in audit resolved as dynamic).

---

## 3. MongoDB collection list

| # | Collection | Purpose | Owner |
|---|-----------|---------|-------|
| 1 | `users` | identity, credential pointer, role, semester prefs | self (`_id`) |
| 2 | `semesters` | library root, ordering | admin-managed, global read |
| 3 | `subjects` | course container under semester | admin-managed |
| 4 | `topics` | syllabus grouping under subject | admin-managed |
| 5 | `resources` | study material unit (PDF pointer + metadata) | admin-managed |
| 6 | `books` | admin-managed textbook entity | admin-managed |
| 7 | `notices` | dashboard / notices board | admin-managed |
| 8 | `favorites` | unified user saves (resource OR subject) | user (`userId`) |
| 9 | `bookmarks` | unified user page-marks (resource OR subject) | user (`userId`) |
| 10 | `readingProgress` | resume/continue-reading per user+resource | user (`userId`) |

Explicitly NOT collections (see rationale §§8–9, 12):

- `downloads` — client-only. Current `DownloadItem` is simulated local state (`LibraryProvider.tsx:248`). Backend serves bytes/URLs; device owns completion state.
- `recentViews` — client-only `RecentEntry { resourceId, openedAt }`. Promotion to server deferred (see §21).
- `semesterPreferences` — embedded as `users.semesterPrefs[]`, not a collection (one write per user, tiny array ≤ 8).
- `activityLog` — no collection. Admin audit kept as capped log or app logs in Phase 1+; current `ActivityEntry` is a frontend feed derived from CMS mutations, not a persistence contract.

---

## 4. Detailed collection schemas

Conventions: `_id: ObjectId` (API exposes as `id: string`). All dates ISO `Date`. `deletedAt?: Date` = soft-deleted when set. `createdAt/updatedAt` maintained server-side. Frontend `id` strings like `sem-1` are seed-only; production uses ObjectIds (migration maps them, §18).

### 4.1 `users`

| Field | Type | Req | Default | Notes |
|-------|------|-----|---------|-------|
| `name` | string (trimmed, 1–80) | yes | — | editable display name (maps `MockUser.name`) |
| `email` | string (lowercase, unique) | yes | — | identity (maps `MockUser.email`) |
| `passwordHash` | string | yes | — | argon2/bcrypt hash — algorithm Decision Required (§21). Never returned. |
| `role` | `"USER" \| "ADMIN"` | yes | `"USER"` | maps `MockUser.role` |
| `semesterPrefs` | `{ semesterId: ObjectId→semesters, startDate?: Date, endDate?: Date }[]` | no | `[]` | replaces frontend `SemesterStatusProvider` maps; effective status derived (§7) |
| `createdAt / updatedAt` | Date | auto | — | account timestamps |

No `username/avatar/phone` (NOT FOUND in code — add only on demand). Account deactivation field deferred (Decision Required).

### 4.2 `semesters`

Preserved from `types.Semester`, minus two retired fields (rationale §20).

| Field | Type | Req | Default |
|-------|------|-----|---------|
| `number` | int 1–8 (unique) | yes | — |
| `name` | string 1–80 | yes | — |
| `description` | string ≤2000 | no | `""` |
| `credits` | number ≥0 | no | `0` |
| `order` | int ≥1 (unique) | yes | — |
| `status` | `PublishStatus` | yes | `"draft"` |
| `createdAt / updatedAt / deletedAt?` | Date | auto | — |

Retired: `subjectCount/resourceCount` (dynamic, §9), `enrollment` (seed-only; replaced by derived per-user status, §7).

### 4.3 `subjects`

| Field | Type | Req | Default |
|-------|------|-----|---------|
| `semesterId` | ObjectId→semesters | yes | — |
| `name` | string 1–120 | yes | — |
| `code` | string 1–20 (e.g. `CSC101`) | yes | — |
| `description` | string ≤2000 | no | `""` |
| `category` | `"core" \| "elective" \| "practical"` | yes | — |
| `credits` | number ≥0 | no | `0` |
| `hotTopics` | string[≤50], each 1–120 | no | `[]` |
| `fullMarks` | number >0 | no | — |
| `status` | `PublishStatus` | yes | `"draft"` |
| `createdAt / updatedAt / deletedAt?` | Date | auto | — |

Retired: `offlineSync` (frontend-derived 0..1 sync fraction; MUST NOT be stored — recompute from user's completed downloads vs subject resource count).

### 4.4 `topics`

| Field | Type | Req | Default |
|-------|------|-----|---------|
| `subjectId` | ObjectId→subjects | yes | — |
| `title` | string 1–150 | yes | — |
| `description` | string ≤2000 | no | — |
| `order` | int ≥1 | yes | — |
| `status` | `PublishStatus` | yes | `"draft"` |
| `createdAt / updatedAt / deletedAt?` | Date | auto | — |

Retired: `published: boolean` (redundant; migration `published → status`, precedent `cmsStore.ts:90-95`).

### 4.5 `resources` (core)

| Field | Type | Req | Default |
|-------|------|-----|---------|
| `semesterId` | ObjectId→semesters | yes | — (denormalized copy of subject's semester for single-filter queries) |
| `subjectId` | ObjectId→subjects | yes | — |
| `topicId` | ObjectId→topics? | no | — (`undefined` = subject-wide, e.g. whole textbook) |
| `title` | string 1–200 | yes | — |
| `description` | string ≤5000 | no | `""` |
| `type` | 12-enum `ResourceType` | yes | — |
| `customType` | string 1–60 | iff `type=="custom"` | — |
| `fileName` | string 1–255, must end `.pdf` (Phase 1) | yes | — |
| `fileSize` | int bytes >0 | yes | — |
| `pageCount` | int ≥1 | yes | — |
| `tags` | string[≤30] normalized lowercase-trim | no | `[]` |
| `bookId` | ObjectId→books? | no | — (single-direction link; §8) |
| `featured` | boolean | no | `false` |
| `paperYear / paperFullMarks / paperDurationMinutes` | int | no | — (past-paper only; validate ranges when present) |
| `status` | `PublishStatus` | yes | `"draft"` |
| `hidden` | boolean | no | `false` |
| `file` | `{ key: string(req), bucket: string(req), mime: string(req), checksum?: string }` | yes | — (B2 pointer, §10) |
| `uploadedBy` | ObjectId→users? | no | — (audit; null for migrated seeds) |
| `uploadedAt / updatedAt / deletedAt?` | Date | auto | — |

Frontend `id/title/description/semesterId/subjectId/topicId/type/customType/fileName/fileSize/pageCount/tags/bookId/featured/paper*/status/hidden/deletedAt` all preserved 1:1 (IDs become ObjectIds).

### 4.6 `books`

| Field | Type | Req | Default |
|-------|------|-----|---------|
| `semesterId / subjectId` | ObjectId refs | yes | — |
| `title` | string 1–200 | yes | — |
| `author` | string ≤150 | no | `""` |
| `description` | string ≤5000 | no | `""` |
| `edition` | string ≤60 | no | `""` |
| `pageCount` | int ≥1 | yes | — |
| `fileSize` | int bytes >0 | yes | — (display only; bytes in B2 via linked resource or own key — Decision Required if books get direct files in Phase 5) |
| `status` | `PublishStatus` | yes | `"draft"` |
| `createdAt / updatedAt / deletedAt?` | Date | auto | — |

Retired: `Book.resourceId` (single-direction decision §8).

### 4.7 `notices`

| Field | Type | Req | Default |
|-------|------|-----|---------|
| `heading` | string 1–150 | yes | — |
| `subtext` | string ≤2000 | no | `""` |
| `type` | 8-enum `NoticeType` | yes | — |
| `announcer` | 4-enum `NoticeAnnouncer` | yes | — |
| `date` | Date (event/deadline day) | yes | — |
| `priority` | `NoticePriority` | yes | `"normal"` |
| `status` | `"draft" \| "published"` | yes | `"draft"` |
| `publishedAt` | Date? | auto on publish | — |
| `showOnDashboard` | boolean | no | `true` |
| `pinned` | boolean | no | `false` |
| `createdAt / updatedAt / deletedAt?` | Date | auto | — |

`dayCount/dayState` stay computed (`noticeWithState`), never stored.

### 4.8 `favorites` (unified)

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| `userId` | ObjectId→users | yes | scope |
| `targetType` | `"resource" \| "subject"` | yes | replaces 2 frontend lists |
| `targetId` | ObjectId (→resources or →subjects) | yes | validated against `targetType` |
| `createdAt` | Date | auto | sort key |

Unique `(userId, targetType, targetId)`. No `updatedAt` (toggle = create/delete).

### 4.9 `bookmarks` (unified)

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| `userId` | ObjectId→users | yes | scope |
| `targetType` | `"resource" \| "subject"` | yes | |
| `targetId` | ObjectId | yes | |
| `page` | int ≥1 | iff resource | subject bookmarks MUST NOT send `page` |
| `note` | string ≤1000 | no | resource-only (`""` default); subject bookmarks ignore |
| `createdAt / updatedAt` | Date | auto | |

Unique `(userId, targetType, targetId)` — preserves current “one bookmark per resource” guard (`LibraryProvider.addBookmark`). Multi-bookmark-per-resource deferred (would drop unique index; Decision Required if requested).

### 4.10 `readingProgress`

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| `userId` | ObjectId→users | yes | scope |
| `resourceId` | ObjectId→resources | yes | |
| `lastPage` | int ≥1 (≤ resource.pageCount enforced API-side) | yes | |
| `progress` | number 0..1 | yes | server recomputes `min(1,lastPage/pageCount)`; client value ignored |
| `updatedAt` | Date | auto | sort key for Continue Reading |

Unique `(userId, resourceId)`. No separate `id` needed beyond `_id`; no `createdAt` (use `updatedAt`).

---

## 5. Relationships

- `semesters 1—N subjects` via `subjects.semesterId` (required, indexed).
- `subjects 1—N topics` via `topics.subjectId` + `order` (required, indexed).
- `subjects 1—N resources` via `resources.subjectId` (required); `topics 1—N resources` via `resources.topicId?` (optional; null = subject-wide).
- `semesters 1—N resources` via denormalized `resources.semesterId` (required; MUST equal subject's semester — enforced on write).
- `books N—1 subject/semester` via `books.subjectId/semesterId`; `resources N—1 books` via `resources.bookId?` (single direction).
- `users 1—N favorites/bookmarks/readingProgress` via `userId`; targets point to resources/subjects (no DB-level cross-collection FK — validated app-side).
- `notices` global (no FK).
- Delete cascades mirror `cmsStore.ts purgeEntity`: delete semester → subjects → topics/resources/books; delete subject → topics/resources/books; delete topic → `$unset resources.topicId`; delete book → `$unset resources.bookId`; delete resource → nothing else (pointer cleanup for B2 object handled in Phase 5).

---

## 6. User ownership model

- Every row in `favorites/bookmarks/readingProgress` carries required `userId`.
- All personal reads/writes scope `{ userId: req.user._id }` server-side. Never trust client-sent `userId`.
- Content collections (`semesters/subjects/topics/resources/books/notices`) are global-read (filtered `status=="published" && !hidden && !deletedAt` for USER role) and admin-write. `resources.uploadedBy` is audit only, not ownership.
- Semester prefs live inside `users.semesterPrefs[]` — one document per user, max ~8 entries; update via `$set` positional or full-array replace with validation.
- Future `recentViews` (if promoted) follows the same `{ userId, resourceId, openedAt }` pattern with TTL/cap (Decision Required).

---

## 7. Semester/status model (audit issue B resolved)

Three concepts, three separate homes — never merged:

| Concept | Home | Values | Meaning |
|---------|------|--------|---------|
| CMS visibility | `semesters/subjects/topics/resources/books.status` | `draft \| published \| hidden(legacy: use hidden flag for resources)` | admin lifecycle. Students see only `published` (+ `!hidden`, `!deletedAt`). |
| Seed default | retired `enrollment` | — | existed only in `SeedSemester` to pre-fill first-run UI. Migration: `passed→passed, active→ongoing, upcoming→upcoming` into initial `users.semesterPrefs` derivation; column NOT created in DB. |
| User progress | derived from `users.semesterPrefs` | `passed \| ongoing \| upcoming` | user-chosen. `ongoing` = exactly one semester per user (API enforces demotion of previous). `startDate/endDate` optional; term % derived via `lib/semesterProgress` logic server- or client-side, never stored. |

`notices.status` stays `"draft" \| "published"` (no `hidden` variant; hide = `showOnDashboard:false` or delete).

---

## 8. Favorite/bookmark model (audit issue C resolved)

**Decision: unified collections with `targetType/targetId`.**

- `favorites { userId, targetType: resource|subject, targetId }`, `bookmarks { userId, targetType, targetId, page?, note? }`.
- Why (grounded in code): UI already sums both levels (`Dashboard quickItems = favorites.length + favoriteSubjects.length`, `Settings/Favorites/Bookmarks` “All” totals); `SubjectHeader` toggles both in one row; separate 4-collection design would quadruple identical CRUD + indexes for no behavioral gain.
- Rules: `targetId` must exist in the collection named by `targetType` (check on write); subject bookmarks reject `page/note` (400); resource bookmarks default `page: 1`.
- Alternative rejected: 4 separate collections (more code, same queries); resource-only backend (would silently drop `favoriteSubjects/bookmarkedSubjects` features that exist in `LibraryProvider` and `SubjectHeader`).

---

## 9. Resource/Book relationship (audit issue D resolved)

**Decision: single-direction `resources.bookId → books._id`. `books.resourceId` is REMOVED.**

- Why: bidirectional fields in `cmsStore.ts:389-403` require dual writes on every link/unlink with no transaction; current UI only traverses book→“open linked resource” via one hop, satisfiable by querying `resources { bookId }`.
- Maintenance: set/unset `resources.bookId` only; deleting a book runs `updateMany({bookId}, {$unset: {bookId}})`; deleting a resource needs no book write.
- Migration: for any seed where `Book.resourceId` existed, invert to `Resource.bookId`.

---

## 10. Semester/Subject counts (audit issue E resolved)

**Decision: dynamic aggregation. No stored `subjectCount/resourceCount`.**

- Why: seeds hardcode them (e.g. Sem 1 `5/18`) and they drift; live UI already computes real numbers via `getStats()/countResourcesBy*`; scale (8 semesters, ~45 subjects, ~68+ resources) makes `$count` trivial.
- Strategy: list endpoints compute via aggregation (`$match {status:published, hidden:false, deletedAt:null} + $count`) or two indexed count queries; add a cached counter only with measured evidence (then use change-stream/increment on resource write — not in Phase 1).
- `Subject.offlineSync` likewise never stored (per-user derived fraction).

---

## 11. File metadata model (B2 pointer)

Per `resources.file` (§4.5):

- `key` (req): B2 object key. Recommended layout (convention, Phase 5 may finalize): `resources/{resourceId}/{fileName}`. Must be unique.
- `bucket` (req): bucket name/ID (allows future multi-bucket split without code change).
- `mime` (req): allowlist `["application/pdf"]` for Phase 1–5 (codebase only accepts `application/pdf,.pdf` in admin modal).
- `checksum` (opt today, req at upload completion in Phase 5): hex sha256; used for integrity + dedupe signal.
- `fileName/fileSize/pageCount`: mirrored at top level for list rendering without unwrapping `file` (matches `ResourceCard` which reads `fileSize/pageCount` directly).
- `uploadedBy/uploadedAt`: audit.

Bytes NEVER enter MongoDB. No `Buffer/base64/GridFS`.

---

## 12. Backblaze B2 responsibility

Holds: object bytes, object key namespace, lifecycle/versioning, server-side encryption, per-object metadata mirror (optional).
Does NOT hold: titles, tags, relations, per-user state, search indexes.
Delivery: API mints short-lived authorized download URLs per request (exact scheme — signed URL vs `b2_get_file_info` + proxy — Decision Required in Phase 5; no public-by-default buckets).
Upload (Phase 5): `admin → API (validate type/size/quota) → B2 upload → checksum + pageCount extraction → MongoDB resource create/update`. Delete/replace MUST remove/replace the B2 object (no orphans; exit criteria already in `docs/agent.md` Phase 5).

---

## 13. Browser/device storage responsibility

| Layer | Holds | Eviction |
|-------|-------|----------|
| `localStorage` | theme (`meronote-theme`), pre-auth prefs, pending display name; post-backend: auth-adjacent flags only, never PDF bytes | user clear / logout |
| `IndexedDB / Cache API / Service Worker` | TEMPORARY cache: app shell, metadata responses, recently rendered PDF pages/assets | evictable any time; Clear Cache MUST NOT touch downloads |
| Device file system / OPFS / explicit download folder | PERMANENT downloads: user-pressed-Download PDFs + `DownloadItem`-equivalent local record `{ resourceId, localHandle, sizeBytes, downloadedAt }` | only explicit user delete (`removeDownload`) |
| Never on device as source of truth | favorites/bookmarks/progress (server after auth), CMS content | local copies are optimistic cache only |

Current keys (`meronote-cms-db-v1`, `meronote.library.*`, `meronote-semester-enrollment`, `meronote-user-name`, `meronote-settings-v1`) are Phase-2 stand-ins; post-migration they become caches, with `cmsStore.ts` the single swap point (as its header comment already states).

---

## 14. Authentication data requirements

- `users.email` (unique, lowercase, validated), `users.passwordHash` (never selected by default; `select: false`), `users.role`, timestamps.
- Password policy floor (enforce API-side, Phase 4): min length 8 (Decision Required if stricter/lockout needed).
- Roles: `USER` (read/search/download/favorite/bookmark/progress + own data) and `ADMIN` (+ upload/edit/delete semesters/subjects/resources/books/notices). Enforcement server-side on every write; frontend role checks are cosmetic.
- Transport: stateless credential (JWT bearer or httpOnly cookie — Decision Required in Phase 4). No sessions table in Phase 1.
- Secrets (`JWT_SECRET`, B2 keys, Atlas URI) via env only; never in frontend, never committed (rule already in `docs/agent.md` §1.10).

---

## 15. Index strategy (purpose per index)

- `users.email` unique — login lookup + dedupe.
- `semesters.number` unique + `semesters.order` unique — stable ordering, admin reorder swaps.
- `subjects{semesterId, status}` — semester library listing (most common query).
- `subjects.code` unique (scoped Decision Required: global vs per-semester; recommend global unique, TU codes are global).
- `topics{subjectId, order}` — ordered syllabus fetch.
- `resources{subjectId, status, hidden}` — subject detail groups.
- `resources{semesterId, status, hidden}` — semester-wide + Resources page filters.
- `resources{topicId}` sparse — topic section fetch.
- `resources{tags}` multikey — tag filter + `getAllTags()` aggregation.
- `resources{status, hidden, updatedAt}` — admin queues + recent lists.
- `resources` text `{title, description, tags}` — metadata search (regex fallback in Phase 1; Atlas Search upgrade later).
- `favorites{userId, targetType, targetId}` unique — toggle idempotency + “is favorite?” check.
- `bookmarks{userId, targetType, targetId}` unique — one-mark-per-target guard.
- `readingProgress{userId, updatedAt desc}` + unique `{userId, resourceId}` — Continue Reading sort + upsert.
- Partial `deletedAt` indexes (`{ deletedAt: 1 } where deletedAt exists`) on content collections — cheap trash queries without polluting live indexes.
- No indexes on `downloads/recent` (no collections), none on derived fields (`dayState`, `progress%`, term %).

---

## 16. Validation rules

- Strings trimmed; `email` regex + lowercase + max 254; `name` 1–80; `title` 1–200; `heading` 1–150.
- Enums enforced: `ResourceType` (12), `PublishStatus` (3), `NoticeType` (8), `NoticePriority` (4), `NoticeAnnouncer` (4), `Subject.category` (3), `role` (2), `targetType` (2).
- Refs: ObjectId format; `targetId` existence check per `targetType`; `resources.semesterId` must equal parent subject’s semester; `topicId`’s subject must equal `subjectId`; `bookId` must exist.
- Numbers: `page ≥ 1`, `0 ≤ progress ≤ 1` (server-recomputed), `fileSize > 0` (upper cap Decision Required), `pageCount ≥ 1`, `credits ≥ 0`, `fullMarks > 0`, `order ≥ 1`, `paperYear 1900–2100`, `paperFullMarks > 0`, `paperDurationMinutes > 0`, `offlineSync` never accepted (derived).
- Arrays: `tags ≤ 30`, each `1–40 chars, lowercase-trim, unique`; `hotTopics ≤ 50`; `semesterPrefs ≤ 8`, `semesterId` unique within array, single `ongoing` invariant.
- Conditionals: `customType` required iff `type == "custom"`, forbidden otherwise; `page/note` allowed only for resource bookmarks; `publishedAt` set automatically on publish, never client-set; `deletedAt` server-set only.
- File: `fileName` ends `.pdf`; `mime == application/pdf`; `key` non-empty, no `..` segments.

---

## 17. Soft-delete strategy

- `deletedAt?: Date` on `semesters/subjects/topics/resources/books/notices`. All student reads add `deletedAt: null` (or `{$eq: null}`); admin Trash reads `deletedAt: {$ne: null}`.
- Operations: `softDelete` (set `deletedAt=now`), `restore` (unset), `purge` (hard delete + cascades §5), `emptyTrash` (purge all soft-deleted of a type). Setting `draftTrash.moveDeletedToTrash` stays a frontend pref until admin API mirrors it (Phase 4+).
- Personal collections: no soft delete — `DELETE` hard-removes (favorites/bookmarks/progress rows are user-owned toggles, trash would confuse “is favorite?” checks).
- B2 interplay (Phase 5): soft-delete keeps the B2 object; purge deletes it. Never orphan on replace.

---

## 18. API architecture outline (future phases only — no code)

- `auth`: `POST /api/auth/register|login|logout|refresh`, `GET /api/auth/me`. (Phase 4.)
- `users`: `GET/PATCH /api/users/me` (name, semesterPrefs). Admin: `GET /api/users` (paginated, Decision Required on fields).
- `semesters`: `GET /api/semesters[?status]`, `GET /api/semesters/:id`, admin `POST/PATCH/DELETE /api/semesters/:id`, `PATCH .../status`, `POST .../restore`, reorder endpoint.
- `subjects`: `GET /api/subjects?semesterId=`, CRUD + status/restore (same pattern).
- `topics`: `GET /api/topics?subjectId=`, CRUD + reorder + status/restore.
- `resources`: `GET /api/resources?semesterId&subjectId&topicId&type&tag&q&sort&page&limit`, `GET /api/resources/:id`, admin CRUD + `PATCH /status|hidden|featured`, `GET /api/tags`.
- `books`: `GET /api/books?subjectId&semesterId`, admin CRUD.
- `notices`: `GET /api/notices[?dashboard=true]`, admin CRUD + pin/publish.
- `favorites`: `GET /api/favorites`, `PUT /api/favorites/{resource|subject}/:id` (toggle), `DELETE` same.
- `bookmarks`: `GET /api/bookmarks`, `POST/PUT /api/bookmarks`, `DELETE /api/bookmarks/:id`.
- `readingProgress`: `GET /api/progress[?resourceId]`, `PUT /api/progress/:resourceId { lastPage }` (debounced client-side per `docs/agent.md` Phase 7).
- `files/uploads` (Phase 5): `POST /api/uploads/sign { fileName,fileSize,mime } → { key, uploadUrl }`, `POST /api/uploads/complete { key, checksum, pageCount }`, `DELETE /api/files/:resourceId`.
- `admin`: `GET /api/admin/stats`, `GET /api/admin/activity`, trash/draft queues reuse entity routes with `?state=draft|trashed`.
- Conventions: `{ data, pagination? }` success envelope (Decision Required on exact shape — current frontend expects raw arrays from selectors, so adapters live in `data/selectors.ts` swap); errors via existing `error.middleware` shape `{ status:"error", message }`.

---

## 19. Existing mock-data mapping

| Current | Production home | Transform |
|---------|----------------|-----------|
| `semesters: SeedSemester[8]` | `semesters` | map `id→new ObjectId` (keep `number`); drop `enrollment/subjectCount/resourceCount`; add `order 1..8, status: published` |
| `subjects: SeedSubject[~45]` | `subjects` | resolve `semesterId` via number map; drop `offlineSync` (+ `status/createdAt/updatedAt` fresh) |
| `topics[22]` | `topics` | `published → status`; keep `order` |
| `resourceSeeds[68] → resources` | `resources` | `semesterId` re-derived + asserted; `fileName` kept; `file.{key,bucket,mime}` backfilled at B2 import (no fake URLs); `status: published, hidden: false, featured: false`; `uploadedBy: null` |
| `books: []` | `books` | empty seed stands; no `resourceId` column |
| `notices[3]` | `notices` | keep heading/subtext/type/announcer/date/priority/pinned/showOnDashboard; regenerate `publishedAt/createdAt` |
| `mockUser` | `users` (seed admin, dev-only) | `passwordHash` dev-only; never ship to prod |
| `programInfo` | config, NOT a collection | stays frontend constant (or future `settings` doc — Decision Required) |
| `seedFavorites/seedBookmarks/seedProgress` | `favorites/bookmarks/readingProgress` under seed user | attach `userId` of dev user; `targetType: resource` |
| `seedDownloads/seedRecent` | client-only | NOT migrated to DB |
| `activity[5]` | not migrated | regenerated by real mutations |

---

## 20. Migration considerations

- Production schema vs seed script vs current mock vs local user data are four distinct things. Phase 1 ships schema + empty DB + optional `npm run seed:dev` (imports §19 transforms, dev only). Never auto-insert mocks in production.
- ID cutover: frontend hardcoded IDs (`sem-1`, `res-dsa-book`) die at migration; `data/selectors.ts` becomes the API-adapter boundary (already the single query layer — keep it).
- `file.key` backfill requires real B2 upload pass (Phase 5); until then seeded resources carry `file.key: "pending-migration/{oldId}.pdf"` + `status: draft` OR are excluded from prod seed (recommend: exclude until bytes exist — Decision Required at seed time).
- `users.semesterPrefs` initial fill derives from old `enrollment` map once per user; legacy localStorage keys are then caches, cleared on logout/version bump.
- Precedent migrations from `cmsStore.ts:192-219` (`other→custom`, `hidden-status→hidden flag`, notice FK strip) are already applied in seed transforms — do not re-implement.

---

## 21. Decisions made

1. 10 collections; `downloads/recentViews` client-only; prefs embedded; no `activityLog` collection.
2. Unified `favorites/bookmarks` with `targetType` (per approved answer).
3. Dynamic counts; `offlineSync` derived, never stored.
4. Single-direction `Resource.bookId`; `Book.resourceId` removed.
5. `published` boolean removed (status only); `enrollment` retired (derived per-user status).
6. B2 pointer `{ key, bucket, mime, checksum? }` on resource; bytes never in Mongo.
7. Personal rows always `userId`-scoped with named unique indexes.

---

## 22. Remaining questions (Decision Required — not invented)

1. ODM: Mongoose vs native driver (recommend Mongoose for validation/index co-location; needs approval before Phase 1).
2. Password hash: argon2id vs bcrypt + cost factor.
3. Session transport: httpOnly cookie vs Bearer JWT (+ refresh strategy).
4. B2 delivery: private bucket + per-request signed URLs vs proxied download endpoint; bucket layout confirmation.
5. Max PDF size / quota (suggest 500 MB default cap pending real largest-file measurement).
6. `recentViews` server persistence: yes/no + retention (suggest stay client-only for Phase 1).
7. User deactivation: `status: active|suspended` field vs hard delete.
8. Search: regex + text index for Phase 1 vs Atlas Search from day one.
9. `subjects.code` uniqueness scope: global vs per-semester.
10. Success envelope shape `{ data, pagination }` vs raw arrays (affects `selectors.ts` adapter).
11. Prod seed: exclude resourceless `file.key` rows vs `draft`-pending import.
12. `programInfo` → future `settings` collection or permanent frontend constant.

---

## 23. Recommended Phase 1 implementation boundary (STOP after Phase 0)

Phase 1 implements ONLY, in order:

1. ODM choice ratified + connection scaffolding (`MONGODB_URI`, health-gated startup, no endpoints yet).
2. Schemas + indexes + validators for the 10 collections exactly as §§4/15/16 (no auth logic, no B2 calls).
3. `npm run seed:dev` importing §19 transforms against a local/Atlas dev cluster.
4. Read-parity check: `GET semesters/subjects/resources` aggregation verified against mock counts via throwaway script (script deleted or kept under `scripts/`, no frontend wiring).
5. Typecheck + build green.

Explicitly OUT of Phase 1: JWT/sessions, CRUD endpoints, upload/B2 integration, frontend migration, localStorage clearing, new dependencies beyond the ratified ODM + validator.
