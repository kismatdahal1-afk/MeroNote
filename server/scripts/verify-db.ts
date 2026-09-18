import dotenv from "dotenv";

dotenv.config();

/**
 * Phase 2 database wiring verification: `npm run verify:db`
 *
 * Exercises the REAL server lifecycle against a live database:
 * - connectDb failure paths (missing URI, unreachable host)
 * - connect-before-serve + GET /api/health over HTTP
 * - seedDev after wiring (idempotent)
 * - all 7 required relationship chains via populate
 * - unique constraints, validators, key indexes
 * - repository soft-delete/restore + visibility filters
 * - basic data-layer CRUD
 * - graceful shutdown (HTTP close + disconnectDb)
 *
 * Uses MONGODB_URI when set, otherwise an ephemeral in-memory server.
 * Refuses NODE_ENV=production. Exit 0 = all checks pass.
 */

import type { Server } from "http";
import type { AddressInfo } from "net";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { connectDb, disconnectDb, isDbConnected } from "../src/db/connection";
import {
  liveFilter,
  liveResourceFilter,
  restoreDoc,
  softDelete,
  unlinkBookResources,
} from "../src/repositories/index";
import {
  Book,
  Bookmark,
  Favorite,
  Notice,
  ReadingProgress,
  Resource,
  Semester,
  Subject,
  Topic,
  User,
} from "../src/models/index";
import { seedDev } from "../src/seed/seedDev";
import { loadDevSeedInput, mockCounts } from "./devSeedInput";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function expectReject(
  name: string,
  fn: () => Promise<unknown>,
  expectedStart: string,
): Promise<void> {
  try {
    await fn();
    check(name, false, "expected rejection, resolved instead");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    check(name, message.startsWith(expectedStart), message.slice(0, 120));
  }
}

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("verify:db refuses to run with NODE_ENV=production.");
  }

  // 1. Failure paths first (before any connection exists).
  await expectReject("connectDb('') reports missing MONGODB_URI", () => connectDb(""), "MONGODB_URI is not set");
  await expectReject(
    "connectDb(unreachable) fails clearly",
    () => connectDb("mongodb://127.0.0.1:1/meronote-unreachable?directConnection=true"),
    "Failed to connect to MongoDB",
  );

  // 2. Real connection (env URI or ephemeral memory server).
  let memory: MongoMemoryServer | null = null;
  let uri = env.mongodbUri;
  if (!uri) {
    memory = await MongoMemoryServer.create();
    uri = memory.getUri("meronote-phase2");
    console.log("verify: no MONGODB_URI set — using ephemeral in-memory MongoDB");
  }
  await connectDb(uri);
  check("connectDb connects (readyState 1)", isDbConnected());
  await connectDb(uri);
  check("second connectDb reuses connection (no duplicate)", isDbConnected());

  // 3. HTTP lifecycle: serve only after connect, health stays green.
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const health = (await (await fetch(`http://127.0.0.1:${port}/api/health`)).json()) as {
    status?: string;
  };
  check("GET /api/health → ok after DB connect", health.status === "ok", JSON.stringify(health));

  // 4. Seed after wiring.
  const counts = await seedDev(loadDevSeedInput());
  const mock = mockCounts();
  check("seed semesters = mock (8)", counts.semesters === mock.semesters, `${counts.semesters}`);
  check("seed subjects = mock", counts.subjects === mock.subjects, `${counts.subjects}`);
  check("seed topics = mock", counts.topics === mock.topics, `${counts.topics}`);
  check("seed resources = mock", counts.resources === mock.resources, `${counts.resources}`);
  check("seed notices = 3", counts.notices === 3, `${counts.notices}`);

  const devUser = await User.findOne({ email: "aarav@example.com" }).exec();
  check("dev user seeded", Boolean(devUser));

  // 5. Relationship chains.
  const subject = await Subject.findOne().populate("semesterId").exec();
  const sem = subject?.semesterId as unknown as { name?: string } | null;
  check("Semester → Subject populates", Boolean(subject && sem?.name));

  const topic = await Topic.findOne().populate("subjectId").exec();
  check("Subject → Topic populates", Boolean((topic?.subjectId as unknown as { _id?: unknown })?._id));

  const resource = await Resource.findOne({ topicId: { $exists: true, $ne: null } })
    .populate("subjectId")
    .populate("topicId")
    .exec();
  const rSubject = resource?.subjectId as unknown as { _id?: unknown; semesterId?: unknown } | null;
  const rTopic = resource?.topicId as unknown as { subjectId?: unknown } | null;
  check(
    "Resource → Semester/Subject/Topic consistent",
    Boolean(
      resource &&
        rSubject &&
        rTopic &&
        String(resource.semesterId) === String(rSubject.semesterId) &&
        String(rTopic.subjectId) === String(rSubject._id),
    ),
    resource?.title ?? "none",
  );

  // Resource → Book (single-direction link + unlink maintenance).
  const hostSubject = await Subject.findOne().exec();
  const hostSemester = await Semester.findOne().exec();
  const book = await Book.create({
    semesterId: hostSemester?._id,
    subjectId: hostSubject?._id,
    title: "Phase2 Link Book",
    pageCount: 10,
    fileSize: 1024,
    status: "published",
  });
  const linked = await Resource.create({
    semesterId: hostSemester?._id,
    subjectId: hostSubject?._id,
    title: "Phase2 Linked Resource",
    type: "book",
    fileName: "phase2-link.pdf",
    fileSize: 1024,
    pageCount: 10,
    bookId: book._id,
    status: "published",
    file: { key: "phase2/link.pdf", bucket: "mero-note-dev", mime: "application/pdf" },
  });
  const populated = await Resource.findById(linked._id).populate("bookId").exec();
  check(
    "Resource → Book populates",
    (populated?.bookId as unknown as { title?: string })?.title === "Phase2 Link Book",
  );
  const unlinked = await unlinkBookResources(book._id);
  await Book.findByIdAndDelete(book._id).exec();
  const afterUnlink = await Resource.findById(linked._id).exec();
  check("book delete unlinks Resource.bookId", unlinked === 1 && afterUnlink?.bookId === undefined);
  await Resource.findByIdAndDelete(linked._id).exec();

  // User → personal data (+ favorites/bookmarks → user + target).
  const fav = await Favorite.findOne({ userId: devUser?._id }).populate("userId").exec();
  check(
    "Favorite → user + target",
    Boolean(
      fav &&
        (fav.userId as unknown as { email?: string }).email === "aarav@example.com" &&
        (await Resource.exists({ _id: fav.targetId })),
    ),
  );
  const bm = await Bookmark.findOne({ userId: devUser?._id }).exec();
  check(
    "Bookmark → user + resource target",
    Boolean(bm && String(bm.userId) === String(devUser?._id) && (await Resource.exists({ _id: bm.targetId }))),
  );
  const prog = await ReadingProgress.findOne({ userId: devUser?._id }).populate("resourceId").exec();
  check(
    "ReadingProgress → user + resource",
    Boolean(prog && (prog.resourceId as unknown as { title?: string })?.title),
  );
  // Subject-level targets (unified targetType model).
  const subjFav = await Favorite.create({ userId: devUser?._id, targetType: "subject", targetId: hostSubject?._id });
  const subjBm = await Bookmark.create({ userId: devUser?._id, targetType: "subject", targetId: hostSubject?._id });
  check(
    "subject favorite/bookmark resolve target",
    Boolean((await Subject.exists({ _id: subjFav.targetId })) && (await Subject.exists({ _id: subjBm.targetId }))),
  );
  await Favorite.findByIdAndDelete(subjFav._id).exec();
  await Bookmark.findByIdAndDelete(subjBm._id).exec();

  // 6. Constraints, validators, indexes.
  let dupEmail = false;
  try {
    await User.create({ name: "Dup", email: "aarav@example.com", passwordHash: "x", role: "USER" });
  } catch (err) {
    dupEmail = (err as { code?: number }).code === 11000;
  }
  check("duplicate email rejected (11000)", dupEmail);

  let dupProgress = false;
  try {
    await ReadingProgress.create({ userId: prog?.userId, resourceId: prog?.resourceId, lastPage: 1, progress: 0.1 });
  } catch (err) {
    dupProgress = (err as { code?: number }).code === 11000;
  }
  check("duplicate readingProgress rejected (11000)", dupProgress);

  let missingCustomType = false;
  try {
    await Resource.create({
      semesterId: hostSemester?._id,
      subjectId: hostSubject?._id,
      title: "custom without label",
      type: "custom",
      fileName: "custom.pdf",
      fileSize: 10,
      pageCount: 1,
      status: "draft",
      file: { key: "phase2/custom.pdf", bucket: "mero-note-dev", mime: "application/pdf" },
    });
  } catch (err) {
    missingCustomType = (err as { name?: string }).name === "ValidationError";
  }
  check("custom type without customType rejected", missingCustomType);

  // Await background index builds first: on a fresh database the check
  // below can otherwise race index creation and flake.
  await Promise.all([Resource.syncIndexes(), Favorite.syncIndexes(), ReadingProgress.syncIndexes()]);
  const resIndexes = await Resource.collection.indexes();
  const favIndexes = await Favorite.collection.indexes();
  const progIndexes = await ReadingProgress.collection.indexes();
  check(
    "resources text index exists",
    resIndexes.some((i) => i.name === "title_text_description_text_tags_text"),
  );
  check("favorites user_target unique exists", favIndexes.some((i) => i.name === "user_target" && i.unique));
  check("readingProgress user_resource unique exists", progIndexes.some((i) => i.name === "user_resource" && i.unique));

  // 7. Repository soft-delete + visibility filters.
  const victim = await Subject.findOne().exec();
  await softDelete(Subject, victim!._id);
  const hiddenFromLive = await Subject.findOne({ _id: victim!._id, ...liveFilter() }).exec();
  const visibleInTrash = await Subject.findOne({ _id: victim!._id, deletedAt: { $ne: null } }).exec();
  check("soft-deleted subject excluded from liveFilter", hiddenFromLive === null && visibleInTrash !== null);
  await restoreDoc(Subject, victim!._id);
  const restored = await Subject.findOne({ _id: victim!._id, ...liveFilter() }).exec();
  check("restored subject visible again", restored !== null);

  const resVictim = await Resource.findOne().exec();
  await Resource.findByIdAndUpdate(resVictim!._id, { $set: { hidden: true } }).exec();
  const hiddenExcluded = await Resource.findOne({ _id: resVictim!._id, ...liveResourceFilter() }).exec();
  await Resource.findByIdAndUpdate(resVictim!._id, { $set: { hidden: false } }).exec();
  check("hidden resource excluded from liveResourceFilter", hiddenExcluded === null);

  // 8. Basic data-layer CRUD (draft topic lifecycle).
  const draft = await Topic.create({ subjectId: hostSubject?._id, title: "Phase2 Draft", order: 999, status: "draft" });
  const renamed = await Topic.findByIdAndUpdate(draft._id, { $set: { title: "Phase2 Draft v2" } }, { returnDocument: "after" }).exec();
  await Topic.findByIdAndDelete(draft._id).exec();
  const gone = await Topic.findById(draft._id).exec();
  check("topic create/update/hard-delete", renamed?.title === "Phase2 Draft v2" && gone === null);

  // 9. Graceful shutdown path.
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  check("disconnectDb leaves readyState 0", mongoose.connection.readyState === 0 && !isDbConnected());

  if (memory) await memory.stop();

  // Keep unused model imports honest (all 10 collections touched above).
  void Notice;
  void Semester;

  console.log(`\nverify:db ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
