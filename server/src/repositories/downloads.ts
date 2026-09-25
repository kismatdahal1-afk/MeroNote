import { DownloadHistory, Resource } from "../models";
import { liveResourceFilter } from "./content";

/**
 * Phase 18 account-level download history data access.
 *
 * Ownership always derives from the caller's userId (never from client
 * input). Registration is an idempotent upsert keyed by the unique
 * { userId, resourceId } index — re-download refreshes the row, never
 * duplicates it. No PDF bytes are stored here (device-local IndexedDB only).
 */

export interface DownloadHistoryInput {
  fileSize?: number;
}

export interface DownloadVerifyInput {
  verify?: boolean;
  fileSize?: number;
}

export interface DownloadHistoryResource {
  _id: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  pageCount?: number;
  fileSize?: number;
  subjectId: string;
  semesterId: string;
}

export interface DownloadHistoryRow {
  _id: string;
  userId: string;
  resourceId: string;
  status: "active";
  fileSize?: number;
  downloadedAt: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Null when the resource was deleted/hidden after downloading. */
  resource: DownloadHistoryResource | null;
}

interface LeanResource {
  _id: unknown;
  title?: unknown;
  description?: unknown;
  type?: unknown;
  tags?: unknown;
  pageCount?: number;
  fileSize?: number;
  subjectId?: unknown;
  semesterId?: unknown;
}

/** Populated docs carry the resource fields; missing refs stay ObjectIds/null. */
function asResource(value: unknown): LeanResource | null {
  if (!value || typeof value !== "object") return null;
  if (!("title" in value)) return null;
  return value as LeanResource;
}

function toResourceSummary(resource: LeanResource): DownloadHistoryResource {
  return {
    _id: String(resource._id),
    title: typeof resource.title === "string" ? resource.title : "Untitled resource",
    description: typeof resource.description === "string" ? resource.description : "",
    type: typeof resource.type === "string" ? resource.type : "custom",
    tags: Array.isArray(resource.tags) ? resource.tags.filter((t): t is string => typeof t === "string") : [],
    pageCount: resource.pageCount,
    fileSize: resource.fileSize,
    subjectId: String(resource.subjectId ?? ""),
    semesterId: String(resource.semesterId ?? ""),
  };
}

interface RowScalars {
  _id: unknown;
  userId: unknown;
  resourceId: unknown;
  status: "active";
  fileSize?: number;
  downloadedAt: Date;
  lastVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(scalars: RowScalars, resource: LeanResource | null): DownloadHistoryRow {
  const out: DownloadHistoryRow = {
    _id: String(scalars._id),
    userId: String(scalars.userId),
    resourceId: String(resource ? resource._id : scalars.resourceId),
    status: scalars.status,
    createdAt: scalars.createdAt.toISOString(),
    updatedAt: scalars.updatedAt.toISOString(),
    downloadedAt: scalars.downloadedAt.toISOString(),
    resource: resource ? toResourceSummary(resource) : null,
  };
  if (typeof scalars.fileSize === "number") out.fileSize = scalars.fileSize;
  if (scalars.lastVerifiedAt) out.lastVerifiedAt = scalars.lastVerifiedAt.toISOString();
  return out;
}

/** A resource can enter download history only while student-visible. */
export async function downloadTargetIsLive(resourceId: string): Promise<boolean> {
  return (await Resource.exists({ _id: resourceId, ...liveResourceFilter() })) !== null;
}

/** Hard-remove one history row (idempotent). Blobs are device-local and untouched. */
export async function removeDownload(userId: string, resourceId: string): Promise<boolean> {
  const removed = await DownloadHistory.findOneAndDelete({ userId, resourceId }).exec();
  return removed !== null;
}

/**
 * Verification/metadata refresh without reordering: optionally stamps
 * lastVerifiedAt (caller confirmed the local file exists) and/or corrects
 * fileSize. downloadedAt is never touched. Null when no row exists.
 */
export async function verifyDownload(
  userId: string,
  resourceId: string,
  input: DownloadVerifyInput,
): Promise<DownloadHistoryRow | null> {
  const set: Record<string, unknown> = {};
  if (input.verify) set.lastVerifiedAt = new Date();
  if (input.fileSize !== undefined) set.fileSize = input.fileSize;
  const doc = await DownloadHistory.findOneAndUpdate({ userId, resourceId }, { $set: set }, { returnDocument: "after" })
    .populate("resourceId", RESOURCE_FIELDS)
    .exec();
  if (!doc) return null;
  const plain = doc.toObject() as unknown as RowScalars & { resourceId: unknown };
  return serialize(plain, asResource(plain.resourceId));
}

const RESOURCE_FIELDS = "title description type tags pageCount fileSize subjectId semesterId";

export async function listUserDownloads(
  userId: string,
  page: number,
  limit: number,
): Promise<{ total: number; rows: DownloadHistoryRow[] }> {
  const filter = { userId, status: "active" as const };
  const [total, docs] = await Promise.all([
    DownloadHistory.countDocuments(filter).exec(),
    DownloadHistory.find(filter)
      .sort({ downloadedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("resourceId", RESOURCE_FIELDS)
      .lean()
      .exec(),
  ]);
  const rows = (docs as unknown as Array<RowScalars & { resourceId: unknown }>).map((d) =>
    serialize(d, asResource(d.resourceId)),
  );
  return { total, rows };
}

/**
 * Idempotent registration: creates the history row on first completion,
 * refreshes downloadedAt/fileSize/lastVerifiedAt on re-download.
 * Returns the row plus whether it was newly created (201 vs 200).
 */
export async function registerDownload(
  userId: string,
  resourceId: string,
  input: DownloadHistoryInput,
): Promise<{ row: DownloadHistoryRow; created: boolean }> {
  const set: Record<string, unknown> = {
    status: "active",
    downloadedAt: new Date(),
    lastVerifiedAt: new Date(),
  };
  if (input.fileSize !== undefined) set.fileSize = input.fileSize;

  const existed = await DownloadHistory.exists({ userId, resourceId }).exec();
  try {
    const doc = await DownloadHistory.findOneAndUpdate(
      { userId, resourceId },
      { $set: set, $setOnInsert: { userId, resourceId } },
      { upsert: true, returnDocument: "after", runValidators: true },
    )
      .populate("resourceId", RESOURCE_FIELDS)
      .exec();
    if (!doc) throw new Error("Download registration unexpectedly returned no document.");
    const plain = doc.toObject() as unknown as RowScalars & { resourceId: unknown };
    return { row: serialize(plain, asResource(plain.resourceId)), created: existed === null };
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    // Lost a same-key race: return the winner instead of duplicating.
    const winner = await DownloadHistory.findOne({ userId, resourceId })
      .populate("resourceId", RESOURCE_FIELDS)
      .exec();
    if (!winner) throw err;
    const plain = winner.toObject() as unknown as RowScalars & { resourceId: unknown };
    return { row: serialize(plain, asResource(plain.resourceId)), created: false };
  }
}
