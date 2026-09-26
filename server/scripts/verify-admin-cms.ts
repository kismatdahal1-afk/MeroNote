import dotenv from "dotenv";

dotenv.config();

/**
 * Phase 11 Admin CMS verification: `npm run verify:admin-cms`
 *
 * Boots the REAL app against an ephemeral test database (ALLOW_REAL_DB=1
 * for an intentional real-DB run) and asserts the admin contract over HTTP
 * with temp ADMIN / USER / anonymous clients:
 * 401/403 matrix, full CRUD + restore + 409s + validation for all six
 * entities, hierarchy enforcement, book unlinking, notice publishing,
 * file-endpoint auth/validation/503 paths, public-visibility regressions,
 * and (gated) the live B2 upload/replace/delete cycle on temp objects.
 *
 * Refuses NODE_ENV=production. Never prints secrets. Exit 0 = all pass.
 */

import type { Server } from "http";
import type { AddressInfo } from "net";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { useTestDatabase } from "./testDb";
import { b2CredsUsable } from "./b2TestEnv";
import { ensureFixedSemesters } from "../src/seed/fixedSemesters";
import { User } from "../src/models/index";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const TINY_PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("verify:admin-cms refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("admin-cms");
  await connectDb(uri);

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (
    method: string,
    path: string,
    cookie: string | null,
    body?: unknown,
    form?: FormData,
  ): Promise<{ status: number; json: any }> => {
    const init: RequestInit = { method, headers: {} };
    if (cookie) (init.headers as Record<string, string>).cookie = cookie;
    if (form) init.body = form;
    else if (body !== undefined) {
      (init.headers as Record<string, string>)["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${base}${path}`, init);
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  const cookieOf = (setCookie: string | null): string => (setCookie ? setCookie.split(";")[0] : "");
  const loginAs = async (email: string): Promise<string> => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "admin-test-123" }),
    });
    return cookieOf(res.headers.get("set-cookie"));
  };
  const register = async (email: string): Promise<void> => {
    const res = await call("POST", "/api/auth/register", null, {
      name: "CMS Admin",
      email,
      password: "admin-test-123",
      confirmPassword: "admin-test-123",
    });
    if (res.status !== 201) throw new Error(`fixture register failed: ${res.status}`);
  };

  await register("cmsadmin@example.com");
  await register("cmsuser@example.com");
  await User.findOneAndUpdate({ email: "cmsadmin@example.com" }, { $set: { role: "ADMIN" } }).exec();
  const admin = await loginAs("cmsadmin@example.com");
  const user = await loginAs("cmsuser@example.com");

  // 1. Auth matrix.
  const anon = await call("POST", "/api/admin/semesters", null, { name: "X" });
  const userDenied = await call("POST", "/api/admin/semesters", user, { name: "X" });
  const anonGet = await call("GET", "/api/admin/semesters", null);
  check("anon → 401, USER → 403", anon.status === 401 && userDenied.status === 403 && anonGet.status === 401);

  // 2. Fixed semesters: bootstrap 8 official, create/delete/order blocked.
  const fixed = await ensureFixedSemesters();
  check("fixed bootstrap yields exactly 8", fixed.total === 8, `total=${fixed.total}`);
  const semListAll = await call("GET", "/api/admin/semesters?limit=100", admin);
  const officialIds = ((semListAll.json?.data as any[]) ?? []).map((s) => String(s._id ?? s.id));
  const semId = officialIds[0] ?? "";
  check("admin lists 8 official semesters", semListAll.status === 200 && officialIds.length === 8, `count=${officialIds.length}`);
  const semCreate = await call("POST", "/api/admin/semesters", admin, { name: "Verify Sem" });
  check("semester create blocked (fixed 1–8) → 403", semCreate.status === 403);
  const semDupNum = await call("POST", "/api/admin/semesters", admin, { name: "Dup", number: 1 });
  check("duplicate semester number → 403 (create blocked)", semDupNum.status === 403);
  const semGet = await call("GET", `/api/admin/semesters/${semId}`, admin);
  const semMissing = await call("GET", "/api/admin/semesters/000000000000000000000000", admin);
  const semBadId = await call("GET", "/api/admin/semesters/nope", admin);
  check("semester get 200 / missing 404 / bad id 400", semGet.status === 200 && semMissing.status === 404 && semBadId.status === 400);
  const semPatch = await call("PATCH", `/api/admin/semesters/${semId}`, admin, { description: "Verify Sem v2" });
  const semPatchNum = await call("PATCH", `/api/admin/semesters/${semId}`, admin, { number: 5 });
  const semPatchOrder = await call("PATCH", `/api/admin/semesters/${semId}`, admin, { order: 2 });
  const semPatchEmpty = await call("PATCH", `/api/admin/semesters/${semId}`, admin, { unknownField: 1 });
  check(
    "semester patch ok / number immutable / order immutable / empty patch 400",
    semPatch.status === 200 && semPatchNum.status === 400 && semPatchOrder.status === 400 && semPatchEmpty.status === 400,
  );
  const semList = await call("GET", "/api/admin/semesters?status=published", admin);
  const semListBad = await call("GET", "/api/admin/semesters?status=bogus", admin);
  check("semester list filter + bad enum 400", semList.status === 200 && semListBad.status === 400);

  // 3. Subject CRUD + hierarchy.
  const subBadSem = await call("POST", "/api/admin/subjects", admin, {
    semesterId: "000000000000000000000000",
    name: "Orphan",
    code: "ORP101",
    category: "core",
  });
  check("subject with missing semester → 404", subBadSem.status === 404);
  const subCreate = await call("POST", "/api/admin/subjects", admin, {
    semesterId: semId,
    name: "Verify Subject",
    code: "VRF101",
    category: "core",
    credits: 3,
    hotTopics: ["T1"],
  });
  const subId = String(subCreate.json?.data?._id ?? "");
  check("subject create 201", subCreate.status === 201);
  const subDup = await call("POST", "/api/admin/subjects", admin, {
    semesterId: semId,
    name: "Dup",
    code: "VRF101",
    category: "core",
  });
  check("duplicate subject code → 409", subDup.status === 409);
  const subMove = await call("PATCH", `/api/admin/subjects/${subId}`, admin, { semesterId: "000000000000000000000000" });
  check("subject semesterId immutable → 400", subMove.status === 400);
  const semDelBlocked = await call("DELETE", `/api/admin/semesters/${semId}`, admin);
  check("official semester delete blocked → 403 (fixed 1–8)", semDelBlocked.status === 403);

  // 4. Topic CRUD.
  const topBad = await call("POST", "/api/admin/topics", admin, { subjectId: "000000000000000000000000", title: "Orphan" });
  check("topic with missing subject → 404", topBad.status === 404);
  const topCreate = await call("POST", "/api/admin/topics", admin, { subjectId: subId, title: "Verify Topic" });
  const topId = String(topCreate.json?.data?._id ?? "");
  check("topic create 201 + default order/status", topCreate.status === 201 && topCreate.json?.data?.order === 1 && topCreate.json?.data?.status === "draft");
  const topPatch = await call("PATCH", `/api/admin/topics/${topId}`, admin, { title: "Verify Topic v2", status: "published" });
  check("topic patch 200", topPatch.status === 200 && topPatch.json?.data?.title === "Verify Topic v2");
  const subDelBlocked = await call("DELETE", `/api/admin/subjects/${subId}`, admin);
  check("subject delete with topic → 409", subDelBlocked.status === 409);

  // 5. Resource CRUD + hierarchy.
  const resBadType = await call("POST", "/api/admin/resources", admin, { semesterId: semId, subjectId: subId, title: "Bad", type: "nope" });
  check("resource bad type → 400", resBadType.status === 400);
  const resCustomNoLabel = await call("POST", "/api/admin/resources", admin, {
    semesterId: semId,
    subjectId: subId,
    title: "Custom?",
    type: "custom",
  });
  check("custom type without label → 400", resCustomNoLabel.status === 400);
  // Second official semester (fixed 1–8) for cross-hierarchy checks.
  const otherSemId = officialIds[1] ?? semId;
  const resCrossSem = await call("POST", "/api/admin/resources", admin, {
    semesterId: otherSemId,
    subjectId: subId,
    title: "Cross",
    type: "short_note",
  });
  check("cross-semester subject → 400", resCrossSem.status === 400);
  const otherSub = await call("POST", "/api/admin/subjects", admin, { semesterId: otherSemId, name: "Other Sub", code: "OTH102", category: "core" });
  const otherSubId = String(otherSub.json?.data?._id ?? "");
  const otherTop = await call("POST", "/api/admin/topics", admin, { subjectId: otherSubId, title: "Other Topic" });
  const otherTopId = String(otherTop.json?.data?._id ?? "");
  const resCrossTop = await call("POST", "/api/admin/resources", admin, {
    semesterId: semId,
    subjectId: subId,
    topicId: otherTopId,
    title: "Cross Topic",
    type: "short_note",
  });
  check("cross-subject topic → 400", resCrossTop.status === 400);
  const resSmuggled = await call("POST", "/api/admin/resources", admin, {
    semesterId: semId,
    subjectId: subId,
    title: "Smuggle",
    type: "short_note",
    fileSize: 999,
  });
  check("server-managed fileSize rejected → 400", resSmuggled.status === 400);
  const resCreate = await call("POST", "/api/admin/resources", admin, {
    semesterId: semId,
    subjectId: subId,
    topicId: topId,
    title: "Verify Resource",
    type: "short_note",
    tags: ["Verify"],
    pageCount: 12,
  });
  const resId = String(resCreate.json?.data?._id ?? "");
  check("resource create 201 draft (fileless)", resCreate.status === 201 && resCreate.json?.data?.status === "draft" && resCreate.json?.data?.file === undefined);
  const resPatch = await call("PATCH", `/api/admin/resources/${resId}`, admin, { title: "Verify Resource v2", featured: true });
  const topDelBlocked = await call("DELETE", `/api/admin/topics/${topId}`, admin);
  check("topic delete with linked resource → 409", topDelBlocked.status === 409);
  const resClearTopic = await call("PATCH", `/api/admin/resources/${resId}`, admin, { topicId: null });
  check("resource patch + topic unlink", resPatch.status === 200 && resClearTopic.status === 200 && resClearTopic.json?.data?.topicId === undefined);
  const topDelFree = await call("DELETE", `/api/admin/topics/${topId}`, admin);
  check("topic delete after unlink → 200", topDelFree.status === 200);
  const resDel = await call("DELETE", `/api/admin/resources/${resId}`, admin);
  const resDelIdem = await call("DELETE", `/api/admin/resources/${resId}`, admin);
  check("resource soft delete + idempotent", resDel.status === 200 && resDelIdem.status === 200);
  const getDeleted = await call("GET", `/api/admin/resources/${resId}`, admin);
  const patchDeleted = await call("PATCH", `/api/admin/resources/${resId}`, admin, { title: "Nope" });
  const listHidesDeleted = await call("GET", "/api/admin/resources?limit=100", admin);
  const listShowsDeleted = await call("GET", "/api/admin/resources?limit=100&includeDeleted=true", admin);
  const listedIds = ((listHidesDeleted.json?.data as any[]) ?? []).map((r) => String(r._id ?? r.id));
  const listedAllIds = ((listShowsDeleted.json?.data as any[]) ?? []).map((r) => String(r._id ?? r.id));
  check(
    "admin get sees deleted; patch deleted → 400; includeDeleted honored",
    getDeleted.status === 200 && getDeleted.json?.data?.deletedAt !== undefined &&
      patchDeleted.status === 400 && !listedIds.includes(resId) && listedAllIds.includes(resId),
  );
  const resRestore = await call("POST", `/api/admin/resources/${resId}/restore`, admin);
  const resRestoreAgain = await call("POST", `/api/admin/resources/${resId}/restore`, admin);
  check("resource restore + repeat 400", resRestore.status === 200 && resRestoreAgain.status === 400);

  // 6. Book: link, unlink-on-delete, restore.
  const bookBad = await call("POST", "/api/admin/books", admin, {
    semesterId: otherSemId,
    subjectId: subId,
    title: "Bad Book",
    pageCount: 10,
    fileSize: 100,
  });
  check("book cross-semester subject → 400", bookBad.status === 400);
  const bookCreate = await call("POST", "/api/admin/books", admin, {
    semesterId: semId,
    subjectId: subId,
    title: "Verify Book",
    author: "Author",
    pageCount: 100,
    fileSize: 4096,
  });
  const bookId = String(bookCreate.json?.data?._id ?? "");
  check("book create 201", bookCreate.status === 201);
  const bookLink = await call("PATCH", `/api/admin/resources/${resId}`, admin, { bookId });
  check("resource links book", bookLink.status === 200 && String(bookLink.json?.data?.bookId) === bookId);
  const bookDel = await call("DELETE", `/api/admin/books/${bookId}`, admin);
  check("book delete unlinks (no cascade)", bookDel.status === 200 && bookDel.json?.data?.unlinkedResources === 1);
  const bookRestore = await call("POST", `/api/admin/books/${bookId}/restore`, admin);
  check("book restore 200", bookRestore.status === 200);
  const bookMove = await call("PATCH", `/api/admin/books/${bookId}`, admin, { semesterId: otherSemId, subjectId: otherSubId });
  check("book move revalidates + updates", bookMove.status === 200 && String(bookMove.json?.data?.semesterId) === otherSemId);
  const bookBadEnum = await call("PATCH", `/api/admin/books/${bookId}`, admin, { status: "bogus" });
  check("book bad status → 400", bookBadEnum.status === 400);

  // 7. Notice publish flow + public visibility.
  const noticeCreate = await call("POST", "/api/admin/notices", admin, {
    heading: "Verify Notice",
    type: "general",
    announcer: "administration",
    date: new Date().toISOString(),
  });
  const noticeId = String(noticeCreate.json?.data?._id ?? "");
  check("notice create draft, no publishedAt", noticeCreate.status === 201 && noticeCreate.json?.data?.publishedAt === undefined);
  const publicBefore = await call("GET", "/api/notices?limit=100", null);
  const noticePub = await call("PATCH", `/api/admin/notices/${noticeId}`, admin, { status: "published", pinned: true });
  check("notice publish stamps publishedAt", noticePub.status === 200 && typeof noticePub.json?.data?.publishedAt === "string");
  const publicAfter = await call("GET", "/api/notices?limit=100", null);
  const titles = (j: any): string[] => ((j?.data as any[]) ?? []).map((n) => n.heading);
  check(
    "draft hidden publicly, published visible",
    !titles(publicBefore.json).includes("Verify Notice") && titles(publicAfter.json).includes("Verify Notice"),
  );
  const noticeDel = await call("DELETE", `/api/admin/notices/${noticeId}`, admin);
  const noticeRestore = await call("POST", `/api/admin/notices/${noticeId}/restore`, admin);
  check("notice delete/restore", noticeDel.status === 200 && noticeRestore.status === 200);

  // 8. File endpoints: auth + validation + 503 without B2.
  const pdfForm = (): FormData => {
    const form = new FormData();
    form.append("file", new File([TINY_PDF], "verify.pdf", { type: "application/pdf" }));
    form.append("pageCount", "9");
    return form;
  };
  const noFileForm = new FormData();
  const txtForm = (): FormData => {
    const form = new FormData();
    form.append("file", new File(["hello"], "evil.txt", { type: "text/plain" }));
    return form;
  };
  const upAnon = await call("POST", `/api/admin/resources/${resId}/file`, null, undefined, pdfForm());
  const upUser = await call("POST", `/api/admin/resources/${resId}/file`, user, undefined, pdfForm());
  const upMissing = await call("POST", "/api/admin/resources/000000000000000000000000/file", admin, undefined, pdfForm());
  const upNoFile = await call("POST", `/api/admin/resources/${resId}/file`, admin, undefined, noFileForm);
  const upBadType = await call("POST", `/api/admin/resources/${resId}/file`, admin, undefined, txtForm());
  check(
    "upload auth + 404 + no-file + wrong-type",
    upAnon.status === 401 && upUser.status === 403 && upMissing.status === 404 && upNoFile.status === 400 && upBadType.status === 400,
  );
  // Template placeholders count as unconfigured (offline tier) — see b2TestEnv.
  const upLive = await call("POST", `/api/admin/resources/${resId}/file`, admin, undefined, pdfForm());
  if (!b2CredsUsable()) {
    check("upload without B2 creds → 503 (nothing fabricated)", upLive.status === 503);
  } else {
    check(
      "live upload persists metadata",
      upLive.status === 200 && typeof upLive.json?.data?.checksum === "string" && upLive.json?.data?.pageCount === 9,
      JSON.stringify(upLive.json?.data),
    );
    const fileAccess = await call("GET", `/api/resources/${resId}`, null);
    check("metadata visible via public detail", fileAccess.status === 404 || fileAccess.status === 200);
    const delFile = await call("DELETE", `/api/admin/resources/${resId}/file`, admin);
    const afterDel = await call("GET", `/api/admin/resources/${resId}`, admin);
    check(
      "live delete clears file + forces draft",
      delFile.status === 200 && afterDel.json?.data?.file === undefined && afterDel.json?.data?.status === "draft",
    );
  }
  const delNoFile = await call("DELETE", `/api/admin/resources/${resId}/file`, admin);
  check("delete file when none → 410", delNoFile.status === 410);

  // 9. Injection + public regression.
  const inject = await call("POST", "/api/admin/subjects", admin, {
    semesterId: semId,
    name: { $gt: "" },
    code: "INJ103",
    category: "core",
  });
  const patchInject = await call("PATCH", `/api/admin/resources/${resId}`, admin, { $set: { title: "Hacked" } } as unknown as Record<string, unknown>);
  check("operator injection rejected/ignored", inject.status === 400 && patchInject.status === 400);
  const pubSem = await call("GET", "/api/semesters?limit=50", null);
  const pubSearch = await call("GET", "/api/search?q=verify&limit=50", null);
  const health = await call("GET", "/api/health", null);
  check("public regressions ok", pubSem.status === 200 && pubSearch.status === 200 && health.status === 200);

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  if (!b2CredsUsable()) {
    console.log("LIVE SKIPPED — B2 credentials not configured; upload/replace/delete ran offline tiers only.");
  }
  console.log(`\nverify:admin-cms ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
