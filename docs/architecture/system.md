# System Architecture

## Purpose

Top-level view of MeroNote: what runs where, how data flows, and who
owns each piece of state.

## Current implementation

```text
Desktop / mobile browser, PWA, native wrapper (React 18 + Vite PWA)
  → Express + TypeScript API (per-request auth, envelope responses)
    → MongoDB Atlas (all structured metadata, file pointers only)
    → Backblaze B2 private bucket (PDF bytes, presigned access)
  → PDF.js renders from short-lived B2 URLs (never stored binaries)
  → Device: temp cache (evictable) vs permanent downloads (user-owned)
```

- Frontend: `client/src` — public landing (`/`), student portal
  (`/dashboard`, `/semesters`, `/subjects/:id`, `/resources`,
  `/reader/:id`, `/favorites`, `/bookmarks`, `/downloads`, `/notices`,
  `/settings`, `/search`, `/help`), admin portal (`/admin/*`).
  Rendered inside `AppLayout` except the landing page.
- Backend: `server/src` — routes, controllers, services, repositories,
  auth, storage, middleware. Stateless per request; identity from the
  session cookie + DB role lookup.
- Routing: public `/` (landing index), `/login`, `/register`; pathless
  `RequireAuth > AppLayout` branch so the landing is never outranked;
  `RequireAdmin` wraps `/admin/*`. See `../features/landing-page.md` and
  `../operations/deployment.md`.

## Data / ownership

| Data | Source of truth | Notes |
|---|---|---|
| Account identity, roles | MongoDB `users` | via `GET /api/auth/me`; never localStorage |
| Academic content | MongoDB (admin-managed) | global read, filtered `status/published + !hidden + deletedAt:null` |
| Personal study state | MongoDB (`/api/me/*`) | userId-scoped; local mirrors are optimistic caches |
| Download history | MongoDB `download_history` | account-level record, no bytes |
| PDF bytes | Backblaze B2 (private) | per-request presigned URLs (15 min) |
| Downloaded PDF blobs | Device IndexedDB `meronote-downloads` | user-owned, survives logout, not on new devices |
| Temp PDFs / HTTP cache | Device IndexedDB `meronote-temp-cache` + Cache API | disposable, evictable |
| Theme, device mirrors | Device localStorage | intentionally device-local |

Full matrices: `database.md`, `../features/personalization.md`,
`../features/offline-cache.md`, `../features/downloads.md`.

## Security / constraints

- Auth F1–F4 (session epoch, generation guards, CSRF, refresh rotation).
  See `authentication.md`.
- All personal endpoints derive `userId` from `req.user`; ADMIN has no
  cross-user access.
- B2 credentials server-side only; presigned URLs never logged/cached.
- Rate limits: login/register/refresh each isolated at 20/min.
- CORS fixed origin + credentials; helmet; error masking in production.

## Important behavior

- PWA/native entry goes to `/dashboard`; browser guests always see the
  landing; authed users go to role home. See `../features/landing-page.md`.
- Offline: downloads > temp cache > network; search/sync need connectivity.
- Soft delete + restore for admin content; hard delete for personal rows.

## Known limitations

- In-memory rate limiter (single instance).
- `server/.env.example` is referenced but absent — use
  `server/src/config/env.ts` for variable names.
- SW cache version drift (`sw.js` v2 vs `cachePolicy.ts` v1) — see
  `../operations/known-issues.md`.

## Change rules

- Keep the storage-ownership split (Mongo metadata / B2 bytes / device
  blobs). Do not store PDF binaries in MongoDB.
- Do not merge the three status concepts (CMS visibility, user plan
  status, download state).
- Update the relevant feature doc when changing a subsystem.
