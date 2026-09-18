# Mero Note — Search & Discovery (Phase 10)

> Status: SERVER-BACKED UNIFIED SEARCH. MongoDB `$text` per collection,
> merged list, no external engine, no AI, no history, no offline index.
> B2 credentials are not required for any part of Phase 10.

## 1. Endpoint

`GET /api/search` (public read-only, no writes exist).

| Param | Required | Rules |
|---|---|---|
| `q` | yes | trim + collapse spaces, 1–100 chars, else 400 |
| `page` / `limit` | no | Phase 4 conventions: defaults 1 / 20, `1 ≤ limit ≤ 100`, else 400 |
| `entityType` | no | `semester\|subject\|topic\|resource\|book\|notice`, else 400 |
| `type` | no | existing 12-value resource enum, else 400 |
| `tag` | no | non-empty, lowercased before match, else 400 |
| `semesterId` / `subjectId` | no | valid ObjectId, else 400; applied only where the schema has the field |

Unknown params are ignored (never reach MongoDB).

## 2. Matching

- resource/subject/topic/book/notice: `$text` against one compound text
  index each (resources reuses its Phase 1 index; subjects add
  name/code/description/hotTopics; topics title/description; books
  title/author/description; notices heading/subtext).
- semester (8 docs, no text index): exact `number` match for numeric
  queries plus escaped case-insensitive `name`/`description` substring.
  No raw user regex anywhere.
- Empty/blank/oversized `q` → 400 (never a full-database scan).

## 3. Result contract

`{status:"ok", data:[{entityType,id,title,description,metadata}], pagination:{page,limit,total,pages}}`.
`metadata` carries display/relationship fields only (names, codes, type,
tags, counts) — never `passwordHash`, B2 keys, or personal data. Internal
text scores are stripped before responding. Ordering is deterministic
(score desc, `_id` asc) — a stable order, not an AI relevance claim.

## 4. Bounded fan-out

Each entity is queried with `limit = min(page*limit, 200)` plus an exact
`countDocuments`; merged in Node, window-sliced, `total` = sum of counts.
No unbounded scans, no full-collection loads. Relationship enrichment is
batched (`$in` per entity kind, no N+1).

## 5. Visibility

Every per-entity query merges `liveFilter()`/`liveResourceFilter()`
(published-only notices): drafts, hidden resources, and soft-deleted rows
can never match. Users/personal data are never queried.

## 6. Frontend (`/search`)

`lib/searchApi.ts` (typed client, abortable, offline-aware errors) +
`pages/Search.tsx` (`?q=` deep-link via existing `useSearchQuery`,
300 ms debounce, stale-request guard, idle/loading/ready/error states,
grouped display reusing `Card`/`EmptyState`/skeletons, load-more
pagination). Destinations reuse existing routes (topic/book → parent
subject; notice → notices list). Header (student) and dashboard searches
now target `/search?q=`; admin search untouched. In-document PDF search
box stays mock (out of scope).

## 7. Offline

No offline index: offline searches fail gracefully
("Search is unavailable offline."). Cached academic pages (Phase 9) and
permanent downloads (Phase 8) keep working independently.

## 8. Verification

`npm run verify:search` (server, 23 checks, ephemeral DB): envelope,
400 matrix, per-entity hits, all filters, visibility exclusions,
leak-freedom, operator-injection rejection, shape/totals/ordering,
live index presence. Client `search.test.ts` (4 tests): URL building,
abort passthrough, error mapping. Full battery re-run green; Atlas
proven empty read-only afterward.
