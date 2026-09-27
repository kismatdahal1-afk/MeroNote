# Mero Note — Admin CMS Backend (Phase 11)

> Status: ADMIN-ONLY CONTENT MANAGEMENT. Public reads unchanged; student
> frontend untouched (integration is Phase 12).
> Scope: `src/services/admin/`, `src/controllers/admin/`,
> `src/routes/admin/`, `src/middleware/upload.middleware.ts`,
> `scripts/verify-admin-cms.ts`. Plus one approved schema change (§7).

## 1. Authorization

Every `/api/admin/*` route runs `requireAuth + requireAdmin` once at the
router mount. Anonymous → 401, USER → 403 (proven over HTTP). Roles come
from the database per request, never from client claims. No new auth
mechanism; `promote-admin` remains the only path to ADMIN.

## 2. Endpoints

Per entity (semesters, subjects, topics, resources, books, notices):

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/admin/<entity>` | validate → 201; duplicates → 409 |
| GET | `/api/admin/<entity>` | `?status=&hidden=&includeDeleted=false&semesterId/subjectId/topicId&tag/type&page&limit`, allowlisted only |
| GET | `/api/admin/<entity>/:id` | sees soft-deleted rows too; 404 when absent |
| PATCH | `/api/admin/<entity>/:id` | explicit field allowlist; empty → 400; `runValidators` on |
| DELETE | `/api/admin/<entity>/:id` | soft delete; 409 + child counts when live children exist; idempotent |
| POST | `/api/admin/<entity>/:id/restore` | 400 unless soft-deleted |

Files (resources only):

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/admin/resources/:id/file` | multer single `file` → byte validation → deterministic `resources/{id}/{safe}.pdf` → put-then-persist with B2 cleanup → 200 safe metadata; no creds → 503 |
| DELETE | `/api/admin/resources/:id/file` | removes B2 object (missing tolerated), clears file metadata, forces `draft`; none attached → 410 |

Envelope `{status,data(,pagination)}` throughout; `400/401/403/404/409/410/503` per contract; `11000` → 409, Mongoose `ValidationError` → 400, never raw internals.

## 3. Validation and integrity

- All writes built from per-field readers (`services/admin/fields.ts`):
  trimmed strings with lengths, enums, ints/ranges, strict booleans,
  ISO dates, capped string arrays. Unknown body fields ignored; MongoDB
  operators can never reach a query (verified with `$gt`/`$set` payloads).
- Hierarchy enforced server-side (`services/admin/relations.ts`):
  subject→semester, topic→subject, resource semester/subject/topic/book
  consistency (moves revalidated). `subject.semesterId`,
  `topic.subjectId`, `semester.number` are immutable (denormalized copies
  elsewhere depend on them); book moves allowed (nothing denormalizes books).
- `customType` iff `custom` enforced manually (model hook is save-only);
  notice `publishedAt` stamped on first publish (hook is save-only).
- Immutable: `_id`, `createdAt`, `deletedAt` (via updates), `role`,
  `passwordHash`, `publishedAt`, `file`/`fileSize`/`checksum` (server-set
  only; rejected with a pointer to the file endpoint).
- Book delete unlinks (`unlinkBookResources`) — resources survive. Parent
  deletes with live children fail closed with counts; nothing cascades.

## 4. File flow and consistency

Validate → B2 put → MongoDB persist → return metadata; persist failure
triggers B2 cleanup (`uploadResourceFile`); replacement deletes the old
object only after new metadata wins; B2 failure leaves MongoDB untouched.
Bytes validated by existing Phase 5 rules (magic/MIME/ext/size); multer's
own filter is only a first gate. `pageCount` stays admin-supplied
(no server PDF parsing exists). Bucket stays private; no keys/URLs leak.

## 5. Publication model

Existing `status` (`draft/published/hidden`) + `hidden` + `deletedAt`
flags only; per-user progress untouched. Fileless resources are creatable
as drafts; deleting a file forces `draft` so fileless rows can never go
public (file access 410s). Public list/detail/search/file endpoints filter
exactly as before — verified by regression.

## 6. Environment

`B2_*` + `MAX_PDF_BYTES` (unchanged from Phase 5). Missing creds: metadata
CRUD unaffected; file ops 503 with setup guidance, nothing fabricated.

## 7. Approved schema change (sole §5 exception)

`Resource.file/fileName/fileSize/pageCount` optional (`min`/MIME rules
kept when present); required Phase 7 call sites updated (`bookmarks`,
`progress` now 400 "no readable file" on fileless resources). Nothing else
changed; no new collections.

## 8. Verification

`npm run verify:admin-cms`: 40 checks over real HTTP + ephemeral DB
(auth matrix, per-entity CRUD/restore/409s/validation, hierarchy,
unlinking, publish flow + public visibility, file auth/validation/503s,
injection, regressions; live B2 tier gated like Phase 5). Full battery
re-run green; Atlas proven empty read-only afterward.
