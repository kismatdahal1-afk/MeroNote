# Search & Discovery

## Purpose

Server-backed unified search over academic content. No external engine,
no AI, no history, no offline index.

## Current implementation

- Endpoint: `GET /api/search` (public, read-only).
- Params: `q` required (trimmed, collapsed, 1–100 chars, else 400);
  `page`/`limit` (defaults 1/20, `limit ≤ 100`); `entityType`
  (`semester|subject|topic|resource|book|notice`); `type` (12-value
  resource enum); `tag` (non-empty, lowercased); `semesterId`/`subjectId`
  (ObjectId, applied only where the schema has the field). Unknown params
  ignored (never reach MongoDB).
- Matching: one bounded `$text` per collection (resources reuse their
  index; subjects add name/code/description/hotTopics; topics
  title/description; books title/author/description; notices
  heading/subtext). Semesters (8 docs, no text index): numeric exact
  match + escaped case-insensitive substring on name/description. No raw
  user regex. Blank/oversized `q` → 400 (never a full scan).
- Contract: `{ status: "ok", data: [{ entityType, id, title,
  description, metadata }], pagination }`. Metadata carries display /
  relationship fields only — never credentials, B2 keys, or personal
  data. Text scores stripped; ordering deterministic (score desc, `_id`
  asc). Fan-out bounded (`min(page*limit, 200)` per entity + exact
  counts, merged and window-sliced in Node, batched `$in` enrichment).
- Visibility: every entity query merges live filters
  (published-only, `!hidden`, `deletedAt: null`); drafts, hidden
  resources, and soft-deleted rows never match. Users/personal data never
  queried.
- Client (`lib/searchApi.ts`, `pages/Search.tsx`): typed abortable
  client, offline-aware errors; 300ms debounce, `limit: 20`, request-id +
  abort guards, grouped display in fixed order, load-more appends,
  idle/loading/error/empty states. Destinations reuse existing routes
  (topic/book → parent subject; notice → notices list).

## Important files

- `server/src/routes/search.route.ts`,
  `server/src/controllers/search.controller.ts`
- `client/src/lib/searchApi.ts`, `client/src/pages/Search.tsx`

## Data / ownership

- Index-backed reads over global content only. No user data involved.

## Security / constraints

- Operator-injection rejected; unknown params dropped before MongoDB.

## Known limitations

- Cross-collection scores aren't comparable (stable order, not AI
  relevance). Offline search unavailable (fails gracefully;
  cached/downloaded content still works).

## Change rules

- Keep the 400 matrix (bad `q`, filters, pagination) and visibility
  filters on every entity added later.
- Keep per-entity bounds; no unbounded scans.
