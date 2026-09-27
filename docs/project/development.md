# Development

## Purpose

How to run, verify, and extend MeroNote.

## Repositories

- `client/` — React 18 + Vite 6 + TypeScript + Tailwind v4 + pdfjs-dist.
  Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`,
  `typecheck`, `verify:pdf`, `verify:downloads`, `verify:cache`.
- `server/` — Express 4 + TypeScript + Mongoose + B2 SDK. Scripts:
  `dev` (`tsx watch`), `build`, `start`, `typecheck`, `seed:dev`,
  `ensure:fixed-semesters`, `promote-admin`, `verify:*` (19 scripts).

## Local setup

1. `server/.env`: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`
   (`http://localhost:5173`), B2 vars for storage ops. No
   `server/.env.example` exists — copy variable names from
   `server/src/config/env.ts`.
2. `client` consumes `VITE_API_URL` (default `http://localhost:5000`)
   and `VITE_INSTAGRAM_URL` (landing footer).
3. Seed dev data: `npm run seed:dev` (refuses production). Fixed
   semesters: `npm run ensure:fixed-semesters`.
4. Make an admin: `npm run promote-admin -- user@email` (refuses
   production; user must already be registered).

## Verification map

| Area | Command |
|---|---|
| Types (both sides) | `typecheck` in each package |
| PDF contract | client `verify:pdf` |
| Downloads | client `verify:downloads` (vitest) |
| Cache policy mirror | client `verify:cache` (vitest) |
| Auth / CSRF / F1 / refresh | server `verify:auth`, `verify:csrf`, `verify:f1`, `verify:refresh` |
| Content / parity / DB | server `verify:content`, `verify:parity`, `verify:db` |
| Personal study / hydration / plans | server `verify:personal-study`, `verify:hydration`, `verify:semester-plan`, `verify:continue-reading`, `verify:phase19`, `verify:download-history` |
| Search / files / uploads / B2 | server `verify:search`, `verify:resource-file`, `verify:upload-timing`, `verify:b2` |
| Admin CMS | server `verify:admin-cms` |

Client vitest suites live in `client/src/lib/__tests__/`.

## Conventions

- API envelope `{ status, data(, pagination) }`; errors
  `{ status: "error", message }`, no internals outside development.
- Pagination: `page ≥ 1`, `1 ≤ limit ≤ 100`, default `20`.
- IDs are Mongo ObjectIds exposed as `id` strings client-side.
- `requireAuth` before `requireCsrf` on `/api/me` (dead sessions 401
  first); CSRF failures are 403, never 401.
- Write `verify:*` coverage for new backend behavior where a script
  family already exists.

## Change rules

- Follow `agent.md` (scope, validation, git, docs rules).
- Stable systems (auth F1–F4, B2, reader, hierarchy, ownership model)
  must not be redesigned without a specific requirement.
