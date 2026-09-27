# Database

## Purpose

Current MongoDB data model: collections, ownership, indexes, and the
global vs user-scoped vs device-local split.

## Current implementation

14 collections (`server/src/models/index.ts`). ODM: Mongoose 9.
Connection requires `MONGODB_URI` (fatal at boot).

### Global content (admin-managed, global read)

| Collection | Purpose | Key fields | Indexes |
|---|---|---|---|
| `users` | identity/auth root | `name`, `email` (unique, lowercase), `passwordHash` (`select:false`), `role` (`USER`/`ADMIN`), `semesterPrefs[]` (≤8, legacy path), `sessionVersion` (F1 epoch) | `email` unique |
| `semesters` | library root | `number` (unique 1–8), `name`, `description`, `credits`, `order` (unique), `status`, `deletedAt` | `deletedAt` partial |
| `subjects` | course container | `semesterId`, `name`, `code` (global unique), `category`, `credits`, `hotTopics[]` (≤50), `fullMarks`, `status`, `deletedAt` | `{semesterId,status}`, text `(name,code,description,hotTopics)`, `deletedAt` partial |
| `topics` | syllabus group | `subjectId`, `title`, `description`, `order`, `status`, `deletedAt` | `{subjectId,order}`, text `(title,description)`, `deletedAt` partial |
| `resources` | study material unit | `semesterId` (denormalized, must equal subject's), `subjectId`, `topicId?` (absent = subject-wide), `title`, `type` (12-value enum), `customType` iff `custom`, `fileName`/`fileSize`/`pageCount`, `tags[]` (≤30, normalized), `bookId?`, `featured`, paper fields, `status`, `hidden`, `file{key,bucket,mime,checksum}`, `uploadedBy?`, `deletedAt` | `{subjectId,status,hidden}`, `{semesterId,status,hidden}`, `{topicId}` sparse, `{tags}`, `{status,hidden,updatedAt}`, text `(title,description,tags)`, `deletedAt` partial |
| `books` | textbook entity | `semesterId`, `subjectId`, `title`, `author`, `description`, `edition`, `pageCount`, `fileSize`, `status`, `deletedAt` | `{subjectId,status}`, `{semesterId,status}`, text `(title,author,description)`, `deletedAt` partial |
| `notices` | dashboard/board | `heading`, `subtext`, `type` (8), `announcer` (4), `date`, `priority`, `status` (`draft`/`published` only), `publishedAt` (auto on first publish), `showOnDashboard`, `pinned`, `deletedAt` | `{status,showOnDashboard,pinned,date}`, text `(heading,subtext)`, `deletedAt` partial |

### User-scoped (every row carries `userId`; endpoints derive it from `req.user`)

| Collection | Purpose | Key fields | Indexes |
|---|---|---|---|
| `favorites` | unified saves (resource/subject) | `userId`, `targetType`, `targetId` | unique `{userId,targetType,targetId}` |
| `bookmarks` | page marks (+note) | `userId`, `targetType`, `targetId`, `page` (resource only), `note` (≤1000) | unique `{userId,targetType,targetId}` |
| `readingProgress` | resume state | `userId`, `resourceId`, `lastPage`, `progress` (server-computed `min(1,lastPage/pageCount)`) | unique `{userId,resourceId}`, `{userId,updatedAt}` |
| `user_semester_plans` | per-user semester plan | `userId`, `semesterId`, `status` (`upcoming`/`ongoing`/`passed`), `startDate?`, `endDate?` (`end>start`) | unique `{userId,semesterId}`, `{userId,status}`, unique-partial `{userId}` where `ongoing` |
| `download_history` | account download record (no bytes) | `userId`, `resourceId`, `status` (`active` only; `removed` reserved), `fileSize?`, `downloadedAt`, `lastVerifiedAt?` | unique `{userId,resourceId}`, `{userId,downloadedAt}` |
| `user_preferences` | recents + continue-reading | `userId`, `recentResources[]` (cap 20), `continueReading[]` (uncapped, explicit-only) | unique `{userId}` |
| `refresh_tokens` | opaque refresh records (F4) | `userId`, `familyId`, `tokenHash` (SHA-256 only), `sessionVersion` epoch, `lifetimeDays`, `expiresAt`, `usedAt`, `revokedAt`, `replacedBy` | `userId`, `familyId`, `tokenHash` unique, TTL on `expiresAt` |

One text index per collection maximum (Mongo limit): books, notices,
resources, subjects, topics.

### Device-local (never in MongoDB)

- Downloaded PDF blobs: IndexedDB `meronote-downloads`.
- Temp PDFs: IndexedDB `meronote-temp-cache`.
- HTTP cache: Cache API `meronote-static-v*` / `meronote-api-v*`.
- Mirrors/prefs: localStorage (`meronote-theme`, namespaced library
  mirrors). Theme and guest mirrors are intentionally device-local.

## Architecture / flow

- Visibility: student reads filter `status: published` (+ `!hidden` for
  resources, `deletedAt: null`); notices use `showOnDashboard`/`pinned`.
- Soft delete (`deletedAt`) on the 6 content collections; admin trash /
  restore; personal rows hard-delete on remove.
- Relationships: semesters 1—N subjects; subjects 1—N topics/resources;
  topics 1—N resources (optional); resources N—1 books (single direction
  `resources.bookId`; book delete unlinks, parent delete with live
  children fails closed with counts — nothing cascades).
- Deliberately absent (do not re-add): `Book.resourceId`,
  `Subject.offlineSync`, `Topic.published`, `Notice.dayCount/dayState`,
  pruned `UserPreferences` fields, `users` avatars/phones.

## Important files

- `server/src/models/*.model.ts`, `enums.ts`, `index.ts`
- `server/src/repositories/content.ts` (visibility filters, unlink helper)

## Security / constraints

- No PDF binaries in MongoDB — pointers only (`Resource.file`).
- No client-supplied `userId` anywhere; ADMIN sees only their own rows.
- `passwordHash` never selected/returned.

## Known limitations

- `models/index.ts` header comment still says “10 Phase 1 collections”
  (actual: 14).
- Embedded `users.semesterPrefs` coexists with `user_semester_plans`
  (canonical); confirm before removing either.

## Change rules

- New collections need evidence; keep the global/user/device split.
- Keep named unique indexes that enforce idempotency (favorites,
  bookmarks, progress, plans, download history, preferences).
