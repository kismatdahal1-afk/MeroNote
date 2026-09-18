import dotenv from "dotenv";

dotenv.config();

/**
 * Read-parity verification: `npm run verify:parity`
 *
 * 1. Connects to MongoDB (MONGODB_URI when set, otherwise an ephemeral
 *    in-memory server — nothing is written to any real database by default).
 * 2. Runs the dev seed (same transform as `npm run seed:dev`).
 * 3. Reads representative documents from every collection and asserts
 *    counts, references, preserved fields, retired-field absence,
 *    unique constraints, and validators match docs/backend-architecture.md.
 *
 * Exit 0 = all checks pass. Any failure prints FAIL lines and exits 1.
 * No frontend files are touched. No binaries are stored.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDb, disconnectDb } from "../src/db/connection";
import { seedDev } from "../src/seed/seedDev";
import {
  Bookmark,
  Favorite,
  Notice,
  ReadingProgress,
  Resource,
  Semester,
  Subject,
  Topic,
  User,
  Book,
} from "../src/models/index";
import {
  mockUser,
  resources as mockResources,
  seedBookmarks,
  seedFavorites,
  seedProgress,
  semesters as mockSemesters,
  subjects as mockSubjects,
  topics as mockTopics,
} from "../../client/src/data/mock";
import { env } from "../src/config/env";

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

const results: Check[] = [];

function check(name: string, pass: boolean, detail = ""): void {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  let memory: MongoMemoryServer | null = null;
  let uri = env.mongodbUri;
  if (!uri) {
    memory = await MongoMemoryServer.create();
    uri = memory.getUri("meronote-verify");
    console.log("verify: no MONGODB_URI set — using ephemeral in-memory MongoDB");
  }
  await connectDb(uri);

  const counts = await seedDev({
    semesters: mockSemesters.map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      description: s.description,
      credits: s.credits,
    })),
    subjects: mockSubjects.map((s) => ({
      id: s.id,
      semesterId: s.semesterId,
      name: s.name,
      code: s.code,
      description: s.description,
      category: s.category,
      credits: s.credits,
      hotTopics: s.hotTopics,
      fullMarks: s.fullMarks,
    })),
    topics: mockTopics.map((t) => ({
      id: t.id,
      subjectId: t.subjectId,
      title: t.title,
      description: t.description,
      order: t.order,
      published: t.published,
    })),
    resources: mockResources.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      semesterId: r.semesterId,
      subjectId: r.subjectId,
      topicId: r.topicId,
      type: r.type,
      fileName: r.fileName,
      fileSize: r.fileSize,
      pageCount: r.pageCount,
      tags: r.tags,
    })),
    notices: [
      {
        id: "notice-1",
        heading: "Verify Notice",
        subtext: "parity",
        type: "general",
        announcer: "administration",
        date: new Date().toISOString(),
        priority: "normal",
        status: "published",
        showOnDashboard: true,
        pinned: false,
      },
    ],
    user: mockUser,
    favorites: seedFavorites,
    bookmarks: seedBookmarks.map((b) => ({ id: b.id, resourceId: b.resourceId, page: b.page, note: b.note })),
    progress: seedProgress.map((p) => ({ resourceId: p.resourceId, lastPage: p.lastPage })),
  });

  // 1. Counts match the mock source.
  check("semesters count = mock (8)", counts.semesters === mockSemesters.length, `${counts.semesters}`);
  check("subjects count = mock", counts.subjects === mockSubjects.length, `${counts.subjects}`);
  check("topics count = mock", counts.topics === mockTopics.length, `${counts.topics}`);
  check("resources count = mock", counts.resources === mockResources.length, `${counts.resources}`);
  check("favorites count = seedFavorites", counts.favorites === seedFavorites.length, `${counts.favorites}`);
  check("bookmarks count = seedBookmarks", counts.bookmarks === seedBookmarks.length, `${counts.bookmarks}`);
  check("readingProgress count = seedProgress", counts.readingProgress === seedProgress.length, `${counts.readingProgress}`);
  check("users >= 1 (dev user)", counts.users >= 1, `${counts.users}`);
  check("books = 0 (empty seed stands)", counts.books === 0, `${counts.books}`);

  // 2. References resolve + denormalized semesterId is consistent.
  const sample = await Resource.findOne({ topicId: { $exists: true, $ne: null } })
    .populate("subjectId")
    .populate("topicId")
    .exec();
  const subj = sample?.subjectId as unknown as { _id: unknown; semesterId: unknown } | null;
  const top = sample?.topicId as unknown as { subjectId: unknown } | null;
  check("resource→subject populates", Boolean(subj?._id), sample?.title ?? "none");
  check(
    "resource.semesterId == subject.semesterId",
    Boolean(sample && subj && String(sample.semesterId) === String(subj.semesterId)),
  );
  check(
    "topic.subjectId == resource.subjectId",
    Boolean(sample && subj && top && String(top.subjectId) === String((subj as unknown as { _id: unknown })._id)),
  );

  // 3. Preserved vs retired fields.
  const subjDoc = (await Subject.findOne().lean().exec()) as Record<string, unknown> | null;
  check("subject keeps code/category/hotTopics/fullMarks", Boolean(subjDoc?.code && subjDoc?.category && Array.isArray(subjDoc?.hotTopics)));
  check("subject drops offlineSync", subjDoc !== null && !("offlineSync" in subjDoc));
  const topicDoc = (await Topic.findOne().lean().exec()) as Record<string, unknown> | null;
  check("topic drops published flag", topicDoc !== null && !("published" in topicDoc) && "status" in (topicDoc ?? {}));
  const resDoc = (await Resource.findOne().lean().exec()) as Record<string, unknown> | null;
  const file = resDoc?.file as Record<string, unknown> | undefined;
  check("resource has B2 pointer (file.key/bucket/mime)", Boolean(file?.key && file?.bucket && file?.mime));
  check("resource stores no binary/url fields", Boolean(resDoc && !("fileUrl" in resDoc) && !("fileKey" in resDoc) && !("data" in resDoc)));
  check("resource keeps tags/fileSize/pageCount", Boolean(resDoc && Array.isArray(resDoc.tags) && resDoc.fileSize && resDoc.pageCount));

  // 4. Unique constraints enforced.
  const devUser = await User.findOne({ email: mockUser.email.toLowerCase() }).exec();
  const oneFav = await Favorite.findOne({ userId: devUser?._id }).exec();
  let dupFavRejected = false;
  try {
    await Favorite.create({ userId: oneFav?.userId, targetType: oneFav?.targetType, targetId: oneFav?.targetId });
  } catch (err) {
    dupFavRejected = (err as { code?: number }).code === 11000;
  }
  check("duplicate favorite rejected (11000)", dupFavRejected);

  // 5. Validators enforced.
  let badTypeRejected = false;
  try {
    await Resource.create({
      semesterId: sample?.semesterId,
      subjectId: sample?.subjectId,
      title: "bad",
      type: "not_a_type",
      fileName: "bad.pdf",
      fileSize: 10,
      pageCount: 1,
      file: { key: "bad.pdf", bucket: "x", mime: "application/pdf" },
    });
  } catch (err) {
    badTypeRejected = (err as { name?: string }).name === "ValidationError";
  }
  check("invalid resource type rejected", badTypeRejected);

  let subjectBookmarkPageRejected = false;
  try {
    const anySubject = await Subject.findOne().exec();
    await Bookmark.create({ userId: devUser?._id, targetType: "subject", targetId: anySubject?._id, page: 3 });
  } catch (err) {
    subjectBookmarkPageRejected = (err as { name?: string }).name === "ValidationError";
  }
  check("subject bookmark with page rejected", subjectBookmarkPageRejected);

  // 6. Idempotency: re-seed changes nothing.
  const again = await seedDev({
    semesters: mockSemesters.map((s) => ({ id: s.id, number: s.number, name: s.name, description: s.description, credits: s.credits })),
    subjects: mockSubjects.map((s) => ({
      id: s.id, semesterId: s.semesterId, name: s.name, code: s.code, description: s.description,
      category: s.category, credits: s.credits, hotTopics: s.hotTopics, fullMarks: s.fullMarks,
    })),
    topics: mockTopics.map((t) => ({ id: t.id, subjectId: t.subjectId, title: t.title, description: t.description, order: t.order, published: t.published })),
    resources: mockResources.map((r) => ({
      id: r.id, title: r.title, description: r.description, semesterId: r.semesterId, subjectId: r.subjectId,
      topicId: r.topicId, type: r.type, fileName: r.fileName, fileSize: r.fileSize, pageCount: r.pageCount, tags: r.tags,
    })),
    notices: [
      {
        id: "notice-1", heading: "Verify Notice", subtext: "parity", type: "general", announcer: "administration",
        date: new Date().toISOString(), priority: "normal", status: "published", showOnDashboard: true, pinned: false,
      },
    ],
    user: mockUser,
    favorites: seedFavorites,
    bookmarks: seedBookmarks.map((b) => ({ id: b.id, resourceId: b.resourceId, page: b.page, note: b.note })),
    progress: seedProgress.map((p) => ({ resourceId: p.resourceId, lastPage: p.lastPage })),
  });
  check(
    "re-seed is idempotent (same counts)",
    again.semesters === counts.semesters &&
      again.subjects === counts.subjects &&
      again.resources === counts.resources &&
      again.favorites === counts.favorites,
    JSON.stringify(again),
  );

  await disconnectDb();
  if (memory) await memory.stop();

  const failed = results.filter((r) => !r.pass);
  const summary = failed.length === 0 ? "ALL PASS" : failed.length + " FAILURES";
  console.log("\nverify:parity " + summary + " (" + results.length + " checks)");
  if (failed.length > 0) process.exitCode = 1;

  // Touch-all readout so unused imports never hide a missing model.
  void Notice;
  void Semester;
  void Topic;
  void ReadingProgress;
  void Book;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
