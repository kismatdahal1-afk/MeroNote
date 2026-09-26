import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-continue-reading-only-test-secret";
}

/**
 * Phase 21 verification: `npm run verify:continue-reading`
 *
 * Boots the REAL app against an ephemeral database (ALLOW_REAL_DB=1 for an
 * intentional real-DB run) and asserts the user-controlled Continue Reading
 * contract over HTTP: explicit add/remove, idempotency, no auto-add from
 * opens/progress, progress+recents untouched by removal, isolation,
 * persistence across sessions, validation.
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
  const [{ ReadingProgress, Resource, Semester, Subject, User, UserPreferences }] = await Promise.all([
    import("../src/models/index"),
  ]);

  if (env.nodeEnv === "production") {
    throw new Error("verify:continue-reading refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("continue-reading");
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
      name: "Continue User",
      email,
      password: "continue-password-123",
      confirmPassword: "continue-password-123",
    });
    if (res.status !== 201) throw new Error(`fixture register failed for ${email}: ${res.status}`);
    return cookieOf(res.setCookie);
  };
  const cookieA = await mkUser("cra@example.com");
  const cookieB = await mkUser("crb@example.com");
  const userA = (await User.findOne({ email: "cra@example.com" }).exec())!;
  const userB = (await User.findOne({ email: "crb@example.com" }).exec())!;

  const semester = await Semester.create({ number: 1, name: "CR Sem", order: 1, status: "published" });
  const subject = await Subject.create({
    semesterId: semester._id,
    name: "CR Subject",
    code: "CR101",
    category: "core",
    status: "published",
  });
  const mkResource = (title: string): Promise<any> =>
    Resource.create({
      semesterId: semester._id,
      subjectId: subject._id,
      title,
      type: "short_note",
      fileName: "cr.pdf",
      fileSize: 1024,
      pageCount: 140,
      status: "published",
      file: { key: `cr/${title}.pdf`, bucket: "mero-note-dev", mime: "application/pdf" },
    }) as Promise<any>;
  const resX: any = await mkResource("Resource X");
  const resY: any = await mkResource("Resource Y");
  const rX = String(resX._id);
  const rY = String(resY._id);

  const readingOf = async (cookie: string): Promise<string[]> => {
    const res = await authed("GET", "/api/me/preferences", cookie);
    return ((res.json?.data as any)?.continueReading as string[]) ?? [];
  };

  // 1. Explicit add: 201 first time, member afterwards.
  const add1 = await authed("PUT", `/api/me/preferences/continue-reading/${rX}`, cookieA);
  const list1 = await readingOf(cookieA);
  check(
    "1. explicit add 201 + listed",
    add1.status === 201 && list1.length === 1 && list1[0] === rX,
    `st=${add1.status} n=${list1.length}`,
  );

  // 2. Duplicate add prevention: repeat + concurrent adds → single entry.
  const addDup = await authed("PUT", `/api/me/preferences/continue-reading/${rX}`, cookieA);
  const conc = await Promise.all(
    Array.from({ length: 5 }, () => authed("PUT", `/api/me/preferences/continue-reading/${rX}`, cookieA)),
  );
  const list2 = await readingOf(cookieA);
  check(
    "2. duplicate adds idempotent (200s, one entry)",
    addDup.status === 200 && conc.every((r) => r.status === 200) && list2.length === 1,
    `dup=${addDup.status} n=${list2.length}`,
  );

  // 3. Opens and progress never create membership.
  await authed("POST", "/api/me/preferences/recent", cookieA, { resourceId: rY });
  await authed("PUT", `/api/me/progress/${rY}`, cookieA, { lastPage: 47 });
  const list3 = await readingOf(cookieA);
  check("3. open + progress do not auto-add", list3.length === 1 && !list3.includes(rY));

  // 4. Remove: entry gone, progress + recents intact.
  const del = await authed("DELETE", `/api/me/preferences/continue-reading/${rX}`, cookieA);
  const list4 = await readingOf(cookieA);
  const prog = await authed("GET", `/api/me/progress/${rY}`, cookieA);
  const prefs = await authed("GET", "/api/me/preferences", cookieA);
  const recents = ((prefs.json?.data as any)?.recentResources as any[]) ?? [];
  check(
    "4. remove drops membership only (progress + recents intact)",
    del.status === 200 &&
      del.json?.data?.removed === true &&
      list4.length === 0 &&
      prog.json?.data?.lastPage === 47 &&
      recents.some((e) => String(e.resourceId) === rY),
  );
  const delAgain = await authed("DELETE", `/api/me/preferences/continue-reading/${rX}`, cookieA);
  check("4b. repeat remove idempotent removed:false", delAgain.status === 200 && delAgain.json?.data?.removed === false);

  // 5. Validation matrix.
  const badId = await authed("PUT", "/api/me/preferences/continue-reading/nope", cookieA);
  const unknown = await authed("PUT", "/api/me/preferences/continue-reading/000000000000000000000000", cookieA);
  const anonPut = await authed("PUT", `/api/me/preferences/continue-reading/${rX}`, null);
  const anonDel = await authed("DELETE", `/api/me/preferences/continue-reading/${rX}`, null);
  const anonGet = await authed("GET", "/api/me/preferences", null);
  check(
    "5. bad id → 400, unknown → 404, anon → 401",
    badId.status === 400 && unknown.status === 404 && anonPut.status === 401 && anonDel.status === 401 && anonGet.status === 401,
    `${badId.status},${unknown.status},${anonPut.status},${anonDel.status},${anonGet.status}`,
  );

  // 6. Isolation: A adds X; B sees nothing; B adds Y; A sees only X.
  await authed("PUT", `/api/me/preferences/continue-reading/${rX}`, cookieA);
  const bList = await readingOf(cookieB);
  await authed("PUT", `/api/me/preferences/continue-reading/${rY}`, cookieB);
  const aList = await readingOf(cookieA);
  const bList2 = await readingOf(cookieB);
  check(
    "6. A/B isolation (X↔A, Y↔B, no cross-visibility)",
    bList.length === 0 && aList.length === 1 && aList[0] === rX && bList2.length === 1 && bList2[0] === rY,
    `a=${aList.map((id) => id.slice(-4))} b=${bList2.map((id) => id.slice(-4))}`,
  );
  // B cannot remove A's entry.
  const bDelA = await authed("DELETE", `/api/me/preferences/continue-reading/${rX}`, cookieB);
  const aAfter = await readingOf(cookieA);
  check(
    "6b. B removing A's id touches nothing of A's",
    bDelA.status === 200 && bDelA.json?.data?.removed === false && aAfter.includes(rX),
  );

  // 7. Persistence shape: prefs GET carries the list; doc has unique user index.
  const prefsA = await authed("GET", "/api/me/preferences", cookieA);
  const indexes = (await UserPreferences.collection.indexes()) as Array<{ name?: string }>;
  check(
    "7. prefs GET includes list; user_unique index present",
    Array.isArray((prefsA.json?.data as any)?.continueReading) &&
      (prefsA.json?.data as any)?.continueReading.includes(rX) &&
      UserPreferences.collection.name === "user_preferences" &&
      indexes.some((i) => i.name === "user_unique"),
    indexes.map((i) => i.name).join(","),
  );

  // Cleanup.
  await UserPreferences.deleteMany({ userId: { $in: [userA._id, userB._id] } }).exec();
  await ReadingProgress.deleteMany({ userId: { $in: [userA._id, userB._id] } }).exec();
  await Resource.deleteMany({ _id: { $in: [resX._id, resY._id] } }).exec();
  await Subject.findByIdAndDelete(subject._id).exec();
  await Semester.findByIdAndDelete(semester._id).exec();
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } }).exec();
  const leftovers = await Promise.all([
    UserPreferences.countDocuments({ userId: { $in: [userA._id, userB._id] } }).exec(),
    ReadingProgress.countDocuments({ userId: { $in: [userA._id, userB._id] } }).exec(),
    User.countDocuments({ _id: { $in: [userA._id, userB._id] } }).exec(),
  ]);
  check("fixtures fully cleaned up", leftovers.every((n) => n === 0), leftovers.join(","));

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:continue-reading ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
