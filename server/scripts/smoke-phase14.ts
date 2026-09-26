import dotenv from "dotenv";

dotenv.config();

/**
 * Phase 14 security smoke test: `npm run verify:phase14`
 *
 * Boots the REAL app against an ephemeral test database (ALLOW_REAL_DB=1
 * for an intentional real-DB run) and probes the Phase 14 hardening surface
 * over HTTP: security headers, 404/500 hygiene, auth rate limiting, the
 * 401/403 matrix, invalid sessions/ids/bodies, cross-user personal-study
 * isolation, draft/hidden file+detail invisibility, invalid uploads, and
 * duplicate registration. Refuses NODE_ENV=production. Never prints secrets.
 */

import type { Server } from "http";
import type { AddressInfo } from "net";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { useTestDatabase } from "./testDb";
import { Resource, Semester, Subject, User } from "../src/models/index";
import { errorHandler } from "../src/middleware/error.middleware";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("smoke-phase14 refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("phase14");
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
    extraHeaders?: Record<string, string>,
  ): Promise<{ status: number; json: any; headers: Headers }> => {
    const headers: Record<string, string> = { ...(extraHeaders ?? {}) };
    if (cookie) headers.cookie = cookie;
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${base}${path}`, init);
    return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
  };
  const cookieOf = (setCookie: string | null): string => (setCookie ? setCookie.split(";")[0] : "");

  try {
    // 1. Security headers on a plain API response.
    const health = await call("GET", "/api/health", null);
    const poweredBy = health.headers.get("x-powered-by");
    check(
      "helmet headers present, x-powered-by absent",
      poweredBy === null &&
        health.headers.get("x-dns-prefetch-control") === "off" &&
        health.headers.get("x-frame-options") === "SAMEORIGIN" &&
        (health.headers.get("x-content-type-options") ?? "").toLowerCase() === "nosniff",
      `x-powered-by=${poweredBy ?? "absent"}`,
    );

    // 2. Unknown route → generic 404 envelope (no method/URL echo).
    const missing = await call("GET", "/api/nope-nowhere", null);
    check(
      "unknown route 404 without internals",
      missing.status === 404 &&
        missing.json?.status === "error" &&
        missing.json?.message === "Not found." &&
        !JSON.stringify(missing.json).includes("nope-nowhere"),
    );

    // 3. 500 sanitization outside development (unit-level, no HTTP fault needed).
    const fakeRes = (): { statusCode: number; body: unknown; status(c: number): any; json(b: unknown): void } => {
      const res: any = {
        statusCode: 200,
        body: null,
        status(c: number) {
          res.statusCode = c;
          return res;
        },
        json(b: unknown) {
          res.body = b;
        },
      };
      return res;
    };
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const prodRes = fakeRes();
    errorHandler(new Error("mongodb://secret-host exploded"), {} as any, prodRes as any, (() => {}) as any);
    const devRes = (() => {
      process.env.NODE_ENV = "development";
      const r = fakeRes();
      errorHandler(new Error("real cause here"), {} as any, r as any, (() => {}) as any);
      return r;
    })();
    process.env.NODE_ENV = prevNodeEnv;
    check(
      "unexpected 500 sanitized in production, verbose in development",
      prodRes.statusCode === 500 &&
        (prodRes.body as any)?.message === "Internal server error." &&
        !JSON.stringify(prodRes.body).includes("secret-host") &&
        (devRes.body as any)?.message === "real cause here",
    );

    // 4. Fixtures: USER + ADMIN sessions (4 auth POSTs total — far below the bucket).
    const pw = { password: "phase14-test-123", confirmPassword: "phase14-test-123" };
    const regA = await call("POST", "/api/auth/register", null, { name: "P14 A", email: "p14a@example.com", ...pw });
    const regB = await call("POST", "/api/auth/register", null, { name: "P14 B", email: "p14b@example.com", ...pw });
    const dup = await call("POST", "/api/auth/register", null, { name: "P14 Dup", email: "p14a@example.com", ...pw });
    await User.findOneAndUpdate({ email: "p14a@example.com" }, { $set: { role: "ADMIN" } }).exec();
    const login = async (email: string): Promise<string> => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: pw.password }),
      });
      return cookieOf(res.headers.get("set-cookie"));
    };
    const admin = await login("p14a@example.com");
    const user = await login("p14b@example.com");
    check(
      "fixtures registered, duplicate → 409",
      regA.status === 201 && regB.status === 201 && dup.status === 409 && !!admin && !!user,
    );

    // 5. RBAC matrix on admin + personal routes.
    const anonAdmin = await call("GET", "/api/admin/semesters", null);
    const userAdmin = await call("GET", "/api/admin/semesters", user);
    const adminOk = await call("GET", "/api/admin/semesters", admin);
    const anonMe = await call("GET", "/api/me/favorites", null);
    const userWrite = await call("POST", "/api/admin/notices", user, { heading: "x" });
    const userRestore = await call("POST", "/api/admin/semesters/000000000000000000000000/restore", user);
    check(
      "anon → 401, USER → 403 on admin, ADMIN → 200",
      anonAdmin.status === 401 &&
        userAdmin.status === 403 &&
        adminOk.status === 200 &&
        anonMe.status === 401 &&
        userWrite.status === 403 &&
        userRestore.status === 403,
    );

    // 6. Invalid session + invalid ids + malformed bodies.
    const badSession = await call("GET", "/api/auth/me", "meronote_session=garbage.token.here");
    const badId = await call("GET", "/api/resources/not-an-id", null);
    const missingId = await call("GET", "/api/resources/000000000000000000000000", null);
    const badBookmark = await call("POST", "/api/me/bookmarks", user, { nope: true });
    const badPage = await call("PUT", "/api/me/progress/000000000000000000000000", user, { lastPage: -5 });
    check(
      "bad session 401, bad id 400, missing 404, malformed 400",
      badSession.status === 401 &&
        badId.status === 400 &&
        missingId.status === 404 &&
        badBookmark.status === 400 &&
        badPage.status === 400,
    );

    // 7. Cross-user personal-study isolation (subjects need no files).
    const sem = await Semester.create({ number: 1, order: 1, name: "P14 Sem", description: "", status: "published" });
    const sub = await Subject.create({
      semesterId: sem._id,
      name: "P14 Subject",
      code: "P14",
      category: "core",
      description: "",
      status: "published",
    });
    const favA = await call("PUT", `/api/me/favorites/subject/${String(sub._id)}`, admin);
    const delB = await call("DELETE", `/api/me/favorites/subject/${String(sub._id)}`, user);
    const listA = await call("GET", "/api/me/favorites", admin);
    const bmCreate = await call("POST", "/api/me/bookmarks", admin, {
      targetType: "subject",
      targetId: String(sub._id),
    });
    const bmId = String(bmCreate.json?.data?._id ?? "");
    const bmCrossGet = await call("GET", "/api/me/bookmarks", user);
    const bmCrossDel = bmId
      ? await call("DELETE", `/api/me/bookmarks/${bmId}`, user)
      : { status: -1, json: null };
    const rowsA: unknown[] = Array.isArray(listA.json?.data) ? listA.json.data : [];
    const rowsB: unknown[] = Array.isArray(bmCrossGet.json?.data) ? bmCrossGet.json.data : [];
    check(
      "cross-user favorite/bookmark isolation",
      favA.status === 201 &&
        delB.status === 200 &&
        rowsA.some((r) => (r as any)?.targetId === String(sub._id)) &&
        bmCreate.status === 201 &&
        !rowsB.some((r) => (r as any)?._id === bmId) &&
        (bmCrossDel.status === 404 || bmCrossDel.status === 403),
      `cross-delete=${bmCrossDel.status}`,
    );

    // 8. Draft/hidden resources invisible to public detail + file endpoints.
    const draft = await Resource.create({
      semesterId: sem._id,
      subjectId: sub._id,
      title: "P14 Draft",
      description: "",
      type: "short_note",
      status: "draft",
      fileName: "draft.pdf",
      fileSize: 100,
      pageCount: 2,
      file: { key: "p14/draft.pdf", bucket: "x", mime: "application/pdf" },
    });
    const hidden = await Resource.create({
      semesterId: sem._id,
      subjectId: sub._id,
      title: "P14 Hidden",
      description: "",
      type: "short_note",
      status: "published",
      hidden: true,
      fileName: "hidden.pdf",
      fileSize: 100,
      pageCount: 2,
      file: { key: "p14/hidden.pdf", bucket: "x", mime: "application/pdf" },
    });
    const dDetail = await call("GET", `/api/resources/${String(draft._id)}`, null);
    const dFile = await call("GET", `/api/resources/${String(draft._id)}/file`, null);
    const hDetail = await call("GET", `/api/resources/${String(hidden._id)}`, null);
    const hFile = await call("GET", `/api/resources/${String(hidden._id)}/file`, null);
    check(
      "draft/hidden detail + file → 404",
      dDetail.status === 404 && dFile.status === 404 && hDetail.status === 404 && hFile.status === 404,
    );

    // 9. Admin file auth + validation (offline B2 tier expected here).
    const noFile = await call("POST", `/api/admin/resources/${String(draft._id)}/file`, admin);
    const anonUpload = await call("POST", `/api/admin/resources/${String(draft._id)}/file`, null);
    const userUpload = await call("POST", `/api/admin/resources/${String(draft._id)}/file`, user);
    check(
      "file upload: no-file 400, anon 401, USER 403",
      noFile.status === 400 && anonUpload.status === 401 && userUpload.status === 403,
      `no-file=${noFile.status}`,
    );

    // 10. Rate limit: hammer login with bad creds → 429 with error envelope.
    let saw429 = false;
    let lastStatus = 0;
    for (let i = 0; i < 25; i += 1) {
      const r = await call("POST", "/api/auth/login", null, {
        email: "nobody@example.com",
        password: "wrong-password-123",
      });
      lastStatus = r.status;
      if (r.status === 429 && r.json?.status === "error") {
        saw429 = true;
        break;
      }
    }
    check("login rate limit trips 429 with error envelope", saw429, `last=${lastStatus}`);
  } finally {
    server.close();
    await disconnectDb();
    await cleanup();
  }

  console.log(`\nsmoke-phase14: ${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
