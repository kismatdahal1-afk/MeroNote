import dotenv from "dotenv";

dotenv.config();

// Test-only JWT fallback, assigned here at module evaluation — before main()
// dynamic-imports the env-dependent modules below (static imports would hoist
// past this assignment, as in verify-auth.ts).
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-personal-only-test-secret";
}

/**
 * Phase 7 personal-study verification: `npm run verify:personal-study`
 *
 * Boots the REAL app against an ephemeral database (ALLOW_REAL_DB=1 for an
 * intentional real-DB run), creates temporary users + academic fixtures, and
 * asserts the authenticated personal-data contract over HTTP:
 * 401 matrix / favorites idempotent CRUD + visibility / bookmarks CRUD +
 * PATCH + duplicates / progress upsert + validation / cross-user isolation
 * (USER B and ADMIN cannot touch USER A's rows) / regressions.
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
  const [{ Favorite, Bookmark, ReadingProgress, Resource, Semester, Subject, User }] = await Promise.all([
    import("../src/models/index"),
  ]);

  if (env.nodeEnv === "production") {
    throw new Error("verify:personal-study refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("personal");
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

  // Fixtures: two users (A, B) + admin, one semester/subject, live + hidden + draft resources.
  const mkUser = async (email: string): Promise<string> => {
    const res = await authed("POST", "/api/auth/register", null, {
      name: "Study User",
      email,
      password: "study-password-123",
      confirmPassword: "study-password-123",
    });
    if (res.status !== 201) throw new Error(`fixture register failed for ${email}: ${res.status}`);
    return cookieOf(res.setCookie);
  };
  const cookieA = await mkUser("usera@example.com");
  const cookieB = await mkUser("userb@example.com");
  const cookieAdmin = await mkUser("adminx@example.com");
  await User.findOneAndUpdate({ email: "adminx@example.com" }, { $set: { role: "ADMIN" } }).exec();
  const adminRe = await authed("POST", "/api/auth/login", null, { email: "adminx@example.com", password: "study-password-123" });
  const adminCookie = cookieOf(adminRe.setCookie);

  const semester = await Semester.create({ number: 1, name: "Personal Sem", order: 1, status: "published" });
  const subject = await Subject.create({
    semesterId: semester._id,
    name: "Personal Subject",
    code: "PRS101",
    category: "core",
    status: "published",
  });
  const mkResource = (title: string, extra: Record<string, unknown> = {}): Promise<any> =>
    Resource.create({
      semesterId: semester._id,
      subjectId: subject._id,
      title,
      type: "short_note",
      fileName: "personal.pdf",
      fileSize: 1024,
      pageCount: 100,
      status: "published",
      file: { key: `personal/${title}.pdf`, bucket: "mero-note-dev", mime: "application/pdf" },
      ...extra,
    }) as Promise<any>;
  const liveRes: any = await mkResource("Live Resource");
  const hiddenRes: any = await mkResource("Hidden Resource", { hidden: true });
  const draftRes: any = await mkResource("Draft Resource", { status: "draft" });
  const resId = String(liveRes._id);
  const subId = String(subject._id);

  // 1. Auth matrix.
  const anonList = await authed("GET", "/api/me/favorites", null);
  const anonPut = await authed("PUT", `/api/me/favorites/resource/${resId}`, null);
  const anonProg = await authed("PUT", `/api/me/progress/${resId}`, null, { lastPage: 5 });
  check("unauthenticated → 401", anonList.status === 401 && anonPut.status === 401 && anonProg.status === 401);

  // 2-8. Favorites (USER A).
  const fav1 = await authed("PUT", `/api/me/favorites/resource/${resId}`, cookieA);
  const favDup = await authed("PUT", `/api/me/favorites/resource/${resId}`, cookieA);
  const favSub = await authed("PUT", `/api/me/favorites/subject/${subId}`, cookieA);
  check("favorite create 201, idempotent 200", fav1.status === 201 && favDup.status === 200);
  check("subject favorite 201", favSub.status === 201);
  const favList = await authed("GET", "/api/me/favorites", cookieA);
  const favRows = (favList.json?.data as any[]) ?? [];
  check(
    "favorite list envelope + 2 rows",
    favList.status === 200 && favList.json?.pagination?.total === 2 && favRows.length === 2,
  );
  check(
    "favorite rows carry resolved target summaries",
    favRows.some((r) => r.targetType === "resource" && r.target?.title === "Live Resource") &&
      favRows.some((r) => r.targetType === "subject" && r.target?.name === "Personal Subject"),
    JSON.stringify(favRows.map((r) => r.target)),
  );
  const badType = await authed("PUT", "/api/me/favorites/video/000000000000000000000000", cookieA);
  const badId = await authed("PUT", "/api/me/favorites/resource/nope", cookieA);
  const hiddenFav = await authed("PUT", `/api/me/favorites/resource/${hiddenRes._id}`, cookieA);
  const missingFav = await authed("PUT", "/api/me/favorites/resource/000000000000000000000000", cookieA);
  check("invalid targetType/id → 400", badType.status === 400 && badId.status === 400);
  check("hidden/missing target → 404", hiddenFav.status === 404 && missingFav.status === 404);
  const delFav = await authed("DELETE", `/api/me/favorites/resource/${resId}`, cookieA);
  const delFavAgain = await authed("DELETE", `/api/me/favorites/resource/${resId}`, cookieA);
  check(
    "favorite delete idempotent",
    delFav.status === 200 && delFav.json?.data?.removed === true && delFavAgain.status === 200 && delFavAgain.json?.data?.removed === false,
  );

  // 9-15. Bookmarks (USER A).
  const bm1 = await authed("POST", "/api/me/bookmarks", cookieA, { targetType: "resource", targetId: resId, page: 10, note: "ch2" });
  const bmDup = await authed("POST", "/api/me/bookmarks", cookieA, { targetType: "resource", targetId: resId, page: 20 });
  check("bookmark create 201, duplicate 200 existing", bm1.status === 201 && bmDup.status === 200 && bmDup.json?.data?.page === 10);
  const bmId = String(bm1.json?.data?._id ?? bmDup.json?.data?._id);
  const bmSubPage = await authed("POST", "/api/me/bookmarks", cookieA, { targetType: "subject", targetId: subId, page: 3 });
  const bmBadPage = await authed("POST", "/api/me/bookmarks", cookieA, { targetType: "resource", targetId: resId, page: 0 });
  const bmOverPage = await authed("POST", "/api/me/bookmarks", cookieB, { targetType: "resource", targetId: resId, page: 500 });
  check("subject+page / bad page / over-page → 400", bmSubPage.status === 400 && bmBadPage.status === 400 && bmOverPage.status === 400);
  const bmList = await authed("GET", "/api/me/bookmarks", cookieA);
  const bmRows = (bmList.json?.data as any[]) ?? [];
  check("bookmark list has A's row", bmList.status === 200 && bmRows.some((b) => String(b._id) === bmId));
  check(
    "bookmark row carries resolved target summary",
    bmRows.some((b) => String(b._id) === bmId && b.target?.title === "Live Resource"),
  );
  const bmPatch = await authed("PATCH", `/api/me/bookmarks/${bmId}`, cookieA, { note: "updated note", page: 42 });
  check("bookmark PATCH updates", bmPatch.status === 200 && bmPatch.json?.data?.note === "updated note" && bmPatch.json?.data?.page === 42);
  const bmPatchBad = await authed("PATCH", `/api/me/bookmarks/${bmId}`, cookieA, { page: 500 });
  check("bookmark PATCH over-page → 400", bmPatchBad.status === 400);

  // Cross-user bookmark isolation (row still exists).
  const bPatchA = await authed("PATCH", `/api/me/bookmarks/${bmId}`, cookieB, { note: "hijack" });
  const bDelA = await authed("DELETE", `/api/me/bookmarks/${bmId}`, cookieB);
  const bListHas = await authed("GET", "/api/me/bookmarks", cookieB);
  check(
    "USER B cannot touch A's bookmark",
    bPatchA.status === 404 && bDelA.status === 404 && !(bListHas.json?.data as any[]).some((b) => String(b._id) === bmId),
  );
  const aDel = await authed("DELETE", `/api/me/bookmarks/${bmId}`, cookieA);
  const aDelAgain = await authed("DELETE", `/api/me/bookmarks/${bmId}`, cookieA);
  check("owner delete 200, repeat 404", aDel.status === 200 && aDelAgain.status === 404);

  // 16-20. Reading progress (USER A).
  const put1 = await authed("PUT", `/api/me/progress/${resId}`, cookieA, { lastPage: 25 });
  check("progress upsert 200 + computed fraction", put1.status === 200 && put1.json?.data?.lastPage === 25 && put1.json?.data?.progress === 0.25);
  const put2 = await authed("PUT", `/api/me/progress/${resId}`, cookieA, { lastPage: 50 });
  const progCount = await ReadingProgress.countDocuments({ userId: (await User.findOne({ email: "usera@example.com" }).exec())!._id }).exec();
  check("progress update, still one row", put2.status === 200 && put2.json?.data?.progress === 0.5 && progCount === 1);
  const getOne = await authed("GET", `/api/me/progress/${resId}`, cookieA);
  const getMissing = await authed("GET", "/api/me/progress/000000000000000000000000", cookieA);
  check("progress get 200 / missing 404", getOne.status === 200 && getOne.json?.data?.lastPage === 50 && getMissing.status === 404);
  const overPage = await authed("PUT", `/api/me/progress/${resId}`, cookieA, { lastPage: 500 });
  const zeroPage = await authed("PUT", `/api/me/progress/${resId}`, cookieA, { lastPage: 0 });
  const floatPage = await authed("PUT", `/api/me/progress/${resId}`, cookieA, { lastPage: 2.5 });
  const missingRes = await authed("PUT", "/api/me/progress/000000000000000000000000", cookieA, { lastPage: 5 });
  check(
    "invalid progress rejected",
    overPage.status === 400 && zeroPage.status === 400 && floatPage.status === 400 && missingRes.status === 404,
  );
  const progList = await authed("GET", "/api/me/progress", cookieA);
  check("progress list envelope", progList.status === 200 && progList.json?.pagination?.total === 1);

  // Cross-user progress isolation + ADMIN scoped to self.
  const bGetA = await authed("GET", `/api/me/progress/${resId}`, cookieB);
  const bPut = await authed("PUT", `/api/me/progress/${resId}`, cookieB, { lastPage: 7 });
  const aStill = await authed("GET", `/api/me/progress/${resId}`, cookieA);
  check(
    "B cannot read A; B's write is a separate row",
    bGetA.status === 404 && bPut.status === 200 && bPut.json?.data?.progress === 0.07 && aStill.json?.data?.lastPage === 50,
  );
  const adminFavs = await authed("GET", "/api/me/favorites", adminCookie);
  check("ADMIN sees only own favorites", adminFavs.status === 200 && adminFavs.json?.pagination?.total === 0);
  const bDelFav = await authed("DELETE", `/api/me/favorites/subject/${subId}`, cookieB);
  const aFavStill = await authed("GET", "/api/me/favorites", cookieA);
  check(
    "B deleting A's target removes nothing of A's",
    bDelFav.status === 200 && bDelFav.json?.data?.removed === false && aFavStill.json?.pagination?.total === 1,
  );

  // Regressions.
  const content = await authed("GET", `/api/subjects?semesterId=${semester._id}`, null);
  const me = await authed("GET", "/api/auth/me", cookieA);
  const file = await authed("GET", `/api/resources/${resId}/file`, null);
  const healthRes = await fetch(`${base}/api/health`);
  check(
    "regressions: content + auth + file + health",
    content.status === 200 && me.status === 200 && file.status === 503 && healthRes.status === 200,
  );

  // Cleanup: every fixture row removed (scoped deletes, no dropDatabase).
  const userA = await User.findOne({ email: "usera@example.com" }).exec();
  const userB = await User.findOne({ email: "userb@example.com" }).exec();
  const userAdmin = await User.findOne({ email: "adminx@example.com" }).exec();
  const userIds = [userA, userB, userAdmin].map((u) => u!._id);
  await Promise.all([
    Favorite.deleteMany({ userId: { $in: userIds } }).exec(),
    Bookmark.deleteMany({ userId: { $in: userIds } }).exec(),
    ReadingProgress.deleteMany({ userId: { $in: userIds } }).exec(),
  ]);
  await Resource.deleteMany({ _id: { $in: [liveRes._id, hiddenRes._id, draftRes._id] } }).exec();
  await Subject.findByIdAndDelete(subject._id).exec();
  await Semester.findByIdAndDelete(semester._id).exec();
  await User.deleteMany({ _id: { $in: userIds } }).exec();
  const leftovers = await Promise.all([
    Favorite.countDocuments({ userId: { $in: userIds } }).exec(),
    Bookmark.countDocuments({ userId: { $in: userIds } }).exec(),
    ReadingProgress.countDocuments({ userId: { $in: userIds } }).exec(),
    Resource.countDocuments({ _id: { $in: [liveRes._id] } }).exec(),
    User.countDocuments({ _id: { $in: userIds } }).exec(),
  ]);
  check("fixtures fully cleaned up", leftovers.every((n) => n === 0), leftovers.join(","));

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:personal-study ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
