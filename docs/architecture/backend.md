# Backend Architecture

## Purpose

Current Express + TypeScript API: routing, conventions, middleware,
content/personal/search/admin surfaces.

## Current implementation

- Entry: `server/src/server.ts` — `connectDb()` first (fatal without
  `MONGODB_URI`), then `listen(env.port)`; graceful SIGINT/SIGTERM.
- App: `server/src/app.ts` — `helmet` (no CSP, JSON API),
  `cors({ origin: env.clientUrl, credentials: true })` (fixed origin,
  never `*`), `cookieParser`, `express.json`, `/api` mount, 404 + error
  handlers (5xx masked outside development).
- DB: `server/src/db/connection.ts` — single-flight Mongoose connect,
  10s selection timeout.
- Envelope: `{ status: "ok", data(, pagination) }` /
  `{ status: "error", message }`. Pagination: `page ≥ 1`,
  `1 ≤ limit ≤ 100`, default `20` (`lib/api.ts`).
- IDs: ObjectIds; invalid → 400; unknown `11000` → 409, Mongoose
  `ValidationError` → 400, never raw internals.

## Architecture / flow

```text
client (cookies: session + refresh + CSRF)
  → routes/*.route.ts (mount middleware)
    → auth.middleware (requireAuth → requireAdmin / requireCsrf)
      → controllers/*.controller.ts (request/response only)
        → repositories/*.ts + services/admin/* (business logic)
          → Mongoose models / B2 service
```

Route mounts (`routes/index.ts`): `/auth`, `/me`, `/admin`, `/search`,
`/semesters`, `/subjects`, `/topics`, `/resources`, `/books`,
`/notices`, `/health` (DB-independent).

## Important files

- `server/src/routes/` — `auth.route.ts`, `me.route.ts` (17 endpoints,
  `requireAuth + requireCsrf`), `admin/index.ts`
  (`requireAuth + requireCsrf + requireAdmin`), content + search routes.
- `server/src/controllers/` — `auth`, content (`semesters`, `subjects`,
  `topics`, `resources`, `books`, `notices`, `search`, `resourceFile`),
  personal (`favorites`, `bookmarks`, `progress`, `downloads`,
  `semesterPlan`, `preferences`), `admin/*`.
- `server/src/auth/` — `tokens.ts`, `refresh.ts`, `csrf.ts`,
  `auth.middleware.ts`, `auth.controller.ts`, `rateLimit.ts`,
  `password.ts` (bcrypt cost 12), `promote.ts` (dev-only admin promotion).
- `server/src/middleware/` — error handler, `upload.middleware.ts`
  (memory storage, 1 file, `MAX_PDF_BYTES` cap).
- `server/src/repositories/` — `content.ts` (`liveFilter` /
  `liveResourceFilter`), `downloads.ts`, `preferences.ts`,
  `semesterPlans.ts`.
- `server/src/services/admin/` — `fields.ts` (allowlisted per-field
  readers), `relations.ts` (hierarchy asserts), `errors.ts` (error map).
- `server/scripts/verify-*.ts` — 19 HTTP + ephemeral-DB suites.

## Content APIs (public reads)

Semesters, subjects, topics, resources, books, notices: list + detail,
filtered to live rows (`status: published`, `!hidden` where applicable,
`deletedAt: null`). File access: `GET /api/resources/:id/file` →
`{ url, expiresIn: 900 }` or 400/404/410/503 (see
`storage.md`). Search: `GET /api/search` (see
`../features/search-discovery.md`).

## Personal APIs (`/api/me`, auth + CSRF)

Favorites, bookmarks, reading progress, semester plan, downloads history,
preferences — all `userId`-scoped from `req.user`. Full table in
`../features/personalization.md`.

## Admin APIs (`/api/admin/*`, auth + CSRF + ADMIN)

Per entity (semesters, subjects, topics, resources, books, notices):
`POST /`, `GET /` (allowlisted filters incl. `includeDeleted`), `GET
/:id` (sees soft-deleted), `PATCH /:id` (field allowlist, empty → 400),
`DELETE /:id` (soft delete; 409 with child counts when live children
exist; idempotent), `POST /:id/restore`. Resources additionally
`POST|DELETE /:id/file` (multer → byte validation → deterministic key →
put-then-persist; delete clears metadata + forces `draft`). Details in
`../features/admin-portal.md`.

## Security / constraints

- Roles re-read from DB per request; frontend role checks are UX only.
- CSRF: `GET/HEAD/OPTIONS` pass; anonymous credential-less requests pass;
  login/register exempt (no victim session); everything else with session
  or refresh cookie requires `x-csrf-token` + exact Origin match.
- Rate limits 20/min each for login/register/refresh (isolated buckets).
- Uploads: memory storage, extension+MIME pre-filter, full byte validation
  in `storage/fileRules.ts`; unknown body fields ignored (no Mongo
  operators can reach queries).

## Known limitations

- Rate limiter is in-memory (single instance).
- `PATCH /api/auth/me` alone uses `asyncHandler`; other auth routes rely
  on inner try/catch (Express 4) — align if touched.
- Upload pre-filter rejects non-PDFs silently (`cb(null, false`) —
  downstream must handle a missing file.

## Change rules

- Keep controllers thin; put reusable logic in services/repositories.
- Preserve envelope, status codes, pagination, and visibility filters.
- Server-managed fields (`_id`, timestamps, `file/*`, `publishedAt`,
  `deletedAt`) are never client-settable.
