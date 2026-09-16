/**
 * Shared navigation-context helper for the student Resource Detail
 * (/resources/:id) and PDF Viewer (/reader/:id) pages.
 *
 * Breadcrumbs must describe the actual route the student used to reach the
 *  page — not the resource's stored academic hierarchy. Entry pages pass
 *  their identity through React Router location state (`state={{ via }}`,
 *  the same mechanism the Admin portal uses for its entry points). Pages without
 * state (direct URL access, refresh, dashboard shortcuts) fall back to the
 * Semester hierarchy, which stays the default trail.
 */

/** Breadcrumb root for each non-Semester entry point. */
const RESOURCE_ENTRY_ROOTS = {
  resources: { label: "Resources", to: "/resources" },
  favorites: { label: "Favorite", to: "/favorites" },
  bookmarks: { label: "Bookmark", to: "/bookmarks" },
  downloads: { label: "Downloads", to: "/downloads" },
} as const;

export type ResourceEntryPoint = "semester" | keyof typeof RESOURCE_ENTRY_ROOTS;

/** Read the entry point from React Router location state. */
export function entryPointFromState(state: unknown): ResourceEntryPoint {
  const via = (state as { via?: unknown } | null)?.via;
  return typeof via === "string" && via in RESOURCE_ENTRY_ROOTS
    ? (via as keyof typeof RESOURCE_ENTRY_ROOTS)
    : "semester";
}

/** Breadcrumb root for an entry point, or `undefined` for the Semester trail. */
export function entryRootFor(
  entry: ResourceEntryPoint,
): { label: string; to: string } | undefined {
  return RESOURCE_ENTRY_ROOTS[entry as keyof typeof RESOURCE_ENTRY_ROOTS];
}

/**
 * Entries whose trail inserts the resource's subject between the root and
 * the resource (saved-list flows: Favorite / Bookmark).
 */
export function entryShowsSubject(entry: ResourceEntryPoint): boolean {
  return entry === "bookmarks" || entry === "favorites";
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
  // Subject pages keep the entry section lit (Favorite / Bookmark), else
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
