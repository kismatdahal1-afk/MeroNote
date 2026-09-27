# MeroNote Documentation

Current-state documentation for the MeroNote codebase. The code is the
source of truth; these docs describe what is actually implemented.

## Areas

| Area | Contents |
|---|---|
| `project/` | Agent rules, product overview, development workflows. Start here for how to work on the repo. |
| `architecture/` | System overview, backend, database, authentication (F1–F4), file storage. Authoritative for cross-cutting design. |
| `features/` | Per-feature behavior: PDF reader, offline/cache, downloads, personalization, search, admin portal, landing page. |
| `operations/` | Deployment, environment, known issues. |
| `archive/` | Superseded phase documents. Historical reference only — never authoritative. |

## Authoritative documents

- System design: `architecture/system.md`
- Backend API + conventions: `architecture/backend.md`
- Data + ownership: `architecture/database.md`
- Security (F1–F4, CSRF, refresh): `architecture/authentication.md`
- File storage (B2): `architecture/storage.md`
- Working rules: `project/agent.md`

## Feature details

- `features/pdf-reader.md` — PDF.js rendering pipeline
- `features/offline-cache.md` — Service Worker, Cache API, temp PDF cache
- `features/downloads.md` — permanent user downloads + download history
- `features/personalization.md` — favorites, bookmarks, progress, plans, recents
- `features/search-discovery.md` — unified search endpoint + UI
- `features/admin-portal.md` — admin CMS (server + portal UI)
- `features/landing-page.md` — public `/` route (current, post-`da4e0d3`)

## Operations

- `operations/deployment.md` — hosting, env vars, seeds, verify scripts
- `operations/known-issues.md` — verified issues and limitations only

## Change rules

- Update docs when architecture changes; keep code and docs consistent.
- Never document planned features as implemented.
- Phase history lives in Git history and `archive/` — not in active docs.
