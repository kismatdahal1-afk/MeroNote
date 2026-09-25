import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-phase19-only-test-secret";
}

/**
 * Phase 19 verification: `npm run verify:phase19`
 *
 * Boots the REAL app against an ephemeral database (ALLOW_REAL_DB=1 for an
 * intentional real-DB run) and asserts the download lifecycle, verification,
 * recent history, and preferences contracts over HTTP:
 * history remove / re-download reactivation / PATCH verify+size (no reorder)
 * / orphan-safe isolation / atomic bounded recents / prefs shape / 401s.
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
  const [{ DownloadHistory, Resource, Semester, Subject, User, UserPreferences }] = await Promise.all([
    import("../src/models/index"),
  ]);

  if (env.nodeEnv === "production") {
    throw new Error("verify:phase19 refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("phase19");
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
      email,
      password: "phase19-password-123",
      confirmPassword: "phase19-password-123",
    });
    if (res.status !== 201) throw new Error(`fixture register failed for ${email}: ${res.status}`);
    return cookieOf(res.setCookie);
  };
  const cookieA = await mkUser("p19a@example.com");
  const cookieB = await mkUser("p19b@example.com");
  const userA = (await User.findOne({ email: "p19a@example.com" }).exec())!;
  const userB = (await User.findOne({ email: "p19b@example.com" }).exec())!;

  const semester = await Semester.create({ number: 1, name: "P19 Sem", order: 1, status: "published" });
  const subject = await Subject.create({
    semesterId: semester._id,
    name: "P19 Subject",
    code: "P19101",
    category: "core",
    status: "published",
  });
  const mkResource = (title: string): Promise<any> =>
    Resource.create({
      semesterId: semester._id,
      subjectId: subject._id,
      title,
      type: "short_note",
      fileName: "p19.pdf",
      fileSize: 1024,
      pageCount: 10,
      status: "published",
      file: { key: `p19/${title}.pdf`, bucket: "mero-note-dev", mime: "application/pdf" },
    }) as Promise<any>;
  const res1: any = await mkResource("P19 One");
  const res2: any = await mkResource("P19 Two");
  const r1 = String(res1._id);
  const r2 = String(res2._id);

  // 1. Remove from history (Sequence A/B basis): PUT → DELETE → gone.
  await authed("PUT", `/api/me/downloads/${r1}`, cookieA, { fileSize: 1024 });
  const del = await authed("DELETE", `/api/me/downloads/${r1}`, cookieA);
  const afterDel = await authed("GET", "/api/me/downloads", cookieA);
  check(
    "1. DELETE removes history row (idempotent shape)",
    del.status === 200 && del.json?.data?.removed === true && afterDel.json?.pagination?.total === 0,
    `st=${del.status} total=${afterDel.json?.pagination?.total}`,
  );
  const delAgain = await authed("DELETE", `/api/me/downloads/${r1}`, cookieA);
  check("1b. repeat DELETE idempotent removed:false", delAgain.status === 200 && delAgain.json?.data?.removed === false);
  const delBad = await authed("DELETE", "/api/me/downloads/nope", cookieA);
  const delAnon = await authed("DELETE", `/api/me/downloads/${r1}`, null);
  check("1c. bad id → 400, anon → 401", delBad.status === 400 && delAnon.status === 401);

  // 2. Re-download reactivates with no duplicate row.
  const re1 = await authed("PUT", `/api/me/downloads/${r1}`, cookieA, { fileSize: 2048 });
  const reCount = await DownloadHistory.countDocuments({ userId: userA._id, resourceId: res1._id }).exec();
  check(
    "2. re-download reactivates, single row, refreshed size",
    re1.status === 201 && reCount === 1 && re1.json?.data?.fileSize === 2048,
    `st=${re1.status} n=${reCount}`,
  );

  // 3. PATCH verify + size without reordering.
  const before = await authed("GET", "/api/me/downloads", cookieA);
  const beforeAt = String((before.json?.data as any[])[0]?.downloadedAt);
  const patch = await authed("PATCH", `/api/me/downloads/${r1}`, cookieA, { verify: true, fileSize: 4096 });
  const prow = patch.json?.data;
  check(
    "3. PATCH stamps verification + size, keeps downloadedAt",
    patch.status === 200 &&
      typeof prow?.lastVerifiedAt === "string" &&
      prow?.fileSize === 4096 &&
      String(prow?.downloadedAt) === beforeAt,
    `st=${patch.status} lv=${prow?.lastVerifiedAt}`,
  );
  const patchEmpty = await authed("PATCH", `/api/me/downloads/${r1}`, cookieA, {});
  const patchBad = await authed("PATCH", `/api/me/downloads/${r1}`, cookieA, { fileSize: 0 });
  const patchMissing = await authed("PATCH", `/api/me/downloads/${r2}`, cookieA, { verify: true });
  const patchAnon = await authed("PATCH", `/api/me/downloads/${r1}`, null, { verify: true });
  check(
    "3b. PATCH validation (empty/bad → 400, missing → 404, anon → 401)",
    patchEmpty.status === 400 && patchBad.status === 400 && patchMissing.status === 404 && patchAnon.status === 401,
    `${patchEmpty.status},${patchBad.status},${patchMissing.status},${patchAnon.status}`,
  );

  // 4. Cross-user lifecycle isolation: B cannot delete A's row.
  const bDelA = await authed("DELETE", `/api/me/downloads/${r1}`, cookieB);
  const aStill = await authed("GET", "/api/me/downloads", cookieA);
  check(
    "4. B DELETE on A's resource removes nothing of A's",
    bDelA.status === 200 && bDelA.json?.data?.removed === false && aStill.json?.pagination?.total === 1,
  );

  // 5. Preferences GET shape for a fresh user (no doc created implicitly... read-only).
  const prefsB = await authed("GET", "/api/me/preferences", cookieB);
  check(
    "5. prefs GET returns bounded recents shape",
    prefsB.status === 200 &&
      Array.isArray(prefsB.json?.data?.recentResources) &&
      prefsB.json.data.recentResources.length === 0,
  );
  const prefsAnon = await authed("GET", "/api/me/preferences", null);
  check("5b. prefs anon → 401", prefsAnon.status === 401);

  // 6. Recent: first open creates, reopen moves to front without duplicates.
  const bulkRes: any[] = [];
  for (let i = 0; i < 25; i += 1) {
    bulkRes.push({
      semesterId: semester._id,
      subjectId: subject._id,
      title: `P19 Bulk ${i}`,
      type: "short_note",
      fileName: "bulk.pdf",
      fileSize: 512,
      pageCount: 5,
      status: "published",
      file: { key: `p19/bulk-${i}.pdf`, bucket: "mero-note-dev", mime: "application/pdf" },
    });
  }
  const bulkDocs = await Resource.insertMany(bulkRes);
  const bulkIds = bulkDocs.map((d: any) => String(d._id));
  for (const id of bulkIds) {
    const r = await authed("POST", "/api/me/preferences/recent", cookieA, { resourceId: id });
    if (r.status !== 200) throw new Error(`recent post failed: ${r.status}`);
  }
  // Reopen the oldest → must move to front, no duplicate.
  const reopen = await authed("POST", "/api/me/preferences/recent", cookieA, { resourceId: bulkIds[0] });
  const recents = ((reopen.json?.data as any)?.recentResources as any[]) ?? [];
  check(
    "6. recents capped at 20, reopen moves to front, no duplicates",
    recents.length === 20 &&
      String(recents[0]?.resourceId) === bulkIds[0] &&
      new Set(recents.map((e) => String(e.resourceId))).size === 20,
    `n=${recents.length} front=${String(recents[0]?.resourceId).slice(-4)}`,
  );
  const recentBad = await authed("POST", "/api/me/preferences/recent", cookieA, { resourceId: "nope" });
  const recentMissing = await authed("POST", "/api/me/preferences/recent", cookieA, {});
  const recentAnon = await authed("POST", "/api/me/preferences/recent", null, { resourceId: bulkIds[0] });
  check(
    "6b. recent validation (bad/missing → 400, anon → 401)",
    recentBad.status === 400 && recentMissing.status === 400 && recentAnon.status === 401,
  );

  // 7. Concurrent opens stay bounded with a single entry per resource.
  const conc = await Promise.all(
    Array.from({ length: 10 }, () => authed("POST", "/api/me/preferences/recent", cookieB, { resourceId: r2 })),
  );
  const bPrefs = await authed("GET", "/api/me/preferences", cookieB);
  const bRecents = ((bPrefs.json?.data as any)?.recentResources as any[]) ?? [];
  check(
    "7. concurrent same-resource opens: one entry, bounded",
    conc.every((r) => r.status === 200) &&
      bRecents.length === 1 &&
      String(bRecents[0]?.resourceId) === r2,
    `n=${bRecents.length}`,
  );

  // 8. A/B recent + prefs isolation.
  const aPrefs = await authed("GET", "/api/me/preferences", cookieA);
  const aRecents = ((aPrefs.json?.data as any)?.recentResources as any[]) ?? [];
  check(
    "8. recents isolated per user",
    aRecents.length === 20 &&
      !aRecents.some((e: any) => String(e.resourceId) === r2) &&
      !bRecents.some((e: any) => bulkIds.includes(String(e.resourceId))),
    `a=${aRecents.length} b=${bRecents.length}`,
  );

  // 9. user_preferences index + collection shape.
  const indexes = (await UserPreferences.collection.indexes()) as Array<{ name?: string }>;
  check(
    "9. user_preferences unique user index",
    UserPreferences.collection.name === "user_preferences" && indexes.some((i) => i.name === "user_unique"),
    indexes.map((i) => i.name).join(","),
  );

  // Cleanup.
  await DownloadHistory.deleteMany({ userId: { $in: [userA._id, userB._id] } }).exec();
  await UserPreferences.deleteMany({ userId: { $in: [userA._id, userB._id] } }).exec();
  await Resource.deleteMany({ _id: { $in: [res1._id, res2._id, ...bulkDocs.map((d: any) => d._id)] } }).exec();
  await Subject.findByIdAndDelete(subject._id).exec();
  await Semester.findByIdAndDelete(semester._id).exec();
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } }).exec();
  const leftovers = await Promise.all([
    DownloadHistory.countDocuments({ userId: { $in: [userA._id, userB._id] } }).exec(),
    UserPreferences.countDocuments({ userId: { $in: [userA._id, userB._id] } }).exec(),
    User.countDocuments({ _id: { $in: [userA._id, userB._id] } }).exec(),
  ]);
  check("fixtures fully cleaned up", leftovers.every((n) => n === 0), leftovers.join(","));

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:phase19 ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
