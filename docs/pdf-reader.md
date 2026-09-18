# Mero Note — Real PDF Reader (Phase 6)

> Status: SECURE ACCESS + PDF.js RENDERING. No admin CMS, no downloads/offline, no progress persistence, no seeding.
> Flow: Resource → `Resource.file` metadata (MongoDB) → B2 key → `GET /api/resources/:id/file` → presigned URL (15 min) → PDF.js → canvas.

## 1. Access endpoint

`GET /api/resources/:id/file` (public read, Phase 4 convention):

| Case | Response |
|------|----------|
| Invalid id | 400 `{status:"error"}` |
| Missing / draft / hidden / soft-deleted | 404 |
| Live resource, no `file.key` | 410 "no file attached yet" |
| B2 object missing or B2 unconfigured | 503 "temporarily unavailable" (credential-free) |
| Success | 200 `{status:"ok", data:{url, expiresIn:900}}` |

Implementation: `server/src/controllers/resourceFile.controller.ts` (reuses `liveResourceFilter()` + Phase 5 `objectExists`/`getDownloadUrl`; typed storage errors map to 503, anything else propagates). Route mounted in `resources.route.ts`; all other Phase 4 routes untouched. B2 credentials never leave the server; presigned URLs never logged.

## 2. Frontend architecture

- `lib/resourceFileApi.ts` — `fetchResourceFileUrl()` (`credentials:"include"`), maps 404/410/503/0 to friendly messages. Binary never stored.
- `components/reader/PdfCanvas.tsx` — single-page canvas renderer over `pdfjs-dist` v4: document loaded per URL and destroyed on change/unmount; obsolete renders cancelled; stale completions ignored; PDF.js page count reported up and treated as authoritative.
- `PdfViewer.tsx` — existing chrome (nav, stepped zoom, fullscreen, bookmark/download hooks, breadcrumbs) untouched; document area now shows URL-loading shimmer → canvas → or error card with retry. Falls back to `resource.pageCount` metadata until PDF.js reports.
- `ReaderShell.tsx` — fetches the URL per `resourceId` (shared by student + admin views); mock-store metadata and progress/bookmark/download handlers unchanged (persistence is Phase 7+).
- Search box stays mock (search is out of scope).

## 3. PDF.js + worker

`pdfjs-dist@4`; worker via `pdfjs-dist/build/pdf.worker.min.mjs?url` assigned to `GlobalWorkerOptions.workerSrc` — locally bundled by Vite, no CDN, verified emitted in the production build (`dist/assets/pdf.worker.min-*.mjs`).

## 4. States

Requesting URL → loading PDF → rendering → ready; plus: unavailable (404), no file (410), invalid PDF, storage down (503), offline (fetch fail). All friendly, no internals leaked. No infinite spinners (each state has text + retry where actionable).

## 5. Verification

- `npm run verify:resource-file` (server): 9 checks over real HTTP + ephemeral DB (400/404/410/hidden/draft/503-shape/no-leak/route-isolation/health). Live issuance skipped without B2 creds.
- `npm run verify:pdf` (client, plain node): 10 checks — synthetic 3-page PDF loads via real PDF.js (`numPages`, viewport, `destroy`), invalid bytes → `InvalidPDFException`, error-message vectors leak-free. Canvas painting needs a browser; covered by build + review.
- Regression: typechecks/builds both sides, `verify:parity/db/auth/content/b2` all green; Atlas proven empty read-only afterward.
