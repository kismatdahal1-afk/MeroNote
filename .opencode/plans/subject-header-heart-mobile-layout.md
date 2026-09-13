# Plan: Heart Icon for Favorite + Mobile Metadata Layout in Subject Detail Page

## Goal
On the Subject detail page (Semester > Subject):
1. Replace the current star-shaped inline SVG "Favorite" icon with a **Heart** icon.
2. On **mobile only**, rearrange the course metadata into two rows:
   - **Row 1:** Course Code (e.g. CSC101)
   - **Row 2:** Credit Hours, Full Marks, Topics, Resources
   - Desktop (sm and up) keeps the current single-row inline layout.

## Files to Change

### 1. `client/src/components/subjects/SubjectHeader.tsx`

**Change A — Heart icon for Favorite button (lines 56-81):**
- Add import: `import { Heart } from "lucide-react";` (lucide-react ^1.45.0 is already in `client/package.json`; other files like `SubjectCard.tsx` already import `Heart` the same way).
- Replace the inline `<svg>...<path d="M11.5 3.8 8.7 9.4l-6 .9 4.4 4.2-1 6 5.4-2.9 5.4 2.9-1-6 4.4-4.2-6-.9z" /></svg>` (star shape) with:
  ```tsx
  <Heart
    className="size-4"
    fill={favorite ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  />
  ```
- Keep everything else (button styling, text "Favorite"/"Favorited", aria attributes, click handler) unchanged. This matches the filled-when-active pattern already used by `IconButton filled={favorite}` in `SubjectCard.tsx`.
- Note: the Bookmark button's inline SVG stays as-is (it's already a bookmark/ribbon shape).

### 2. `client/src/components/subjects/CourseMetadata.tsx`

**Change B — Mobile two-row layout, desktop unchanged:**

Current: single `<dl className="flex flex-wrap ...">` mapping all items in one flow, so on mobile items wrap unpredictably.

New structure:
- Split items into two groups:
  - `codeItem` = Course Code
  - `statItems` = Credit Hours (if present), Full Marks (if present), Topics, Resources
- Render:
  ```tsx
  <dl className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
    {/* Row 1 (mobile): Course Code — also first inline item on desktop */}
    <div>... Course Code item ...</div>
    {/* Row 2 (mobile): the stats, inline on desktop */}
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      ...statItems.map(...)...
    </div>
  </dl>
  ```
- Keep the same item markup (`sr-only` dt, value span, uppercase label span) so visual style is unchanged.
- The `key={label}` mapping and conditional includes (`credits != null`, `fullMarks != null`) are preserved.

## Notes / Assumptions
- Heart icon applies on all screen sizes (user asked to replace the icon on this page; only the metadata layout is mobile-specific).
- "Mobile" = default styles; `sm:` breakpoint (~640px) and up keeps today's single-row look. The header already uses `sm:` breakpoints the same way (SubjectHeader line 29), so this follows existing conventions.
- No other components use `CourseMetadata` (verified via grep — only `SubjectHeader.tsx`), so this change is isolated to the Subject detail page.

## Verification
- `npm run typecheck` in `client/` (tsc -b) to confirm no type errors.
- `npm run dev` in `client/`, open a subject page:
  - Favorite button shows a heart; filled when favorited, outline when not.
  - Resize below 640px: Course Code on its own row, stats grouped below.
  - Desktop: metadata renders inline in one row as before.
