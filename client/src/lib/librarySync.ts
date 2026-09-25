/**
 * Phase 17 library hydration helpers — pure functions shared by
 * LibraryProvider and tests (no React, no storage access).
 *
 * Storage rule:
 * - Guest state lives under the legacy shared keys (the guest namespace).
 * - Authenticated User A lives under `...v2.<userAId>` (and B under theirs),
 *   so local mirrors can never leak across accounts on a shared device.
 *
 * Guest → account merge rule (minimal, deterministic):
 * - Valid guest favorite/bookmark entries are pushed into the newly
 *   authenticated account through the existing idempotent APIs
 *   (PUT favorite / POST bookmark return the existing row on retry), so
 *   duplicates are impossible and server uniqueness constraints hold.
 * - The server list then wins outright (fetch-all hydration replaces local
 *   state). Guest reading progress is memory-only and is never merged.
 */

import { isObjectIdLike } from "./studyApi";
import type { Bookmark } from "../types";

export const LIBRARY_BASE_KEYS = {
  favorites: "meronote.library.favorites.v1",
  favoriteSubjects: "meronote.library.favoriteSubjects.v1",
  bookmarks: "meronote.library.bookmarks.v1",
  bookmarkedSubjects: "meronote.library.bookmarkedSubjects.v1",
} as const;

export type LibraryBaseKey = keyof typeof LIBRARY_BASE_KEYS;

/** Namespace a personal mirror: guest keeps the legacy key, users get v2 ids. */
export function libraryMirrorKey(base: LibraryBaseKey, userId: string | null): string {
  const legacy = LIBRARY_BASE_KEYS[base];
  return userId ? `${legacy.replace(/\.v1$/, "")}.v2.${userId}` : legacy;
}

/** Safety bound for one login merge (prevents request storms from corrupt mirrors). */
export const MAX_MERGE_OPS = 500;

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !isObjectIdLike(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_MERGE_OPS) break;
  }
  return out;
}

export interface GuestFavoriteMerge {
  resourceIds: string[];
  subjectIds: string[];
}

/** Valid guest favorites eligible for account merge (mock/junk ids dropped). */
export function selectGuestFavoriteMerge(favorites: string[], favoriteSubjects: string[]): GuestFavoriteMerge {
  return {
    resourceIds: dedupeIds(favorites),
    subjectIds: dedupeIds(favoriteSubjects),
  };
}

export interface GuestBookmarkMerge {
  targetId: string;
  page: number;
  note: string;
}

export interface GuestBookmarksMerge {
  resources: GuestBookmarkMerge[];
  subjectIds: string[];
}

/**
 * Valid guest bookmarks eligible for account merge. Resource bookmarks keep
 * their page/note; subject bookmarks merge by id. Temp mock ids and invalid
 * pages are dropped (the server would reject them).
 */
export function selectGuestBookmarkMerge(
  bookmarks: Bookmark[],
  bookmarkedSubjects: string[],
): GuestBookmarksMerge {
  const resources: GuestBookmarkMerge[] = [];
  const seen = new Set<string>();
  for (const bm of bookmarks) {
    if (!bm || typeof bm.resourceId !== "string" || !isObjectIdLike(bm.resourceId)) continue;
    if (seen.has(bm.resourceId)) continue;
    seen.add(bm.resourceId);
    const page = typeof bm.page === "number" && Number.isFinite(bm.page) && bm.page >= 1 ? Math.floor(bm.page) : 1;
    resources.push({
      targetId: bm.resourceId,
      page,
      note: typeof bm.note === "string" ? bm.note.slice(0, 1000) : "",
    });
    if (resources.length >= MAX_MERGE_OPS) break;
  }
  return { resources, subjectIds: dedupeIds(bookmarkedSubjects) };
}

export interface ServerClaimSets {
  favoriteResourceIds: Set<string>;
  favoriteSubjectIds: Set<string>;
  bookmarkResourceIds: Set<string>;
  bookmarkSubjectIds: Set<string>;
}

interface TargetRow {
  targetType: string;
  targetId: string;
}

/**
 * Ids the server already holds after a successful hydration. The provider
 * prunes exactly these from the legacy guest mirrors, so entries claimed by
 * one account can never be re-merged into a different account on a shared
 * device. Entries the server lacks (deleted elsewhere, merge failures) stay
 * in the guest mirrors.
 */
export function buildServerClaimSets(favRows: TargetRow[], bmRows: TargetRow[]): ServerClaimSets {
  const sets: ServerClaimSets = {
    favoriteResourceIds: new Set(),
    favoriteSubjectIds: new Set(),
    bookmarkResourceIds: new Set(),
    bookmarkSubjectIds: new Set(),
  };
  for (const row of favRows) {
    if (!row || !isObjectIdLike(row.targetId)) continue;
    if (row.targetType === "resource") sets.favoriteResourceIds.add(row.targetId);
    else if (row.targetType === "subject") sets.favoriteSubjectIds.add(row.targetId);
  }
  for (const row of bmRows) {
    if (!row || !isObjectIdLike(row.targetId)) continue;
    if (row.targetType === "resource") sets.bookmarkResourceIds.add(row.targetId);
    else if (row.targetType === "subject") sets.bookmarkSubjectIds.add(row.targetId);
  }
  return sets;
}

/** Drop claimed ids from a guest id list (no-op when nothing matches). */
export function removeClaimedIds(list: string[], claimed: Set<string>): string[] {
  if (claimed.size === 0) return list;
  return list.filter((id) => !claimed.has(id));
}

/** Drop guest bookmarks whose resource the server already holds. */
export function removeClaimedBookmarks(list: Bookmark[], claimed: Set<string>): Bookmark[] {
  if (claimed.size === 0) return list;
  return list.filter((bm) => !claimed.has(bm.resourceId));
}
