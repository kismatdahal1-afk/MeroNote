# Product Overview

## Purpose

MeroNote is a personal-first CSIT study library for desktop and mobile
(Android/PWA). It organizes books, notes, questions, past papers, and lab
materials by semester and subject, with a focused reader, personal study
state, and offline downloads.

## Who it is for

- **Students (USER):** browse the library, read PDFs, bookmark pages,
  track progress, download for offline study.
- **Admins (ADMIN):** manage all content (semesters, subjects, topics,
  resources, books, notices) plus their own personal study data. No
  cross-user access.

## Content hierarchy

```text
Semester (1–8, fixed)
└── Subject (semesterId, global-unique code)
    ├── Topic (subjectId, ordered)
    └── Resource (subjectId + optional topicId; type from 12-value enum)
        └── optional bookId → Book
```

Notices are global (dashboard + notices board), not part of the hierarchy.

## Student capabilities

- Browse semesters → subjects → topics → resources; filter by type/tag.
- Unified search across semesters, subjects, topics, resources, books,
  notices (`/search`).
- Read PDFs in the PDF.js reader (zoom, page jumps, fullscreen,
  mobile pinch zoom).
- Favorites (resources + subjects), bookmarks (page + note), reading
  progress (auto continue-reading), recent resources, explicit
  continue-reading list.
- Permanent downloads (IndexedDB blobs) + account-level download history;
  temporary cache + Service Worker offline reads.
- Semester plan (one `ongoing` semester), preferences, settings, theme
  (light/dark/system).

## Admin capabilities

- Full CMS for semesters (fixed 1–8, metadata only), subjects, topics,
  resources, books, notices: create, edit, publish/hide, soft-delete,
  restore, trash.
- PDF upload per resource (validated, stored in private B2 bucket).
- Draft and trash queues.

## Study workflow

```text
Choose semester → select subject → explore resources
→ open in reader → bookmark / progress saved
→ download for offline → resume via Continue Reading
```

## Platform targets

- Desktop browser + mobile browser (responsive UI, bottom nav + drawer).
- Installed PWA / native wrapper: opens at `/dashboard` (manifest
  `start_url`), never the landing page.
- Offline: downloaded PDFs fully available; cached pages readable;
  search and sync require connectivity.

## Current limitations

- Offline search is unavailable; sync of progress/favorites requires
  connectivity.
- Temp PDF cache covers files ≤ 15 MB only; larger files stream and rely
  on explicit downloads for offline use.
- One bookmark per target; one `ongoing` semester per user.
