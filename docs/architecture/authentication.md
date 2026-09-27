# Authentication (F1–F4)

## Purpose

Current auth architecture: short-lived access JWT, rotating opaque
refresh tokens, session epoch invalidation, double-submit CSRF, and
client race hardening. This replaces the old JWT-only design — do not
use old docs describing it.

## Current implementation

### F1 — server-side logout invalidation (`users.sessionVersion` / JWT `v`)

- Access claims `{ sub, role, v }` (`auth/tokens.ts`); `v` stamped from
  `users.sessionVersion` at issuance (register, login, refresh).
- `requireAuth` re-reads the user + role from DB per request and rejects
  when `claims.v !== users.sessionVersion` (generic 401).
- Pre-`v` tokens behave as `v = 0` (migration default).
- Logout with a verifiable access token bumps the epoch
  (`$inc: { sessionVersion: 1 }`); failure returns 500 without clearing
  cookies (fail-closed).
- Refresh records pin the epoch at issuance; rotation fails (and revokes
  the family) on epoch mismatch.

### F2 — state and race hardening

- 401 semantics: `requireAuth` failures → generic `401 Authentication
  required`; login failures → generic `401 Invalid email or password`
  (no enumeration); refresh reuse/unknown/expired → generic 401.
  `requireAdmin`: 401 no-user, 403 non-admin. CSRF failures are 403 and
  must never trigger 401-invalidation.
- Client generation guards (`lib/authGate.ts`, `UserProvider`): every
  auth transition opens a generation; stale async completions are
  discarded. `invalidateSession()` only acts when authed.
- `useApiQuery`: on 401, one shared single-flight refresh then a single
  retry; second 401 or refresh failure → `invalidateSession()`. Retries
  never refresh again; non-401 statuses untouched.

### F3 — CSRF (double-submit + Origin)

- Readable `meronote_csrf` cookie mirrored in the `x-csrf-token` header
  (256-bit random, `timingSafeEqual` compare); cookie mirrors session
  flags but is session-lifetime.
- Origin defense-in-depth: absent `Origin` passes (non-browser); present
  must exactly equal `CLIENT_URL`.
- `requireCsrf`: `GET/HEAD/OPTIONS` pass; credential-less anonymous
  requests pass (idempotent logout); login/register exempt (no victim
  session); logout, refresh, `PATCH /me`, and all `/api/me` mutations
  enforced. Fresh CSRF issued per login/register plus `GET /api/auth/csrf`
  bootstrap.

### F4 — refresh rotation with reuse detection

- Opaque 32-byte hex refresh token + 16-byte family id; only the SHA-256
  hash is stored (`refresh_tokens`).
- `issueRefreshToken` mints a fresh family per login/register;
  `consumeRefreshToken` atomically claims the winner
  (`findOneAndUpdate` on unused/unrevoked/unexpired hash) — exactly one
  concurrent winner. Miss with a known hash = reuse → whole family
  revoked, generic rejection. Winner mints a same-family child with a
  sliding `lifetimeDays` window and stamps `replacedBy` lineage.
- Logout revokes **all** user families and clears all three cookies;
  anonymous logout just clears and returns `ok`. TTL index on
  `expiresAt` is hygiene only.

## Data / ownership

| Item | Lifetime | Cookie flags |
|---|---|---|
| Access JWT | 15 min | `meronote_session`, HttpOnly, `SameSite none+secure` in prod else `lax` |
| Refresh (default) | 7 days (`JWT_EXPIRES_DAYS`) | `meronote_refresh`, same flags, `maxAge = expiresAt − now` |
| Refresh (remember-me) | 30 days | chosen at login; register has no remember option |
| CSRF | session | `meronote_csrf`, readable (`HttpOnly: false`), otherwise mirrored |

- Endpoints: `GET /csrf` (bootstrap), `POST /register`, `POST /login`,
  `POST /logout` (CSRF-guarded), `POST /refresh` (limiter + CSRF),
  `GET /me`, `PATCH /me` (auth + CSRF).
- Register always creates `USER`; `promote-admin` script (dev-only,
  refuses production) is the only path to ADMIN.
- Passwords: bcrypt cost 12. Rate limits: login/register/refresh each
  isolated at 20/min.

## Important files

- Server: `auth/tokens.ts`, `refresh.ts`, `csrf.ts`,
  `auth.middleware.ts`, `auth.controller.ts`, `rateLimit.ts`,
  `password.ts`, `promote.ts`, `models/refreshToken.model.ts`,
  `models/user.model.ts`, `routes/auth.route.ts`, `routes/me.route.ts`.
- Client: `state/UserProvider.tsx`, `lib/authApi.ts`,
  `lib/authRefresh.ts`, `lib/authGate.ts`, `lib/csrf.ts`,
  `hooks/useApiQuery.ts`.

## Security / constraints

- Never trust frontend role/userId; server re-reads per request.
- Refresh cookie counts as a credential for CSRF purposes.
- Presigned URLs, B2 keys, hashes, and secrets never leave the server or
  enter logs.

## Known limitations

- Rate limiter is in-memory (single instance).
- No migration framework; safe behaviors are JWT `v → 0` default,
  `Notice.publishedAt` backfill, refresh TTL hygiene.

## Change rules

- STABLE — do not redesign F1–F4 without a specific requirement.
- Keep 401 vs 403 semantics (CSRF 403 must not trigger session reset).
- Keep single-flight refresh + retry-once; never recurse refresh through
  the authenticated request wrapper.
