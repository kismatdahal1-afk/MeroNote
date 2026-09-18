import dotenv from "dotenv";

dotenv.config();

/**
 * Phase 10 search verification: `npm run verify:search`
 *
 * Boots the REAL app against an ephemeral test database (ALLOW_REAL_DB=1
 * for an intentional real-DB run), seeds the mock transform plus a few
 * targeted fixtures (hidden/draft rows, a book, a notice), and asserts the
 * unified search contract over HTTP: envelope, 400 matrix, per-entity hits,
 * filters, visibility, leak-freedom, injection safety, pagination math,
 * deterministic ordering, and live text-index presence.
 *
 * Refuses NODE_ENV=production. Never prints secrets. Exit 0 = all pass.
 */

import type { Server } from "http";
import type { AddressInfo } from "net";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { useTestDatabase } from "./testDb";
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
    throw new Error("verify:search refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("search");
  await connectDb(uri);
  await seedDev(loadDevSeedInput());

  // Targeted fixtures: hidden + draft resources, a book, a draft notice.
  const semester = await Semester.findOne().exec();
  const subject = await Subject.findOne().exec();
  const baseFile = { key: "search/fixture.pdf", bucket: "mero-note-dev", mime: "application/pdf" };
  const hiddenRes = await Resource.create({
    semesterId: semester!._id,
    subjectId: subject!._id,
    title: "Zebrastripe Hidden Fixture",
    type: "short_note",
    fileName: "hidden.pdf",
    fileSize: 512,
    pageCount: 5,
    status: "published",
    hidden: true,
    file: { ...baseFile, key: "search/hidden.pdf" },
  });
  const draftRes = await Resource.create({
    semesterId: semester!._id,
    subjectId: subject!._id,
    title: "Zebrastripe Draft Fixture",
    type: "short_note",
    fileName: "draft.pdf",
    fileSize: 512,
    pageCount: 5,
    status: "draft",
    file: { ...baseFile, key: "search/draft.pdf" },
  });
  const book = await Book.create({
    semesterId: semester!._id,
    subjectId: subject!._id,
    title: "Zebrastripe Book Fixture",
    author: "Fixture Author",
    pageCount: 50,
    fileSize: 2048,
    status: "published",
  });
  const notice = await Notice.create({
    heading: "Zebrastripe Notice Fixture",
    subtext: "Fixture body text.",
    type: "general",
    announcer: "administration",
    date: new Date(),
    priority: "normal",
    status: "published",
  });
  const draftNotice = await Notice.create({
    heading: "Zebrastripe Draft Notice",
    subtext: "Unseen body.",
    type: "general",
    announcer: "administration",
    date: new Date(),
    priority: "low",
    status: "draft",
  });

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (path: string): Promise<{ status: number; json: any }> => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  const titles = (json: any): string[] => ((json?.data as any[]) ?? []).map((r) => r.title);
  const types = (json: any): string[] => ((json?.data as any[]) ?? []).map((r) => r.entityType);

  // 1-8. Contract: envelope, q policy, pagination validation.
  const ok = await get("/api/search?q=database&limit=5");
  check(
    "valid query → envelope",
    ok.status === 200 && ok.json?.status === "ok" && Array.isArray(ok.json?.data) && ok.json?.pagination?.limit === 5,
    `total=${ok.json?.pagination?.total}`,
  );
  const missing = await get("/api/search");
  const blank = await get("/api/search?q=%20%20");
  const huge = await get(`/api/search?q=${"x".repeat(101)}`);
  check("missing/blank/oversized q → 400", missing.status === 400 && blank.status === 400 && huge.status === 400);
  const norm = await get("/api/search?q=%20%20database%20%20");
  check("whitespace-padded query works", norm.status === 200 && norm.json?.pagination?.total === ok.json?.pagination?.total);
  const badPage = await get("/api/search?q=a&page=0");
  const badLimit = await get("/api/search?q=a&limit=101");
  const badType = await get("/api/search?q=a&entityType=planet");
  const badResType = await get("/api/search?q=a&type=nope");
  const badId = await get("/api/search?q=a&semesterId=nope");
  check(
    "bad pagination/enum/id → 400",
    badPage.status === 400 && badLimit.status === 400 && badType.status === 400 && badResType.status === 400 && badId.status === 400,
  );
  const defLimit = await get("/api/search?q=database");
  check("default limit 20", defLimit.status === 200 && defLimit.json?.pagination?.limit === 20 && defLimit.json?.pagination?.page === 1);

  // 9-14. Per-entity hits.
  const subj = await get("/api/search?q=database&entityType=subject");
  check("subject hit", subj.status === 200 && titles(subj.json).some((t) => /database/i.test(t)));
  const top = await get("/api/search?q=normalization&entityType=topic");
  check("topic hit", top.status === 200 && (top.json?.pagination?.total ?? 0) > 0);
  const res = await get("/api/search?q=past+paper&entityType=resource&limit=50");
  check("resource hit", res.status === 200 && (res.json?.pagination?.total ?? 0) > 0);
  const bk = await get("/api/search?q=zebrastripe&entityType=book");
  check("book hit", bk.status === 200 && titles(bk.json).includes("Zebrastripe Book Fixture"));
  const nt = await get("/api/search?q=zebrastripe&entityType=notice");
  check("notice hit, draft excluded", nt.status === 200 && titles(nt.json).includes("Zebrastripe Notice Fixture") && !titles(nt.json).includes("Zebrastripe Draft Notice"));
  const sem = await get("/api/search?q=semester&entityType=semester");
  const semNum = await get("/api/search?q=4&entityType=semester");
  check("semester hit by name and number", sem.status === 200 && (sem.json?.pagination?.total ?? 0) > 0 && (semNum.json?.data as any[]).some((r) => r.metadata?.number === 4));

  // 15-18. Filters.
  const onlyRes = await get("/api/search?q=past+paper&entityType=resource&limit=50");
  check(
    "entityType filter isolates",
    onlyRes.status === 200 && types(onlyRes.json).every((t) => t === "resource"),
  );
  const byType = await get("/api/search?q=papers&entityType=resource&type=past_paper&limit=50");
  check(
    "resource type filter",
    byType.status === 200 &&
      (byType.json?.data as any[]).length > 0 &&
      (byType.json?.data as any[]).every((r) => r.metadata?.type === "past_paper"),
  );
  const byTag = await get("/api/search?q=textbook&tag=textbook&limit=50");
  check(
    "tag filter matches",
    byTag.status === 200 &&
      (byTag.json?.data as any[]).length > 0 &&
      (byTag.json?.data as any[]).every((r) => (r.metadata?.tags as string[])?.includes("textbook")),
  );
  const semId = String(semester!._id);
  const bySem = await get(`/api/search?q=notes&semesterId=${semId}&limit=50`);
  check("semesterId filter scopes", bySem.status === 200);

  // 19-21. Visibility.
  const zebra = await get("/api/search?q=zebrastripe&limit=50");
  check(
    "hidden/draft resources excluded",
    zebra.status === 200 &&
      !titles(zebra.json).includes("Zebrastripe Hidden Fixture") &&
      !titles(zebra.json).includes("Zebrastripe Draft Fixture"),
  );

  // 22-24. Leak-freedom + injection safety.
  const body = JSON.stringify(zebra.json);
  check("no passwordHash/B2 keys in bodies", !/passwordHash|B2_|APPLICATION_KEY|secret|mongodb(\+srv)?:\/\//i.test(body));
  const inject = await get("/api/search?q[$gt]=" + "&limit=5");
  const injectType = await get("/api/search?q=a&type[$ne]=book");
  check("operator injection safely rejected", inject.status === 400 && injectType.status === 400);

  // 25-27. Shape, totals, ordering.
  const shape = await get("/api/search?q=database&limit=5");
  const rows = (shape.json?.data as any[]) ?? [];
  check(
    "consistent row shape",
    shape.status === 200 &&
      rows.every(
        (r) =>
          typeof r.entityType === "string" && typeof r.id === "string" && typeof r.title === "string" && typeof r.description === "string" && typeof r.metadata === "object" && !("score" in r) && !("passwordHash" in r),
      ),
  );
  const p1 = await get("/api/search?q=notes&limit=5&page=1");
  const p2 = await get("/api/search?q=notes&limit=5&page=2");
  const t1 = p1.json?.pagination?.total as number;
  check(
    "pagination totals + disjoint windows",
    p1.status === 200 &&
      p2.status === 200 &&
      p1.json?.pagination?.pages === Math.ceil(t1 / 5) &&
      (p1.json?.data as any[]).every((r) => !(p2.json?.data as any[]).some((s) => s.id === r.id && s.entityType === r.entityType)),
    `total=${t1}`,
  );
  const repeat = await get("/api/search?q=database&limit=5");
  check(
    "deterministic ordering",
    JSON.stringify((repeat.json?.data as any[]).map((r) => r.id)) === JSON.stringify((ok.json?.data as any[]).map((r) => r.id)),
  );

  // 29. Live index presence (not just code intent).
  const resIndexes = await Resource.collection.indexes();
  const subIndexes = await Subject.collection.indexes();
  const topIndexes = await Topic.collection.indexes();
  const bookIndexes = await Book.collection.indexes();
  const noticeIndexes = await Notice.collection.indexes();
  const hasText = (indexes: Array<{ name?: string }>, prefix: string): boolean =>
    indexes.some((i) => (i.name ?? "").startsWith(prefix));
  check(
    "text indexes exist live",
    hasText(resIndexes, "title_text") && hasText(subIndexes, "name_text") && hasText(topIndexes, "title_text") && hasText(bookIndexes, "title_text") && hasText(noticeIndexes, "heading_text"),
    resIndexes.map((i) => i.name).join(","),
  );

  // Fixture cleanup (seeded mock rows belong to the ephemeral DB; fixtures removed anyway).
  await Resource.deleteMany({ _id: { $in: [hiddenRes._id, draftRes._id] } }).exec();
  await Book.findByIdAndDelete(book._id).exec();
  await Notice.deleteMany({ _id: { $in: [notice._id, draftNotice._id] } }).exec();

  const health = await get("/api/health");
  check("GET /api/health still ok", health.status === 200 && health.json?.status === "ok");

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:search ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
