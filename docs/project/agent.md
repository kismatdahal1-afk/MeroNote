# Agent Rules

Short operational rules for working on MeroNote. The system is mature;
most subsystems are stable — preserve them.

## Inspect before modifying

- Read the actual implementation before changing anything: affected
  files, existing types, relationships, conventions, dependencies.
- Never modify blindly. Never assume an old doc statement is current —
  verify against code.

## Preserve stable systems

STABLE — do not redesign without a specific requirement:

- Authentication security (F1–F4): session epoch, CSRF, refresh rotation.
  See `../architecture/authentication.md`.
- B2 storage architecture (private bucket, presigned URLs, key strategy).
  See `../architecture/storage.md`.
- PDF reader pipeline. See `../features/pdf-reader.md`.
- Semester/subject/topic/resource hierarchy and visibility flags
  (`status` + `hidden` + `deletedAt`). See `../architecture/database.md`.
- Personalization ownership model (server truth vs local mirror vs
  device-only). See `../features/personalization.md`.
- Landing-page navigation conventions (`lib/site.ts` single source).
  See `../features/landing-page.md`.

## Scope of work

- Implement only the requested task. Do not jump ahead, add unrelated
  features, or clean up unrelated code.
- One task, one scope. Stop at phase/task boundaries and report; wait
  for explicit approval before continuing.

## Backend rules

- Validate every input: body, query, params, files. Never trust
  client-sent `userId`, roles, or permissions — derive identity from
  `req.user` server-side.
- Frontend role checks are UX only, never security.
- Keep the `{ status, data(, pagination) }` envelope and existing status
  codes. Never leak secrets, credentials, stack traces, or internals.
- Soft-delete where the schema uses it; never hard-delete casually.
- Do not weaken validation, auth, CSRF, rate limits, or upload checks.

## Data rules

- MongoDB stores metadata only — never PDF binaries.
- B2 credentials stay server-side, env-only, never logged.
- Distinguish temp cache (disposable) from permanent downloads
  (user-owned). Clearing cache must never remove downloads.

## Code rules

- No new dependencies without need; check existing ones first.
- No secrets in code, logs, or commits. Never commit `.env`.
- No destructive DB operations without explicit approval.
- Controllers stay thin (request/response); reusable logic in services.

## Verification rules

- Run relevant verification: typechecks (`client: typecheck`,
  `server: typecheck`), related `verify:*` scripts, related vitest suites.
- Report tests actually run with results. Do not claim unrun tests.
- Report files changed, failures/warnings, and anything intentionally
  not implemented.

## Git rules

- No commit or push unless explicitly requested by the user.
- Never commit secrets, `.env` files, or build artifacts.

## Docs rules

- Update documentation when architecture changes.
- Describe current state only; never present plans as implemented.
