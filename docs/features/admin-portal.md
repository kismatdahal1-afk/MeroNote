# Admin Portal

## Purpose

Admin-only content management (server API + portal UI). Public reads
unchanged by admin plumbing.

## Current implementation

- Authorization: every `/api/admin/*` route runs `requireAuth +
  requireCsrf + requireAdmin` at the mount. Anonymous → 401, USER → 403.
  Roles re-read from DB per request. `promote-admin` script (dev-only)
  is the only path to ADMIN. Client `RequireAdmin` guards are UX only.
- Per entity (semesters, subjects, topics, resources, books, notices):

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/admin/<entity>` | validate → 201; duplicates → 409 |
| `GET` | `/api/admin/<entity>` | allowlisted filters (`status`, `hidden`, `includeDeleted`, parent ids, `tag`/`type`, `page`/`limit`) |
| `GET` | `/api/admin/<entity>/:id` | sees soft-deleted rows; 404 when absent |
| `PATCH` | `/api/admin/<entity>/:id` | explicit field allowlist; empty → 400; validators on |
| `DELETE` | `/api/admin/<entity>/:id` | soft delete; 409 + child counts when live children exist; idempotent |
| `POST` | `/api/admin/<entity>/:id/restore` | 400 unless soft-deleted |

- Files (resources only): `POST /:id/file` (multer single `file` →
  byte validation → deterministic `resources/{id}/{safe}.pdf` →
  put-then-persist with B2 cleanup → 200 safe metadata; no creds → 503),
  `DELETE /:id/file` (removes object, clears metadata, forces `draft`;
  none attached → 410).
- Entity specifics: semesters fixed 1–8 (create/delete rejected;
  `number`/`order` immutable); subjects (`semesterId` immutable, code
  globally unique); topics (`subjectId` immutable, `order` defaults
  `maxOrder+1`); resources (full parent-hierarchy validation, moves
  revalidated, `null` clears via `$unset`, `customType` iff `custom`,
  server-managed file fields rejected); books (moves allowed with
  revalidation; delete unlinks `Resource.bookId` and reports
  `unlinkedResources`; no direct file upload); notices (first publish
  stamps `publishedAt`; no `hidden` variant).
- Validation (`services/admin/fields.ts`): trimmed strings/lengths,
  enums, ints/ranges, strict booleans, ISO dates, capped arrays. Unknown
  fields ignored; MongoDB operators can never reach queries. Hierarchy
  enforced server-side (`services/admin/relations.ts`); edits on
  soft-deleted rows rejected (restore first).
- Publication: existing `status` + `hidden` + `deletedAt` flags only.
  Fileless resources creatable as drafts; deleting a file forces `draft`
  so fileless rows never go public. Public list/detail/search/file
  endpoints filter exactly as before.
- Portal UI (`client/src/pages/admin/`): Dashboard, Drafts
  (`status: draft, limit: 100` per entity; publish = PATCH published),
  Trash (restore / confirm delete), Resources (incl. upload +
  `pageCount`), Semesters, Notices, Reader (admin view), Settings.
  Client `lib/adminApi.ts` wraps list/get/create/update/delete/restore /
  upload (`FormData` file + pageCount) / delete-file with CSRF and
  `_id → id` normalization.

## Important files

- Server: `routes/admin/index.ts`, `controllers/admin/*.controller.ts`,
  `services/admin/{fields,relations,errors}.ts`,
  `middleware/upload.middleware.ts`
- Client: `lib/adminApi.ts`, `pages/admin/*.tsx`

## Data / ownership

- Content rows are global; `uploadedBy` is provenance only.
- `pageCount` is admin-supplied (no server PDF parsing).

## Security / constraints

- Envelope `{status,data(,pagination)}`; `11000` → 409,
  `ValidationError` → 400; never raw internals.
- B2 creds server-side; no keys/URLs leak; missing creds leave metadata
  CRUD working, file ops 503.

## Known limitations

- No bulk import; no audit log collection; no per-user admin scoping
  (single ADMIN role).

## Change rules

- Keep the mount-level `requireAuth + requireCsrf + requireAdmin`.
- Keep field allowlists and hierarchy asserts on every write path.
- Keep parent-delete fail-closed behavior (counts, no cascades).
