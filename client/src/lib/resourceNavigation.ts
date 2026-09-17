/**
 * Shared navigation-context helper for the student Resource Detail
 * (/resources/:id) and PDF Viewer (/reader/:id) pages.
 *
 * Breadcrumbs must describe the actual route the student used to reach the
 *  page — not the resource's stored academic hierarchy. Entry pages pass
 *  their identity through React Router location state (`state={{ via }}`,
 *  the same mechanism the Admin portal uses for its entry points), and
 *  Subject pages additionally pass `fromSubject` so detail/reader can tell
 *  a "Favorites → Subject → Resource" trail apart from a direct
 *  "Favorites → Resource" open. Pages without state (direct URL access,
 *  refresh, dashboard shortcuts) fall back to the Semester hierarchy,
 *  which stays the default trail.
 */

/** Breadcrumb root for each non-Semester entry point. */
const RESOURCE_ENTRY_ROOTS = {
  resources: { label: "Resources", to: "/resources" },
  favorites: { label: "Favorites", to: "/favorites" },
  bookmarks: { label: "Bookmarks", to: "/bookmarks" },
  downloads: { label: "Downloads", to: "/downloads" },
} as const;

export type ResourceEntryPoint = "semester" | keyof typeof RESOURCE_ENTRY_ROOTS;

/** Location state carried between student list → subject → detail → reader.
 *  `via` preserves the origin (Favorites / Bookmarks / ...). `fromSubject`
 *  is only set when the user actually navigated through a Subject page, so
 *  detail/reader can tell "Favorites → Subject → Resource" apart from a
 *  direct "Favorites → Resource" open (both share the same `via`). */
export interface ResourceNavState {
  via?: ResourceEntryPoint;
  fromSubject?: string;
}

/** Read the entry point from React Router location state. */
export function entryPointFromState(state: unknown): ResourceEntryPoint {
  const via = (state as { via?: unknown } | null)?.via;
  return typeof via === "string" && via in RESOURCE_ENTRY_ROOTS
    ? (via as keyof typeof RESOURCE_ENTRY_ROOTS)
    : "semester";
}

/** Read the subject the user navigated through (if any) from location state. */
export function subjectIdFromState(state: unknown): string | undefined {
  const fromSubject = (state as { fromSubject?: unknown } | null)?.fromSubject;
  return typeof fromSubject === "string" && fromSubject.length > 0
    ? fromSubject
    : undefined;
}

/** Build location state for detail/reader links, preserving the trail.
 *  The `"semester"` fallback is not a storable entry point (it is only the
 *  stateless default), so it normalizes to `undefined` — direct URL visits
 *  and refreshes keep falling back to the Semester trail. */
export function buildResourceNavState(
  via?: ResourceEntryPoint,
  fromSubject?: string,
): ResourceNavState | undefined {
  const forwardVia = via === "semester" ? undefined : via;
  if (!forwardVia && !fromSubject) return undefined;
  const next: ResourceNavState = {};
  if (forwardVia) next.via = forwardVia;
  if (fromSubject) next.fromSubject = fromSubject;
  return next;
}

/** Breadcrumb root for an entry point, or `undefined` for the Semester trail. */
export function entryRootFor(
  entry: ResourceEntryPoint,
): { label: string; to: string } | undefined {
  return RESOURCE_ENTRY_ROOTS[entry as keyof typeof RESOURCE_ENTRY_ROOTS];
}

/**
 * Entries whose subject page keeps the saved-list root
 * (Favorites → Subject, Bookmarks → Subject).
 * NOTE: this is only for the Subject page itself. Resource detail / reader
 * pages must NOT use this to auto-insert a subject — they use
 * `showsSubjectInResourceTrail` below so a direct
 * Favorites → Resource open never invents a Subject crumb.
 */
export function entryShowsSubject(entry: ResourceEntryPoint): boolean {
  return entry === "bookmarks" || entry === "favorites";
}

/**
 * Navigation-aware check for resource detail / reader breadcrumbs.
 * Returns true only when the user actually navigated through a subject
 * (`fromSubject` matches the opened resource's subject). Direct opens from
 * a saved list carry `via` without `fromSubject`, so no intermediate
 * Subject crumb is invented.
 */
export function showsSubjectInResourceTrail(
  entry: ResourceEntryPoint,
  fromSubject: string | undefined,
  resourceSubjectId: string | undefined,
): boolean {
  if (!entryShowsSubject(entry)) return false;
  if (!fromSubject || !resourceSubjectId) return false;
  return fromSubject === resourceSubjectId;
}

/**
 * Sidebar / mobile-nav highlight for pages that belong to a section other
 * than their URL prefix:
 * - Subject pages (/subjects/:id) live inside the Semester flow, so they
 *   keep Semesters highlighted.
 * - Shared student detail (/resources/:id) and reader (/reader/:id) pages
 *   keep their entry point highlighted (Semesters / Resources / Favorites /
 *   Bookmarks / Downloads).
 * Returns the nav destination that owns the current page, or `undefined`
 * elsewhere so default URL matching applies. Entry-less detail/reader
 * visits (direct URL, refresh) fall back to Semesters, matching the
 * breadcrumb.
 */
export function studentNavHighlight(
  pathname: string,
  state: unknown,
): string | undefined {
  // Subject pages keep the entry section lit (Favorites / Bookmarks), else
  // they live inside the Semester flow.
  if (pathname.startsWith("/subjects/")) {
    const subjectEntry = entryPointFromState(state);
    return entryShowsSubject(subjectEntry)
      ? entryRootFor(subjectEntry)?.to
      : "/semesters";
  }
  const shared =
    pathname.startsWith("/resources/") || pathname.startsWith("/reader/");
  if (!shared) return undefined;
  return entryRootFor(entryPointFromState(state))?.to ?? "/semesters";
}

/**
 * Admin counterpart of the student navigation context above.
 * Entry pages announce themselves through location state
 * (`state={{ via }}`): "semesters" from Admin → Semesters, "resources"
 * from Admin → Resources, "drafts" from Admin → Drafts. Stateless visits
 * (direct URL, refresh) fall back to the Resources trail, matching the
 * previous default. No new routing is introduced.
 */

/** Breadcrumb root for each Admin entry point. */
const ADMIN_ENTRY_ROOTS = {
  semesters: { label: "Semesters", to: "/admin/semesters" },
  resources: { label: "Resources", to: "/admin/resources" },
  drafts: { label: "Draft", to: "/admin/drafts" },
} as const;

export type AdminEntryPoint = keyof typeof ADMIN_ENTRY_ROOTS;

/** Read the Admin entry point from React Router location state. */
export function adminEntryPointFromState(state: unknown): AdminEntryPoint {
  const via = (state as { via?: unknown } | null)?.via;
  if (via === "drafts") return "drafts";
  if (via === "semesters") return "semesters";
  return "resources";
}

/** Breadcrumb root for an Admin entry point. */
export function adminEntryRootFor(entry: AdminEntryPoint): {
  label: string;
  to: string;
} {
  return ADMIN_ENTRY_ROOTS[entry];
}

/**
 * Admin sidebar / mobile-nav highlight for the shared detail
 * (/admin/resources/:id) and reader (/admin/reader/:id) pages.
 * Returns the nav destination that owns the current page, or `undefined`
 * elsewhere so default URL matching applies.
 */
export function adminNavHighlight(
  pathname: string,
  state: unknown,
): string | undefined {
  const shared =
    pathname.startsWith("/admin/resources/") ||
    pathname.startsWith("/admin/reader/");
  if (!shared) return undefined;
  return adminEntryRootFor(adminEntryPointFromState(state)).to;
}
