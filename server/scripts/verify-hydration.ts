import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-hydration-only-test-secret";
}

/**
 * Phase 17 hydration verification: `npm run verify:hydration`
 *
 * Boots the REAL app against an ephemeral database (ALLOW_REAL_DB=1 for an
 * intentional real-DB run) and asserts the authenticated lifecycle contract:
 * A populates favorites/bookmarks/progress/semester-plan → B sees only B →
 * A re-login restores A → merge idempotency → pagination envelope honesty
 * (>100 records, no silent truncation) → 401 matrix.
 *
 * All fixtures are tracked and deleted afterwards; nothing permanent remains.
 * Refuses NODE_ENV=production. Never prints secrets. Exit 0 = all pass.
 */

import type { Server } from "http";
import type { AddressInfo } from "net";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const [{ createApp }] = await Promise.all([import("../src/app")]);
  const [{ env }] = await Promise.all([import("../src/config/env")]);
  const [{ connectDb, disconnectDb }] = await Promise.all([import("../src/db/connection")]);
  const [{ useTestDatabase }] = await Promise.all([import("./testDb")]);
  const [{ Bookmark, Favorite, ReadingProgress, Resource, Semester, Subject, User, UserSemesterPlan }] =
    await Promise.all([import("../src/models/index")]);

  if (env.nodeEnv === "production") {
    throw new Error("verify:hydration refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("hydration");
  await connectDb(uri);

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const authed = async (
    method: string,
    path: string,
    cookie: string | null,
    body?: unknown,
  ): Promise<{ status: number; json: any; setCookie: string | null }> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null), setCookie: res.headers.get("set-cookie") };
  };
  const cookieOf = (setCookie: string | null): string => (setCookie ? setCookie.split(";")[0] : "");

  const mkUser = async (email: string): Promise<string> => {
    const res = await authed("POST", "/api/auth/register", null, {
      name: "Hydration User",
      email,
      password: "hydration-password-123",
      confirmPassword: "hydration-password-123",
    });
    if (res.status !== 201) throw new Error(`fixture register failed for ${email}: ${res.status}`);
    return cookieOf(res.setCookie);
  };
  const cookieA = await mkUser("hyda@example.com");
  const cookieB = await mkUser("hydb@example.com");

  const semester = await Semester.create({ number: 1, name: "Hydration Sem", order: 1, status: "published" });
  const subject = await Subject.create({
    semesterId: semester._id,
    name: "Hydration Subject",
    code: "HYD101",
    category: "core",
    status: "published",
  });
  const mkResource = (title: string): Promise<any> =>
    Resource.create({
      semesterId: semester._id,
      subjectId: subject._id,
      title,
      type: "short_note",
      fileName: "hydration.pdf",
      fileSize: 1024,
      pageCount: 100,
      status: "published",
      file: { key: `hydration/${title}.pdf`, bucket: "mero-note-dev", mime: "application/pdf" },
    }) as Promise<any>;
  const resA: any = await mkResource("Resource A");
  const resB: any = await mkResource("Resource B");
  const resC: any = await mkResource("Resource C");
  const resAId = String(resA._id);
  const resBId = String(resB._id);
  const resCId = String(resC._id);
  const subId = String(subject._id);
  const semId = String(semester._id);

  // A populates the full Phase 17 set: favorite + bookmark + progress + plan.
  const aFav = await authed("PUT", `/api/me/favorites/resource/${resAId}`, cookieA);
  const aFavSub = await authed("PUT", `/api/me/favorites/subject/${subId}`, cookieA);
  const aBm = await authed("POST", "/api/me/bookmarks", cookieA, {
    targetType: "resource",
    targetId: resBId,
    page: 10,
    note: "ch2",
  });
  const aProg = await authed("PUT", `/api/me/progress/${resCId}`, cookieA, { lastPage: 25 });
  const aPlan = await authed("PATCH", `/api/me/semester-plan/${semId}`, cookieA, {
    status: "ongoing",
    startDate: "2026-09-01",
    endDate: "2027-01-15",
  });
  check(
    "A populates fav/bookmark/progress/plan",
    aFav.status === 201 && aFavSub.status === 201 && aBm.status === 201 && aProg.status === 200 && aPlan.status === 200,
    `${aFav.status},${aFavSub.status},${aBm.status},${aProg.status},${aPlan.status}`,
  );

  // B on the same backend sees only B (empty): isolation across the set.
  const [bFav, bBm, bProg, bPlan] = await Promise.all([
    authed("GET", "/api/me/favorites", cookieB),
    authed("GET", "/api/me/bookmarks", cookieB),
    authed("GET", "/api/me/progress", cookieB),
    authed("GET", "/api/me/semester-plan", cookieB),
  ]);
  check(
    "B sees only B (empty across fav/bookmark/progress/plan)",
    bFav.json?.pagination?.total === 0 &&
      bBm.json?.pagination?.total === 0 &&
      bProg.json?.pagination?.total === 0 &&
      Array.isArray(bPlan.json?.data) &&
      bPlan.json.data.length === 0,
    `fav=${bFav.json?.pagination?.total} bm=${bBm.json?.pagination?.total} prog=${bProg.json?.pagination?.total} plan=${bPlan.json?.data?.length}`,
  );

  // B writes own state; A is unaffected (independence, not just emptiness).
  const bOwn = await authed("PUT", `/api/me/favorites/resource/${resBId}`, cookieB);
  const aFavAgain = await authed("GET", "/api/me/favorites", cookieA);
  const aFavIds = ((aFavAgain.json?.data as any[]) ?? []).map((r) => String(r.targetId)).sort();
  check(
    "B writes independently; A keeps exactly A's rows",
    bOwn.status === 201 && aFavAgain.json?.pagination?.total === 2 && aFavIds.includes(resAId) && aFavIds.includes(subId),
    aFavIds.join(","),
  );

  // A "re-login" restores the full set with fields intact.
  const [aFavR, aBmR, aProgR, aPlanR] = await Promise.all([
    authed("GET", "/api/me/favorites", cookieA),
    authed("GET", "/api/me/bookmarks", cookieA),
    authed("GET", `/api/me/progress/${resCId}`, cookieA),
    authed("GET", "/api/me/semester-plan", cookieA),
  ]);
  const aBmRow = ((aBmR.json?.data as any[]) ?? [])[0];
  const aPlanRow = ((aPlanR.json?.data as any[]) ?? []).find((r: any) => r.semesterId === semId);
  check(
    "A re-login restores fav/bookmark/progress/plan with fields",
    aFavR.json?.pagination?.total === 2 &&
      aBmRow?.page === 10 &&
      aBmRow?.note === "ch2" &&
      aProgR.json?.data?.lastPage === 25 &&
      aPlanRow?.status === "ongoing" &&
      aPlanRow?.startDate === "2026-09-01" &&
      aPlanRow?.endDate === "2027-01-15",
  );

  // Guest-merge safety: re-saving A's guest-equivalent rows is idempotent.
  const reFav = await authed("PUT", `/api/me/favorites/resource/${resAId}`, cookieA);
  const reBm = await authed("POST", "/api/me/bookmarks", cookieA, {
    targetType: "resource",
    targetId: resBId,
    page: 10,
    note: "ch2",
  });
  const userA = (await User.findOne({ email: "hyda@example.com" }).exec())!;
  const [favCount, bmCount] = await Promise.all([
    Favorite.countDocuments({ userId: userA._id }).exec(),
    Bookmark.countDocuments({ userId: userA._id }).exec(),
  ]);
  check(
    "merge-equivalent re-saves are idempotent (no duplicates)",
    reFav.status === 200 && reBm.status === 200 && favCount === 2 && bmCount === 1,
    `fav=${favCount} bm=${bmCount}`,
  );

  // Pagination envelope honesty: 105 favorites → total/pages reflect reality.
  const bulk: any[] = [];
  for (let i = 0; i < 105; i += 1) {
    bulk.push({
      semesterId: semester._id,
      subjectId: subject._id,
      title: `Bulk ${i}`,
      type: "short_note",
      fileName: "bulk.pdf",
      fileSize: 512,
      pageCount: 10,
      status: "published",
      file: { key: `hydration/bulk-${i}.pdf`, bucket: "mero-note-dev", mime: "application/pdf" },
    });
  }
  const bulkDocs = await Resource.insertMany(bulk);
  for (const doc of bulkDocs) {
    const r = await authed("PUT", `/api/me/favorites/resource/${String(doc._id)}`, cookieB);
    if (r.status !== 201) throw new Error(`bulk favorite failed: ${r.status}`);
  }
  const pg1 = await authed("GET", "/api/me/favorites?limit=100", cookieB);
  const pg2 = await authed("GET", "/api/me/favorites?limit=100&page=2", cookieB);
  const p1rows = (pg1.json?.data as any[]) ?? [];
  const p2rows = (pg2.json?.data as any[]) ?? [];
  check(
    "pagination envelope honest beyond 100 rows (fetch-all can complete)",
    pg1.json?.pagination?.total === 106 &&
      pg1.json?.pagination?.pages === 2 &&
      p1rows.length === 100 &&
      p2rows.length === 6,
    `total=${pg1.json?.pagination?.total} pages=${pg1.json?.pagination?.pages} p1=${p1rows.length} p2=${p2rows.length}`,
  );

  // 401 matrix across the hydration set.
  const anon = await Promise.all([
    authed("GET", "/api/me/favorites", null),
    authed("GET", "/api/me/bookmarks", null),
    authed("GET", "/api/me/progress", null),
    authed("GET", "/api/me/semester-plan", null),
  ]);
  check(
    "unauthenticated hydration → 401 everywhere",
    anon.every((r) => r.status === 401),
    anon.map((r) => r.status).join(","),
  );

  // Cleanup: every fixture row removed (scoped deletes, no dropDatabase).
  const userB = (await User.findOne({ email: "hydb@example.com" }).exec())!;
  const userIds = [userA._id, userB._id];
  await Promise.all([
    Favorite.deleteMany({ userId: { $in: userIds } }).exec(),
    Bookmark.deleteMany({ userId: { $in: userIds } }).exec(),
    ReadingProgress.deleteMany({ userId: { $in: userIds } }).exec(),
    UserSemesterPlan.deleteMany({ userId: { $in: userIds } }).exec(),
  ]);
  await Resource.deleteMany({ _id: { $in: [resA._id, resB._id, resC._id, ...bulkDocs.map((d) => d._id)] } }).exec();
  await Subject.findByIdAndDelete(subject._id).exec();
  await Semester.findByIdAndDelete(semester._id).exec();
  await User.deleteMany({ _id: { $in: userIds } }).exec();
  const leftovers = await Promise.all([
    Favorite.countDocuments({ userId: { $in: userIds } }).exec(),
    Bookmark.countDocuments({ userId: { $in: userIds } }).exec(),
    ReadingProgress.countDocuments({ userId: { $in: userIds } }).exec(),
    UserSemesterPlan.countDocuments({ userId: { $in: userIds } }).exec(),
    Resource.countDocuments({ _id: resA._id }).exec(),
    User.countDocuments({ _id: { $in: userIds } }).exec(),
  ]);
  check("fixtures fully cleaned up", leftovers.every((n) => n === 0), leftovers.join(","));

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:hydration ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
