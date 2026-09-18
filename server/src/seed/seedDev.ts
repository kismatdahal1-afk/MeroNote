import {
  Bookmark,
  Book,
  Favorite,
  Notice,
  ReadingProgress,
  Resource,
  Semester,
  Subject,
  Topic,
  User,
} from "../models";

/**
 * Phase 1 dev-seed transform (pure DB logic — no client imports here so
 * `tsc` stays confined to server/src; the CLI script in server/scripts/
 * loads the frontend mock and calls this).
 *
 * Mapping follows docs/backend-architecture.md §19:
 * - semesters: drop enrollment/subjectCount/resourceCount, add order+status
 * - subjects: drop offlineSync
 * - topics: published → status
 * - resources: backfill file.{key,bucket,mime} placeholder pointer
 *   (real B2 keys arrive in Phase 5; NO binary data is stored)
 * - personal rows attach to the dev user via userId
 * - seedDownloads / seedRecent / activity are NOT migrated (client-only)
 *
 * Idempotent: content rows upsert on stable natural keys, personal rows are
 * replaced per user. Safe to re-run. Production guard lives in the CLI.
 */

export interface DevSeedSemester {
  id: string;
  number: number;
  name: string;
  description: string;
  credits: number;
}

export interface DevSeedSubject {
  id: string;
  semesterId: string;
  name: string;
  code: string;
  description: string;
  category: "core" | "elective" | "practical";
  credits: number;
  hotTopics: string[];
  fullMarks?: number;
}

export interface DevSeedTopic {
  id: string;
  subjectId: string;
  title: string;
  description?: string;
  order: number;
  published: boolean;
}

export interface DevSeedResource {
  id: string;
  title: string;
  description: string;
  semesterId: string;
  subjectId: string;
  topicId?: string;
  type: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  tags: string[];
}

export interface DevSeedNotice {
  id: string;
  heading: string;
  subtext: string;
  type: string;
  announcer: string;
  date: string;
  priority: string;
  status: "draft" | "published";
  showOnDashboard: boolean;
  pinned: boolean;
}

export interface DevSeedBookmark {
  id: string;
  resourceId: string;
  page: number;
  note: string;
}

export interface DevSeedProgress {
  resourceId: string;
  lastPage: number;
}

export interface DevSeedInput {
  semesters: DevSeedSemester[];
  subjects: DevSeedSubject[];
  topics: DevSeedTopic[];
  resources: DevSeedResource[];
  notices: DevSeedNotice[];
  user: { name: string; email: string; role: "USER" | "ADMIN" };
  favorites: string[];
  bookmarks: DevSeedBookmark[];
  progress: DevSeedProgress[];
}

export interface DevSeedResult {
  users: number;
  semesters: number;
  subjects: number;
  topics: number;
  resources: number;
  books: number;
  notices: number;
  favorites: number;
  bookmarks: number;
  readingProgress: number;
}

const DEV_BUCKET = "mero-note-dev";

export async function seedDev(input: DevSeedInput): Promise<DevSeedResult> {
  // Dev user first — personal rows need the _id.
  const user = await User.findOneAndUpdate(
    { email: input.user.email.toLowerCase() },
    {
      $set: { name: input.user.name, role: input.user.role },
      $setOnInsert: { passwordHash: "DEV_ONLY_UNUSABLE_HASH" },
    },
    { upsert: true, returnDocument: "after" },
  ).exec();
  const userId = user._id;

  const semesterIds = new Map<string, typeof user._id>();
  for (let i = 0; i < input.semesters.length; i += 1) {
    const s = input.semesters[i];
    const doc = await Semester.findOneAndUpdate(
      { number: s.number },
      {
        $set: {
          name: s.name,
          description: s.description ?? "",
          credits: s.credits ?? 0,
          order: i + 1,
          status: "published",
        },
      },
      { upsert: true, returnDocument: "after" },
    ).exec();
    semesterIds.set(s.id, doc._id);
  }

  const subjectIds = new Map<string, typeof user._id>();
  const subjectSemester = new Map<string, string>();
  for (const s of input.subjects) {
    const semesterId = semesterIds.get(s.semesterId);
    if (!semesterId) throw new Error(`seed: unknown semester ${s.semesterId} for subject ${s.id}`);
    const doc = await Subject.findOneAndUpdate(
      { code: s.code },
      {
        $set: {
          semesterId,
          name: s.name,
          description: s.description ?? "",
          category: s.category,
          credits: s.credits ?? 0,
          hotTopics: s.hotTopics ?? [],
          fullMarks: s.fullMarks,
          status: "published",
        },
      },
      { upsert: true, returnDocument: "after" },
    ).exec();
    subjectIds.set(s.id, doc._id);
    subjectSemester.set(s.id, s.semesterId);
  }

  const topicIds = new Map<string, typeof user._id>();
  for (const t of input.topics) {
    const subjectId = subjectIds.get(t.subjectId);
    if (!subjectId) throw new Error(`seed: unknown subject ${t.subjectId} for topic ${t.id}`);
    const doc = await Topic.findOneAndUpdate(
      { subjectId, title: t.title },
      {
        $set: {
          description: t.description,
          order: t.order,
          status: t.published ? "published" : "draft",
        },
      },
      { upsert: true, returnDocument: "after" },
    ).exec();
    topicIds.set(t.id, doc._id);
  }

  const resourceIds = new Map<string, typeof user._id>();
  const pageCounts = new Map<string, number>();
  for (const r of input.resources) {
    const subjectId = subjectIds.get(r.subjectId);
    // Re-derive semester from the subject (asserts denormalized consistency).
    const semesterOldId = subjectSemester.get(r.subjectId);
    const semesterId = semesterOldId ? semesterIds.get(semesterOldId) : undefined;
    if (!subjectId || !semesterId) throw new Error(`seed: unknown subject ${r.subjectId} for resource ${r.id}`);
    const doc = await Resource.findOneAndUpdate(
      { "file.key": `pending-migration/${r.id}.pdf` },
      {
        $set: {
          semesterId,
          subjectId,
          topicId: r.topicId ? topicIds.get(r.topicId) : undefined,
          title: r.title,
          description: r.description ?? "",
          type: r.type,
          // Mock seeds carry no customType label; placeholder until admin edits.
          customType: r.type === "custom" ? "General" : undefined,
          fileName: r.fileName,
          fileSize: r.fileSize,
          pageCount: r.pageCount,
          tags: r.tags ?? [],
          featured: false,
          status: "published",
          hidden: false,
          file: { key: `pending-migration/${r.id}.pdf`, bucket: DEV_BUCKET, mime: "application/pdf" },
        },
      },
      { upsert: true, returnDocument: "after" },
    ).exec();
    resourceIds.set(r.id, doc._id);
    pageCounts.set(r.id, r.pageCount);
  }

  for (const n of input.notices) {
    await Notice.findOneAndUpdate(
      { heading: n.heading },
      {
        $set: {
          subtext: n.subtext ?? "",
          type: n.type,
          announcer: n.announcer,
          date: new Date(n.date),
          priority: n.priority,
          status: n.status,
          publishedAt: n.status === "published" ? new Date() : undefined,
          showOnDashboard: n.showOnDashboard,
          pinned: n.pinned,
        },
      },
      { upsert: true, returnDocument: "after" },
    ).exec();
  }

  // Personal rows are replaced per user (idempotent re-runs).
  await Favorite.deleteMany({ userId }).exec();
  await Bookmark.deleteMany({ userId }).exec();
  await ReadingProgress.deleteMany({ userId }).exec();

  const favDocs = input.favorites
    .map((resourceId) => resourceIds.get(resourceId))
    .filter((id): id is NonNullable<typeof id> => Boolean(id))
    .map((targetId) => ({ userId, targetType: "resource" as const, targetId }));
  if (favDocs.length > 0) await Favorite.insertMany(favDocs);

  const bmDocs = input.bookmarks
    .map((b) => ({ ...b, targetId: resourceIds.get(b.resourceId) }))
    .filter((b): b is typeof b & { targetId: NonNullable<typeof b.targetId> } => Boolean(b.targetId))
    .map((b) => ({ userId, targetType: "resource" as const, targetId: b.targetId, page: b.page, note: b.note ?? "" }));
  if (bmDocs.length > 0) await Bookmark.insertMany(bmDocs);

  const pgDocs = input.progress
    .map((p) => ({ ...p, targetId: resourceIds.get(p.resourceId), total: pageCounts.get(p.resourceId) ?? 1 }))
    .filter((p) => Boolean(p.targetId))
    .map((p) => ({
      userId,
      resourceId: p.targetId as NonNullable<typeof p.targetId>,
      lastPage: p.lastPage,
      progress: Math.min(1, p.lastPage / p.total),
    }));
  if (pgDocs.length > 0) await ReadingProgress.insertMany(pgDocs);

  const [users, semesters, subjects, topics, resources, books, notices, favorites, bookmarks, readingProgress] =
    await Promise.all([
      User.countDocuments().exec(),
      Semester.countDocuments().exec(),
      Subject.countDocuments().exec(),
      Topic.countDocuments().exec(),
      Resource.countDocuments().exec(),
      Book.countDocuments().exec(),
      Notice.countDocuments().exec(),
      Favorite.countDocuments().exec(),
      Bookmark.countDocuments().exec(),
      ReadingProgress.countDocuments().exec(),
    ]);

  return { users, semesters, subjects, topics, resources, books, notices, favorites, bookmarks, readingProgress };
}
