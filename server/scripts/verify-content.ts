import dotenv from "dotenv";

dotenv.config();

/**
 * Phase 4 content API verification: `npm run verify:content`
 *
 * Boots the REAL app against a live database (MONGODB_URI when set,
 * otherwise an ephemeral in-memory server), seeds the mock transform, and
 * asserts the read-only academic contract over HTTP:
 * semesters / subjects / topics / resources (+filters, pagination) /
 * books (+one-way link) / notices, envelope shape, 400/404 behavior,
 * and server-side visibility (draft, hidden, soft-deleted excluded).
 *
 * Refuses NODE_ENV=production. Exit 0 = all checks pass.
 */

import type { Server } from "http";
import type { AddressInfo } from "net";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { Book, Notice, Resource, Semester, Subject, Topic } from "../src/models/index";
import { seedDev } from "../src/seed/seedDev";
import { loadDevSeedInput } from "./devSeedInput";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("verify:content refuses to run with NODE_ENV=production.");
  }

  let memory: MongoMemoryServer | null = null;
  let uri = env.mongodbUri;
  if (!uri) {
    memory = await MongoMemoryServer.create();
    uri = memory.getUri("meronote-content");
    console.log("verify: no MONGODB_URI set — using ephemeral in-memory MongoDB");
  }
  await connectDb(uri);
  await seedDev(loadDevSeedInput());

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (path: string): Promise<{ status: number; json: any }> => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, json: await res.json() };
  };

  // 1. Semesters.
  const sems = await get("/api/semesters");
  const semList = sems.json.data as any[];
  check("semester list envelope + 8 ordered", sems.status === 200 && semList.length === 8 && semList[0].order === 1, `total=${sems.json.pagination?.total}`);
  const semId = semList[0]._id as string;
  const semDetail = await get(`/api/semesters/${semId}`);
  const semSubjects = semDetail.json.data?.subjects as any[];
  check(
    "semester detail embeds its subjects",
    semDetail.status === 200 && semSubjects.length > 0 && semSubjects.every((s) => String(s.semesterId) === semId),
    `subjects=${semSubjects.length}`,
  );

  // 2. Subjects.
  const noFilter = await get("/api/subjects");
  const badFilter = await get("/api/subjects?semesterId=nope");
  const subs = await get(`/api/subjects?semesterId=${semId}`);
  check("subject list requires valid semesterId", noFilter.status === 400 && badFilter.status === 400);
  check("subject list filtered", subs.status === 200 && (subs.json.data as any[]).length > 0);
  const subId = (subs.json.data as any[])[0]._id as string;
  const subDetail = await get(`/api/subjects/${subId}`);
  check(
    "subject detail embeds topics + resources",
    subDetail.status === 200 && Array.isArray(subDetail.json.data?.topics) && Array.isArray(subDetail.json.data?.resources),
  );

  // 3. Topics.
  const topicsNoFilter = await get("/api/topics");
  const topics = await get(`/api/topics?subjectId=${subId}`);
  const topicList = topics.json.data as any[];
  check("topic list requires subjectId", topicsNoFilter.status === 400);
  check(
    "topic list ordered",
    topics.status === 200 && topicList.every((t, i, a) => i === 0 || a[i - 1].order <= t.order),
    `count=${topicList.length}`,
  );
  if (topicList.length > 0) {
    const topicDetail = await get(`/api/topics/${topicList[0]._id}`);
    check("topic detail embeds resources", topicDetail.status === 200 && Array.isArray(topicDetail.json.data?.resources));
  } else {
    check("topic detail embeds resources", true, "subject has no topics — skipped");
  }

  // 4. Resources: filters + pagination.
  const all = await get("/api/resources?limit=100");
  const total = all.json.pagination?.total as number;
  check("resource list envelope + total", all.status === 200 && total === (all.json.data as any[]).length && total > 0, `total=${total}`);
  const bySubject = await get(`/api/resources?semesterId=${semId}&subjectId=${subId}&limit=100`);
  check(
    "resource subject filter",
    bySubject.status === 200 && (bySubject.json.data as any[]).every((r) => String(r.subjectId) === subId),
    `count=${(bySubject.json.data as any[]).length}`,
  );
  const byType = await get("/api/resources?type=past_paper&limit=100");
  check(
    "resource type filter",
    byType.status === 200 && (byType.json.data as any[]).length > 0 && (byType.json.data as any[]).every((r) => r.type === "past_paper"),
    `count=${(byType.json.data as any[]).length}`,
  );
  const badType = await get("/api/resources?type=not_a_type");
  check("invalid resource type → 400", badType.status === 400);
  const byTag = await get(`/api/resources?tag=exam&limit=100`);
  check(
    "resource tag filter",
    byTag.status === 200 && (byTag.json.data as any[]).length > 0 && (byTag.json.data as any[]).every((r) => (r.tags as string[]).includes("exam")),
    `count=${(byTag.json.data as any[]).length}`,
  );
  const combined = await get(`/api/resources?subjectId=${subId}&type=past_paper&limit=100`);
  check("combined filters narrow", combined.status === 200 && (combined.json.data as number[]).length <= (bySubject.json.data as number[]).length);
  const featured = await get("/api/resources?featured=true&limit=100");
  check("featured filter (seed: none) → total 0", featured.status === 200 && featured.json.pagination?.total === 0);
  const page2 = await get("/api/resources?limit=5&page=2");
  check(
    "pagination math",
    page2.status === 200 && (page2.json.data as any[]).length === 5 && page2.json.pagination?.pages === Math.ceil(total / 5),
    `pages=${page2.json.pagination?.pages}`,
  );
  const badPage = await get("/api/resources?page=0");
  const badLimit = await get("/api/resources?limit=101");
  check("bad page/limit → 400", badPage.status === 400 && badLimit.status === 400);
  const unknownParam = await get("/api/resources?limit=5&foo=bar");
  check("unknown query param ignored (no injection)", unknownParam.status === 200 && (unknownParam.json.data as any[]).length === 5);

  const oneRes = (all.json.data as any[])[0];
  const resDetail = await get(`/api/resources/${oneRes._id}`);
  check(
    "resource detail populates subject/topic",
    resDetail.status === 200 && resDetail.json.data?.subjectId?.code && typeof resDetail.json.data?.subjectId?.name === "string",
  );

  // 5. Books + one-way link.
  const books = await get("/api/books?limit=100");
  check("book list (seed: empty) → total 0", books.status === 200 && books.json.pagination?.total === 0);
  const hostSemester = semId;
  const book = await Book.create({
    semesterId: hostSemester,
    subjectId: subId,
    title: "Content Verify Book",
    author: "Verify Author",
    pageCount: 50,
    fileSize: 2048,
    status: "published",
  });
  const linkedRes = await Resource.create({
    semesterId: hostSemester,
    subjectId: subId,
    title: "Content Verify Linked",
    type: "book",
    fileName: "content-verify.pdf",
    fileSize: 2048,
    pageCount: 50,
    bookId: book._id,
    status: "published",
    file: { key: "content/verify.pdf", bucket: "mero-note-dev", mime: "application/pdf" },
  });
  const bookDetail = await get(`/api/books/${book._id}`);
  check(
    "book detail lists linked resources",
    bookDetail.status === 200 && (bookDetail.json.data?.resources as any[]).length === 1,
  );
  const linkedDetail = await get(`/api/resources/${linkedRes._id}`);
  check("resource detail populates book", linkedDetail.status === 200 && linkedDetail.json.data?.bookId?.title === "Content Verify Book");
  await Resource.findByIdAndDelete(linkedRes._id).exec();
  await Book.findByIdAndDelete(book._id).exec();

  // 6. Notices.
  const notices = await get("/api/notices?limit=100");
  check("notice list published only", notices.status === 200 && (notices.json.data as any[]).length === 3);
  const dash = await get("/api/notices?dashboard=true&limit=100");
  check(
    "dashboard filter",
    dash.status === 200 && (dash.json.data as any[]).every((n) => n.showOnDashboard === true),
  );
  const noticeDetail = await get(`/api/notices/${(notices.json.data as any[])[0]._id}`);
  check("notice detail 200", noticeDetail.status === 200);

  // 7. ID handling.
  const badId = await get("/api/semesters/not-an-id");
  const missing = await get("/api/semesters/000000000000000000000000");
  const missingRes = await get("/api/resources/000000000000000000000000");
  check("invalid id → 400", badId.status === 400);
  check("valid-but-missing id → 404", missing.status === 404 && missingRes.status === 404);

  // 8. Visibility: draft / hidden / soft-deleted never surface.
  // Flip a seeded semester to draft temporarily (numbers 1-8 are all taken
  // and schema-capped, so a scratch draft row cannot be inserted).
  const draftTarget = semList[semList.length - 1];
  await Semester.findByIdAndUpdate(draftTarget._id, { $set: { status: "draft" } }).exec();
  const draftListed = await get("/api/semesters?limit=100");
  const draftDetail = await get(`/api/semesters/${draftTarget._id}`);
  const draftExcluded =
    !(draftListed.json.data as any[]).some((s) => String(s._id) === String(draftTarget._id)) && draftDetail.status === 404;
  await Semester.findByIdAndUpdate(draftTarget._id, { $set: { status: "published" } }).exec();
  check("draft semester excluded + 404", draftExcluded);

  const hiddenRes = await Resource.create({
    semesterId: hostSemester,
    subjectId: subId,
    title: "Hidden Verify",
    type: "short_note",
    fileName: "hidden-verify.pdf",
    fileSize: 512,
    pageCount: 5,
    status: "published",
    hidden: true,
    file: { key: "content/hidden.pdf", bucket: "mero-note-dev", mime: "application/pdf" },
  });
  const hiddenListed = await get(`/api/resources?subjectId=${subId}&limit=100`);
  const hiddenDetail = await get(`/api/resources/${hiddenRes._id}`);
  check(
    "hidden resource excluded + 404",
    !(hiddenListed.json.data as any[]).some((r) => String(r._id) === String(hiddenRes._id)) && hiddenDetail.status === 404,
  );
  await Resource.findByIdAndDelete(hiddenRes._id).exec();

  const trashed = await Resource.create({
    semesterId: hostSemester,
    subjectId: subId,
    title: "Trashed Verify",
    type: "short_note",
    fileName: "trashed-verify.pdf",
    fileSize: 512,
    pageCount: 5,
    status: "published",
    file: { key: "content/trashed.pdf", bucket: "mero-note-dev", mime: "application/pdf" },
  });
  await Resource.findByIdAndUpdate(trashed._id, { $set: { deletedAt: new Date() } }).exec();
  const trashListed = await get(`/api/resources?subjectId=${subId}&limit=100`);
  const trashDetail = await get(`/api/resources/${trashed._id}`);
  check(
    "soft-deleted resource excluded + 404",
    !(trashListed.json.data as any[]).some((r) => String(r._id) === String(trashed._id)) && trashDetail.status === 404,
  );
  await Resource.findByIdAndDelete(trashed._id).exec();

  const draftNotice = await Notice.create({
    heading: "Draft Verify Notice",
    type: "general",
    announcer: "administration",
    date: new Date(),
    priority: "low",
    status: "draft",
  });
  const draftNoticeListed = await get("/api/notices?limit=100");
  const draftNoticeDetail = await get(`/api/notices/${draftNotice._id}`);
  check(
    "draft notice excluded + 404",
    !(draftNoticeListed.json.data as any[]).some((n) => String(n._id) === String(draftNotice._id)) && draftNoticeDetail.status === 404,
  );
  await Notice.findByIdAndDelete(draftNotice._id).exec();

  // 9. Health untouched.
  const health = await get("/api/health");
  check("GET /api/health still ok", health.status === 200 && health.json.status === "ok");

  // Touch-all readout so unused imports never hide a missing model.
  void Subject;
  void Topic;

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  if (memory) await memory.stop();

  console.log(`\nverify:content ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
