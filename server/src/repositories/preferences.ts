import { Types } from "mongoose";
import { RECENT_CAP, UserPreferences } from "../models";

/**
 * Phase 19 user-preferences data access (recent resources only).
 *
 * Ownership always derives from the caller's userId. Recent updates use a
 * single atomic aggregation-pipeline update (dedupe + prepend + cap in one
 * write, upserting the doc), so concurrent opens can neither exceed the cap
 * nor interleave into duplicates beyond a last-writer-wins entry.
 */

export interface RecentResourceRow {
  resourceId: string;
  openedAt: string;
}

export interface PreferencesRow {
  userId: string;
  recentResources: RecentResourceRow[];
  createdAt: string;
  updatedAt: string;
}

interface LeanPrefs {
  userId: unknown;
  recentResources?: Array<{ resourceId: unknown; openedAt: Date }>;
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
  return {
    userId: String(doc.userId),
    recentResources: recents,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date().toISOString(),
  };
}

/** Preferences without creating: absent doc reads as empty recents. */
export async function getPreferences(userId: string): Promise<PreferencesRow> {
  const doc = await UserPreferences.findOne({ userId }).lean().exec();
  if (!doc) {
    const now = new Date().toISOString();
    return { userId, recentResources: [], createdAt: now, updatedAt: now };
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
