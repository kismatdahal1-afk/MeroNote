# Deployment

## Purpose

Hosting, environment, boot, seeds, and verification commands.

## Current implementation

### Client (Vercel)

- `client/vercel.json`: single SPA rewrite `/(.*) → /index.html`.
- `client/vite.config.ts`: minimal `react() + tailwindcss()` (no base,
  no proxy).
- PWA: `public/manifest.webmanifest` (`start_url: /dashboard`,
  `display: standalone`, black theme/background, 192/512/maskable
  icons); `index.html` wires manifest, icons, `theme-color`, mobile-web-app
  capabilities. Service Worker registered production-only
  (`main.tsx`: `import.meta.env.PROD && "serviceWorker" in navigator`,
  on window `load`, failures swallowed).
- Env consumed: `VITE_API_URL` (default `http://localhost:5000`),
  `VITE_INSTAGRAM_URL` (landing footer fallback).

### Server (Node ≥ 20 < 28)

- `dev`: `tsx watch src/server.ts`; `build`: `tsc`; `start`:
  `node dist/server.js`.
- Boot (`server.ts`): `connectDb()` first (fatal without
  `MONGODB_URI` / unreachable DB), then `listen(env.port)`;
  SIGINT/SIGTERM graceful close + 10s force-exit. `/api/health` stays
  DB-independent.
- `config/env.ts` defaults: `PORT 5000`, `NODE_ENV development`,
  `CLIENT_URL http://localhost:5173`, `MONGODB_URI ""`,
  `JWT_SECRET ""`, `JWT_EXPIRES_DAYS 7`, `B2_REGION us-east-005`,
  `B2_ENDPOINT ""`, `B2_KEY_ID / B2_APPLICATION_KEY / B2_BUCKET_NAME ""`,
  `MAX_PDF_BYTES` 100 MB. No `server/.env.example` exists — use
  `config/env.ts` as the variable reference. Never commit `.env`.
- CORS fixed origin + credentials; helmet (no CSP — JSON API);
  `x-powered-by` disabled; 404 + masked-error middleware.
- Seeds: `seed:dev` (dev users, 8 semesters, subjects/topics/resources
  with `pending-migration/*.pdf` placeholder keys, notices, personal
  rows; refuses production), `ensure:fixed-semesters` (upserts semesters
  1–8 as published). Admin: `promote-admin -- email` (dev-only, user
  must already exist).
- No `render.yaml` / `Dockerfile` / server-side Vercel config in repo;
  production hosting is external to this tree.

### Verify scripts

- Client: `typecheck`, `verify:pdf`, `verify:downloads` (vitest),
  `verify:cache` (vitest); suites in `src/lib/__tests__/`.
- Server `verify:*`: `auth`, `csrf`, `f1`, `refresh`, `content`,
  `parity`, `db`, `personal-study`, `semester-plan`, `hydration`,
  `continue-reading`, `phase19`, `download-history`, `search`,
  `resource-file`, `upload-timing`, `b2`, `admin-cms`, `fixed-semesters`,
  plus `smoke-phase14`.

## Important files

- `client/{vercel.json,vite.config.ts,package.json}`,
  `client/public/{manifest.webmanifest,sw.js,icon/*}`,
  `client/src/main.tsx`
- `server/{package.json}`, `server/src/{server,app}.ts`,
  `server/src/config/env.ts`, `server/src/db/connection.ts`,
  `server/scripts/*`

## Security / constraints

- Secrets env-only; B2 lazy-validated (never blocks Mongo boot);
  JWT signing refuses without `JWT_SECRET`.
- Production cookies: `SameSite none + secure`; dev: `lax`.

## Known limitations

- No container / infra-as-code in repo; backups and monitoring are
  external concerns (Atlas + host dashboards).

## Change rules

- Keep the SPA rewrite and `/dashboard` PWA entry.
- Keep production-only SW registration (dev must skip it).
- Add `verify:*` coverage alongside new backend behavior.
