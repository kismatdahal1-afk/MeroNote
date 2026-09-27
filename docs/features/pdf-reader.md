# PDF Reader

## Purpose

Secure PDF.js reading pipeline: presigned access → progressive canvas
rendering → progress/download integration. STABLE.

## Current implementation

```text
Resource → Resource.file metadata (MongoDB) → B2 key
→ GET /api/resources/:id/file → presigned URL (15 min)
→ PDF.js → canvas (ReaderShell → PdfViewer → PdfCanvas)
```

- URL fetch (`lib/resourceFileApi.ts`, `credentials: include`): network
  failure, 404 (unavailable incl. missing B2 object), 410 (no file),
  503 (storage down) map to friendly messages; missing `data.url`
  errors. Binary never stored.
- `ReaderShell`: source resolution in priority order — (1) permanent
  IndexedDB blob (“Saved on device”), (2) valid temp cache (“Cached
  copy”), (3) network ≤ 15 MB (fetch once, `%PDF-` check, best-effort
  temp-cache write, render from same bytes), (4) larger files stream via
  presigned URL, (5) friendly offline error. Object URLs revoked on
  change/unmount; 15s fetch timeout; abort-safe.
- `PdfViewer`: stepped zoom (`0.6–2.5`, default 100%, mobile reference
  capture), pinch-to-zoom (snaps to nearest step; header/counter never
  scaled), sticky header, breadcrumbs, desktop toolbar vs mobile control
  rows, clamped page input, programmatic-scroll jumps, fullscreen with
  `fullscreenchange` sync, source badge, error card + retry, loading
  shimmer. Falls back to `resource.pageCount` until PDF.js reports.
- `PdfCanvas`: worker bundled locally by Vite
  (`pdfjs-dist/build/pdf.worker.mjs`, no CDN); document loaded per URL
  (`disableRange/Stream/AutoFetch: false`) and destroyed on
  change/unmount; obsolete renders cancelled; stale completions ignored.
- Progressive rendering: viewport-center page first, then a 1-viewport
  forward frontier; rendered pages stay mounted; rest are reserved boxes
  with skeletons; per-page error card + retry. Geometry from
  `containerWidth × zoom` (cap 850px, 12px gaps, DPR ≤ 2, ResizeObserver
  debounced). Zoom re-anchors to the current page top (skipped during
  pinch, resynced from live offset). One-finger touch never blocked
  (native scroll); exactly-two-finger pinch handled with `preventDefault`.
- Progress: 1500ms debounced server persist + flush on unmount; hydrates
  from server only if untouched with no local progress; page changes also
  `markOpened` (recents).
- Download hook: skips if completed/downloading, else streams via
  `downloadManager` through the same secure endpoint.

## Important files

- `client/src/components/reader/` — `ReaderShell.tsx`, `PdfViewer.tsx`,
  `PdfCanvas.tsx`
- `client/src/lib/` — `resourceFileApi.ts`, `pdfErrors.ts`,
  `cachePolicy.ts` (source labels, temp-cache bounds)

## Data / ownership

- Page count from PDF.js is authoritative once reported.
- Progress truth is server (`readingProgress`); local state is the live
  mirror. Temp cache and blobs are device-local (see
  `offline-cache.md`, `downloads.md`).

## Security / constraints

- B2 URLs short-lived, never cached/logged; `%PDF-` validated on every
  byte path; corrupt temp/blob entries deleted on read.
- Error mapping never leaks internals (`pdfErrors.ts`).

## Known limitations

- In-document search box is a placeholder toast.
- Temp caching applies to files ≤ 15 MB; larger files stream (explicit
  download remains the offline path).
- Canvas painting itself is browser-only (covered by build + review;
  `verify:pdf` checks the PDF.js contract in Node).

## Change rules

- Keep the source priority order and the temp-vs-permanent separation.
- Keep touch behavior (never hijack one-finger scroll; scope pinch to
  the PDF container).
