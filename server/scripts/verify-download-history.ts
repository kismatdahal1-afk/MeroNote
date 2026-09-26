import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-download-history-only-test-secret";
}

/**
 * Phase 18 download-history verification: `npm run verify:download-history`
 *
 * Boots the REAL app against an ephemeral database (ALLOW_REAL_DB=1 for an
 * intentional real-DB run) and asserts the account-level download contract
 * over HTTP: ownership / validation / idempotency / isolation / ordering /
 * indexes / no-bytes-in-Mongo. Physical IndexedDB behavior is covered by the
 * client Vitest suite; this script never touches blobs.
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
  const [{ DownloadHistory, Resource, Semester, Subject, User }] = await Promise.all([
    import("../src/models/index"),
  ]);

  if (env.nodeEnv === "production") {
    throw new Error("verify:download-history refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("download-history");
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
      name: "Download User",
      email,
      password: "download-password-123",
      confirmPassword: "download-password-123",
    });
    if (res.status !== 201) throw new Error(`fixture register failed for ${email}: ${res.status}`);
    return cookieOf(res.setCookie);
  };
  const cookieA = await mkUser("dla@example.com");
  const cookieB = await mkUser("dlb@example.com");
  const userA = (await User.findOne({ email: "dla@example.com" }).exec())!;
  const userB = (await User.findOne({ email: "dlb@example.com" }).exec())!;

  const semester = await Semester.create({ number: 1, name: "Download Sem", order: 1, status: "published" });
  const subject = await Subject.create({
    semesterId: semester._id,
    name: "Download Subject",
    code: "DWN101",
    category: "core",
    status: "published",
  });
  const mkResource = (title: string, extra: Record<string, unknown> = {}): Promise<any> =>
    Resource.create({
      semesterId: semester._id,
      subjectId: subject._id,
      title,
      type: "short_note",
      fileName: "download.pdf",
      fileSize: 2048,
      pageCount: 20,
      status: "published",
      file: { key: `downloads/${title}.pdf`, bucket: "mero-note-dev", mime: "application/pdf" },
      ...extra,
    }) as Promise<any>;
  const live1: any = await mkResource("Live One");
  const live2: any = await mkResource("Live Two");
  const hidden: any = await mkResource("Hidden DL", { hidden: true });
  const draft: any = await mkResource("Draft DL", { status: "draft" });
  const r1 = String(live1._id);
  const r2 = String(live2._id);

  // 1. Authenticated user lists own (empty) history.
  const empty = await authed("GET", "/api/me/downloads", cookieA);
  check(
    "1. authed list own history (empty envelope)",
    empty.status === 200 && empty.json?.status === "ok" && Array.isArray(empty.json?.data),
  );

  // 2. Unauthenticated list + register rejected.
  const anonList = await authed("GET", "/api/me/downloads", null);
  const anonPut = await authed("PUT", `/api/me/downloads/${r1}`, null, { fileSize: 2048 });
  check("2. unauthenticated → 401", anonList.status === 401 && anonPut.status === 401);

  // 3. Register a valid resource (201, enriched row, no bytes).
  const reg1 = await authed("PUT", `/api/me/downloads/${r1}`, cookieA, { fileSize: 2048 });
  const row1 = reg1.json?.data;
  check(
    "3. valid registration 201 with metadata",
    reg1.status === 201 &&
      row1?.resourceId === r1 &&
      String(row1?.userId) === String(userA._id) &&
      row1?.fileSize === 2048 &&
      row1?.status === "active" &&
      row1?.resource?.title === "Live One" &&
      typeof row1?.downloadedAt === "string",
    JSON.stringify({ st: reg1.status, fs: row1?.fileSize, t: row1?.resource?.title }),
  );

  // 4/5. Invalid resource (unknown id → 404) and invalid ObjectId (→ 400).
  const unknown = await authed("PUT", "/api/me/downloads/000000000000000000000000", cookieA, {});
  const badId = await authed("PUT", "/api/me/downloads/nope", cookieA, {});
  const badSize = await authed("PUT", `/api/me/downloads/${r2}`, cookieA, { fileSize: -5 });
  check("4/5. unknown → 404, bad id/size → 400", unknown.status === 404 && badId.status === 400 && badSize.status === 400);

  // 12. Hidden/draft resources rejected by live rules.
  const hiddenReg = await authed("PUT", `/api/me/downloads/${hidden._id}`, cookieA, {});
  const draftReg = await authed("PUT", `/api/me/downloads/${draft._id}`, cookieA, {});
  check("12. hidden/draft → 404", hiddenReg.status === 404 && draftReg.status === 404);

  // 6. Duplicate registration is idempotent (200, still one row).
  const dup = await authed("PUT", `/api/me/downloads/${r1}`, cookieA, { fileSize: 3000 });
  const dupCount = await DownloadHistory.countDocuments({ userId: userA._id, resourceId: live1._id }).exec();
  check(
    "6. duplicate PUT 200, one row, refreshed size",
    dup.status === 200 && dupCount === 1 && dup.json?.data?.fileSize === 3000,
    `st=${dup.status} n=${dupCount}`,
  );

  // 7/8. B cannot see A's history; same resource registers independently.
  const bList = await authed("GET", "/api/me/downloads", cookieB);
  const bReg = await authed("PUT", `/api/me/downloads/${r1}`, cookieB, {});
  const aList = await authed("GET", "/api/me/downloads", cookieA);
  check(
    "7/8. B isolated; same resource independent per user",
    bList.json?.pagination?.total === 0 &&
      bReg.status === 201 &&
      String(bReg.json?.data?.userId) === String(userB._id) &&
      aList.json?.pagination?.total === 1,
    `bTotal=${bList.json?.pagination?.total} bReg=${bReg.status} aTotal=${aList.json?.pagination?.total}`,
  );

  // 9. Recency ordering (r2 registered after r1 for A).
  const aReg2 = await authed("PUT", `/api/me/downloads/${r2}`, cookieA, {});
  const ordered = await authed("GET", "/api/me/downloads", cookieA);
  const ids = ((ordered.json?.data as any[]) ?? []).map((r) => String(r.resourceId));
  check(
    "9. most-recent-first ordering",
    aReg2.status === 201 && ids.length === 2 && ids[0] === r2 && ids[1] === r1,
    ids.map((id) => id.slice(-4)).join(","),
  );

  // 10. Indexes exist.
  const indexes = (await DownloadHistory.collection.indexes()) as Array<{ name?: string }>;
  const names = indexes.map((i) => i.name);
  check(
    "10. indexes user_resource + user_recency",
    names.includes("user_resource") && names.includes("user_recency"),
    names.join(","),
  );

  // 11. No PDF bytes in MongoDB (schema has no binary/blob/buffer paths).
  const paths = Object.keys(DownloadHistory.schema.paths);
  const doc = (await DownloadHistory.findOne({ userId: userA._id }).lean().exec()) as Record<string, unknown> | null;
  const docSize = doc ? Buffer.byteLength(JSON.stringify(doc)) : 0;
  check(
    "11. no binary paths; history row is metadata-sized",
    !paths.some((p) => /blob|binary|buffer|data/i.test(p)) && docSize > 0 && docSize < 4096,
    `paths=${paths.join(",")} bytes=${docSize}`,
  );

  // Collection name check.
  check("collection is download_history", DownloadHistory.collection.name === "download_history");

  // Cleanup.
  await DownloadHistory.deleteMany({ userId: { $in: [userA._id, userB._id] } }).exec();
  await Resource.deleteMany({ _id: { $in: [live1._id, live2._id, hidden._id, draft._id] } }).exec();
  await Subject.findByIdAndDelete(subject._id).exec();
  await Semester.findByIdAndDelete(semester._id).exec();
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } }).exec();
  const leftovers = await Promise.all([
    DownloadHistory.countDocuments({ userId: { $in: [userA._id, userB._id] } }).exec(),
    Resource.countDocuments({ _id: live1._id }).exec(),
    User.countDocuments({ _id: { $in: [userA._id, userB._id] } }).exec(),
  ]);
  check("fixtures fully cleaned up", leftovers.every((n) => n === 0), leftovers.join(","));

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:download-history ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
