import type { Model, Types } from "mongoose";
import { Resource } from "../models";

/**
 * Phase 2 minimal data-access helpers.
 *
 * Only what every future read/write API will need, in one place:
 * - student-visibility filters (published + not soft-deleted; resources also not hidden)
 * - soft-delete / restore for the 6 admin-managed content collections
 * - book-unlink maintenance for the single-direction Resource.bookId link
 *
 * No services, no auth, no B2 logic. Personal collections (favorites,
 * bookmarks, readingProgress) use hard create/delete — no trash semantics.
 */

export interface SoftDeletable {
  deletedAt?: Date;
}

type SoftDeletableModel<T extends SoftDeletable> = Model<T>;

/** Student-visible content rows (notices/books/semesters/subjects/topics). */
export function liveFilter(status = "published"): Record<string, unknown> {
  return { status, deletedAt: null };
}

/** Student-visible resources (adds the published-but-hidden flag). */
export function liveResourceFilter(): Record<string, unknown> {
  return { ...liveFilter(), hidden: false };
}

/** Soft delete: marks deletedAt (keeps the row + its B2 object for restore). */
export async function softDelete<T extends SoftDeletable>(
  model: SoftDeletableModel<T>,
  id: string | Types.ObjectId,
): Promise<T | null> {
  return model.findByIdAndUpdate(id, { $set: { deletedAt: new Date() } }, { returnDocument: "after" }).exec();
}

/** Undo a soft delete. */
export async function restoreDoc<T extends SoftDeletable>(
  model: SoftDeletableModel<T>,
  id: string | Types.ObjectId,
): Promise<T | null> {
  return model.findByIdAndUpdate(id, { $unset: { deletedAt: "" } }, { returnDocument: "after" }).exec();
}

/**
 * Book maintenance for the single-direction link: deleting a book clears
 * Resource.bookId on every linked resource (no book-side write needed).
 */
export async function unlinkBookResources(bookId: string | Types.ObjectId): Promise<number> {
  const result = await Resource.updateMany({ bookId }, { $unset: { bookId: "" } }).exec();
  return result.modifiedCount;
}
