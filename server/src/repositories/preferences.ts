import { Types } from "mongoose";
import { RECENT_CAP, Resource, UserPreferences } from "../models";
import { liveResourceFilter } from "./content";

/**
 * Phase 19 user-preferences data access (recent resources) + Phase 21
 * user-controlled Continue Reading list.
 *
 * Ownership always derives from the caller's userId. Recent updates use a
 * single atomic aggregation-pipeline update (dedupe + prepend + cap in one
 * write, upserting the doc), so concurrent opens can neither exceed the cap
 * nor interleave into duplicates beyond a last-writer-wins entry.
 * Continue Reading uses atomic $addToSet/$pull (no cap by product rule:
 * entries live until the user removes them).
 */

export interface RecentResourceRow {
  resourceId: string;
  openedAt: string;
}

export interface PreferencesRow {
  userId: string;
  recentResources: RecentResourceRow[];
  /** Continue Reading resource ids, insertion order (Phase 21). */
  continueReading: string[];
  createdAt: string;
  updatedAt: string;
}

interface LeanPrefs {
  userId: unknown;
  recentResources?: Array<{ resourceId: unknown; openedAt: Date }>;
  continueReading?: Array<{ resourceId: unknown }>;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(doc: LeanPrefs): PreferencesRow {
  const recents: RecentResourceRow[] = [];
  for (const e of doc.recentResources ?? []) {
    // Skip malformed entries instead of failing the whole read: one corrupt
    // entry must never break hydration for the entire recent list.
    if (!e || typeof e.resourceId === "undefined" || !(e.openedAt instanceof Date)) continue;
    recents.push({ resourceId: String(e.resourceId), openedAt: e.openedAt.toISOString() });
  }
  const reading: string[] = [];
  for (const e of doc.continueReading ?? []) {
    if (!e || typeof e.resourceId === "undefined") continue;
    const id = String(e.resourceId);
    if (id && !reading.includes(id)) reading.push(id);
  }
  return {
    userId: String(doc.userId),
    recentResources: recents,
    continueReading: reading,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date().toISOString(),
  };
}

/** Preferences without creating: absent doc reads as empty defaults. */
export async function getPreferences(userId: string): Promise<PreferencesRow> {
  const doc = await UserPreferences.findOne({ userId }).lean().exec();
  if (!doc) {
    const now = new Date().toISOString();
    return { userId, recentResources: [], continueReading: [], createdAt: now, updatedAt: now };
  }
  return serialize(doc as unknown as LeanPrefs);
}

/**
 * Record one intentional resource open: dedupe by resourceId, prepend with
 * the open time, cap at RECENT_CAP — atomically, creating the doc on first
 * use. Returns the updated recents. A concurrent first-use collision (two
 * opens racing the upsert) retries once against the now-existing doc.
 */
export async function recordRecentResource(userId: string, resourceId: string): Promise<RecentResourceRow[]> {
  const now = new Date();
  const rid = new Types.ObjectId(resourceId);
  const pipeline = [
    {
      $set: {
        recentResources: {
          $slice: [
            {
              $concatArrays: [
                [{ resourceId: rid, openedAt: now }],
                {
                  $filter: {
                    input: { $ifNull: ["$recentResources", []] },
                    as: "entry",
                    cond: { $ne: ["$$entry.resourceId", rid] },
                  },
                },
              ],
            },
            RECENT_CAP,
          ],
        },
        // Pipeline upserts bypass schema timestamps: pin both explicitly
        // (createdAt only on first insert).
        createdAt: { $ifNull: ["$createdAt", now] },
        updatedAt: now,
      },
    },
  ];
  // Mongoose 9 treats array updates as pipelines only with this flag.
  const options = { upsert: true, returnDocument: "after", updatePipeline: true } as const;
  const run = (): Promise<RecentResourceRow[]> =>
    UserPreferences.findOneAndUpdate({ userId }, pipeline, options)
      .exec()
      .then((updated) => {
        if (!updated) throw new Error("Recent update unexpectedly returned no document.");
        return serialize(updated.toObject() as unknown as LeanPrefs).recentResources;
      });
  try {
    return await run();
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    return run();
  }
}

/** A resource can join Continue Reading only while student-visible. */
export async function continueReadingTargetIsLive(resourceId: string): Promise<boolean> {
  return (await Resource.exists({ _id: resourceId, ...liveResourceFilter() })) !== null;
}

/**
 * Explicitly add one resource to the user's Continue Reading list.
 * Atomic $addToSet: duplicates are impossible, no cap and no expiration by
 * product rule (entries live until the user removes them). Returns whether
 * this call newly added the entry (201 vs 200).
 */
export async function addContinueReading(userId: string, resourceId: string): Promise<{ added: boolean }> {
  const existing = await UserPreferences.findOne(
    { userId, "continueReading.resourceId": new Types.ObjectId(resourceId) },
    { _id: 1 },
  )
    .lean()
    .exec();
  if (existing) return { added: false };
  try {
    await UserPreferences.updateOne(
      { userId },
      {
        $setOnInsert: { userId, createdAt: new Date() },
        $set: { updatedAt: new Date() },
        $addToSet: { continueReading: { resourceId: new Types.ObjectId(resourceId), addedAt: new Date() } },
      },
      { upsert: true },
    ).exec();
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    // Lost a same-key race (parallel first-use upserts): the winner holds
    // the doc; ensure the entry and report it as already present.
    await UserPreferences.updateOne(
      { userId },
      { $addToSet: { continueReading: { resourceId: new Types.ObjectId(resourceId), addedAt: new Date() } } },
    ).exec();
    return { added: false };
  }
  return { added: true };
}

/** Explicitly remove one resource from Continue Reading (idempotent). */
export async function removeContinueReading(userId: string, resourceId: string): Promise<boolean> {
  // timestamps:false: the schema would otherwise touch updatedAt on every
  // call, making modifiedCount useless for detecting an actual removal.
  const res = await UserPreferences.updateOne(
    { userId },
    { $pull: { continueReading: { resourceId: new Types.ObjectId(resourceId) } } },
    { timestamps: false },
  ).exec();
  return res.modifiedCount === 1;
}
