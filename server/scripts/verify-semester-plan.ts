import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-semester-plan-only-test-secret";
}

/**
 * Phase 16 semester-plan verification: `npm run verify:semester-plan`
 *
 * Boots the REAL app against an ephemeral database (ALLOW_REAL_DB=1 for an
 * intentional real-DB run), creates temporary users + semester fixtures, and
 * asserts the authenticated user_semester_plans contract over HTTP:
 * ownership / validation / one-ongoing enforcement / cross-user isolation.
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
  const [{ Semester, User, UserSemesterPlan }] = await Promise.all([import("../src/models/index")]);

  if (env.nodeEnv === "production") {
    throw new Error("verify:semester-plan refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("semester-plan");
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
      name: "Semester User",
      email,
      password: "semester-password-123",
      confirmPassword: "semester-password-123",
    });
    if (res.status !== 201) throw new Error(`fixture register failed for ${email}: ${res.status}`);
    return cookieOf(res.setCookie);
  };
  const cookieA = await mkUser("sema@example.com");
  const cookieB = await mkUser("semb@example.com");
  const userA = (await User.findOne({ email: "sema@example.com" }).exec())!;
  const userB = (await User.findOne({ email: "semb@example.com" }).exec())!;

  const sem1 = await Semester.create({ number: 1, name: "Plan Sem 1", order: 1, status: "published" });
  const sem2 = await Semester.create({ number: 2, name: "Plan Sem 2", order: 2, status: "published" });
  const sem3 = await Semester.create({ number: 3, name: "Plan Sem 3", order: 3, status: "published" });
  const draftSem = await Semester.create({ number: 4, name: "Draft Sem", order: 4, status: "draft" });
  const s1 = String(sem1._id);
  const s2 = String(sem2._id);
  const s3 = String(sem3._id);

  // 1. Authenticated user can fetch own (empty) semester plan.
  const empty = await authed("GET", "/api/me/semester-plan", cookieA);
  check(
    "1. authed fetch own plan (empty)",
    empty.status === 200 && empty.json?.status === "ok" && Array.isArray(empty.json?.data),
  );

  // 2. Unauthenticated request rejected.
  const anonGet = await authed("GET", "/api/me/semester-plan", null);
  const anonPatch = await authed("PATCH", `/api/me/semester-plan/${s1}`, null, { status: "ongoing" });
  check("2. unauthenticated → 401", anonGet.status === 401 && anonPatch.status === 401);

  // 3. Ownership derives from session: no userId accepted, B cannot touch A.
  // The forged userId must be ignored — the created row belongs to B.
  const evil = await authed("PATCH", `/api/me/semester-plan/${s1}`, cookieB, {
    status: "ongoing",
    userId: String(userA._id),
  } as unknown as Record<string, unknown>);
  const aAfterEvil = await authed("GET", "/api/me/semester-plan", cookieA);
  const bAfterEvil = await authed("GET", "/api/me/semester-plan", cookieB);
  const aRows = (aAfterEvil.json?.data as any[]) ?? [];
  const bRowsEvil = (bAfterEvil.json?.data as any[]) ?? [];
  check(
    "3. forged userId ignored: row owned by caller, A untouched",
    evil.status === 200 &&
      String((evil.json?.data as any)?.userId) === String(userB._id) &&
      !aRows.some((r) => r.semesterId === s1) &&
      bRowsEvil.some((r) => r.semesterId === s1 && String(r.userId) === String(userB._id)),
    `evil owner=${String((evil.json?.data as any)?.userId)}`,
  );

  // 4. Valid semester update succeeds (dates + status).
  const upd = await authed("PATCH", `/api/me/semester-plan/${s1}`, cookieA, {
    status: "ongoing",
    startDate: "2026-09-01",
    endDate: "2027-01-15",
  });
  check(
    "4. valid update succeeds",
    upd.status === 200 &&
      upd.json?.data?.status === "ongoing" &&
      upd.json?.data?.startDate === "2026-09-01" &&
      upd.json?.data?.endDate === "2027-01-15",
    JSON.stringify(upd.json?.data),
  );

  // 5. Invalid semester rejected (bad id → 400, unknown id → 404, draft → 404).
  const badId = await authed("PATCH", "/api/me/semester-plan/nope", cookieA, { status: "ongoing" });
  const unknown = await authed("PATCH", "/api/me/semester-plan/000000000000000000000000", cookieA, {
    status: "ongoing",
  });
  const draft = await authed("PATCH", `/api/me/semester-plan/${draftSem._id}`, cookieA, { status: "ongoing" });
  check("5. invalid semester rejected", badId.status === 400 && unknown.status === 404 && draft.status === 404);

  // 6. Invalid status rejected.
  const badStatus = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, { status: "active" });
  const emptyBody = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, {});
  check("6. invalid status / empty body → 400", badStatus.status === 400 && emptyBody.status === 400);

  // 7. endDate <= startDate rejected.
  const badDates = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, {
    status: "upcoming",
    startDate: "2027-01-15",
    endDate: "2026-09-01",
  });
  const equalDates = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, {
    startDate: "2026-09-01",
    endDate: "2026-09-01",
  });
  const badFormat = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, {
    startDate: "09/01/2026",
    endDate: "2027-01-15",
  });
  check("7. endDate <= startDate rejected", badDates.status === 400 && equalDates.status === 400 && badFormat.status === 400);

  // 8. Ongoing with invalid dates rejected (product rule: end > start).
  const ongoingBad = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, {
    status: "ongoing",
    startDate: "2027-05-01",
    endDate: "2027-01-01",
  });
  check("8. ongoing with invalid dates → 400", ongoingBad.status === 400);

  // 9. Multiple upcoming/passed plans allowed.
  const up2 = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, { status: "upcoming" });
  const passed3 = await authed("PATCH", `/api/me/semester-plan/${s3}`, cookieA, { status: "passed" });
  check("9. multiple upcoming/passed allowed", up2.status === 200 && passed3.status === 200);

  // 10. Two ongoing plans rejected; 11. switching demotes previous.
  const second = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, {
    status: "ongoing",
    startDate: "2026-09-01",
    endDate: "2027-01-15",
  });
  const planAfter = await authed("GET", "/api/me/semester-plan", cookieA);
  const rowsAfter = (planAfter.json?.data as any[]) ?? [];
  const ongoingRows = rowsAfter.filter((r) => r.status === "ongoing");
  const firstRow = rowsAfter.find((r) => r.semesterId === s1);
  check(
    "10/11. switch ongoing demotes previous (exactly one ongoing)",
    second.status === 200 && ongoingRows.length === 1 && ongoingRows[0].semesterId === s2 && firstRow?.status !== "ongoing",
    JSON.stringify(rowsAfter.map((r) => ({ s: r.semesterId.slice(-4), st: r.status }))),
  );

  // 12. Duplicate user+semester does not create duplicate rows.
  const dup = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieA, { status: "ongoing" });
  const dupCount = await UserSemesterPlan.countDocuments({ userId: userA._id, semesterId: sem2._id }).exec();
  check("12. no duplicate rows", dup.status === 200 && dupCount === 1);

  // 13. Different users plan the same semester independently.
  const bOwn = await authed("PATCH", `/api/me/semester-plan/${s2}`, cookieB, {
    status: "ongoing",
    startDate: "2026-10-01",
    endDate: "2027-02-01",
  });
  const bPlan = await authed("GET", "/api/me/semester-plan", cookieB);
  const aPlan = await authed("GET", "/api/me/semester-plan", cookieA);
  const bRows = (bPlan.json?.data as any[]) ?? [];
  const aRows2 = (aPlan.json?.data as any[]) ?? [];
  check(
    "13. users independent (same semester, own rows)",
    bOwn.status === 200 &&
      bRows.some((r) => r.semesterId === s2 && r.status === "ongoing" && r.startDate === "2026-10-01") &&
      aRows2.some((r) => r.semesterId === s2 && r.status === "ongoing" && r.startDate === "2026-09-01"),
  );

  // 14. Partial updates preserve unrelated fields (s3 is "passed" from check 9).
  const datesOnly = await authed("PATCH", `/api/me/semester-plan/${s3}`, cookieA, {
    startDate: "2026-09-01",
    endDate: "2027-01-15",
  });
  check(
    "14. dates-only PATCH preserves status",
    datesOnly.status === 200 &&
      datesOnly.json?.data?.status === "passed" &&
      datesOnly.json?.data?.startDate === "2026-09-01" &&
      datesOnly.json?.data?.endDate === "2027-01-15",
    JSON.stringify(datesOnly.json?.data),
  );
  const statusOnly = await authed("PATCH", `/api/me/semester-plan/${s3}`, cookieA, { status: "upcoming" });
  check(
    "15. status-only PATCH preserves dates",
    statusOnly.status === 200 &&
      statusOnly.json?.data?.status === "upcoming" &&
      statusOnly.json?.data?.startDate === "2026-09-01" &&
      statusOnly.json?.data?.endDate === "2027-01-15",
    JSON.stringify(statusOnly.json?.data),
  );

  // 16. Concurrent promotions converge to exactly one ongoing (no duplicates).
  const [c1, c2] = await Promise.all([
    authed("PATCH", `/api/me/semester-plan/${s1}`, cookieA, { status: "ongoing" }),
    authed("PATCH", `/api/me/semester-plan/${s3}`, cookieA, { status: "ongoing" }),
  ]);
  const concurrent = await authed("GET", "/api/me/semester-plan", cookieA);
  const cRows = (concurrent.json?.data as any[]) ?? [];
  const cOngoing = cRows.filter((r) => r.status === "ongoing");
  const cSemCount = new Set(cRows.map((r) => `${r.userId}:${r.semesterId}`)).size;
  check(
    "16. concurrent ongoing switches: one ongoing, no duplicate rows",
    (c1.status === 200 || c1.status === 409) &&
      (c2.status === 200 || c2.status === 409) &&
      cOngoing.length === 1 &&
      cRows.length === cSemCount,
    `c1=${c1.status} c2=${c2.status} ongoing=${cOngoing.length} rows=${cRows.length}`,
  );

  // Indexes exist: unique user_semester + partial user_ongoing_unique.
  const indexes = (await UserSemesterPlan.collection.indexes()) as Array<{ name?: string; partialFilterExpression?: unknown }>;
  const names = indexes.map((i) => i.name);
  check(
    "indexes: user_semester + user_ongoing_unique + user_status",
    names.includes("user_semester") && names.includes("user_ongoing_unique") && names.includes("user_status"),
    names.join(","),
  );

  // Collection name is user_semester_plans in the existing database.
  check("collection is user_semester_plans", UserSemesterPlan.collection.name === "user_semester_plans");

  // Cleanup.
  await UserSemesterPlan.deleteMany({ userId: { $in: [userA._id, userB._id] } }).exec();
  await Semester.deleteMany({ _id: { $in: [sem1._id, sem2._id, sem3._id, draftSem._id] } }).exec();
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } }).exec();
  const leftovers = await Promise.all([
    UserSemesterPlan.countDocuments({ userId: { $in: [userA._id, userB._id] } }).exec(),
    User.countDocuments({ _id: { $in: [userA._id, userB._id] } }).exec(),
  ]);
  check("fixtures fully cleaned up", leftovers.every((n) => n === 0), leftovers.join(","));

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:semester-plan ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
