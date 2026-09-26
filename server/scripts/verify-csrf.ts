import dotenv from "dotenv";

dotenv.config();

// Test-only fallback, assigned here at module evaluation — before main()
// dynamic-imports the env-dependent modules below.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-csrf-only-test-secret";
}

/**
 * F3 CSRF verification: `npm run verify:csrf`
 *
 * Boots the REAL app + real auth/CSRF stack against an ephemeral in-memory
 * database and asserts the double-submit boundary over HTTP:
 * missing/invalid CSRF proof on authenticated mutations → 403 (controller
 * not executed); valid proof → success; GET/OPTIONS unaffected; login and
 * register stay exempt; logout requires proof when a session exists;
 * admin mutations enforced; failed CSRF never invalidates the session.
 *
 * Refuses NODE_ENV=production. Never logs tokens, cookies, or secrets
 * (only presence/length is asserted). Exit 0 = all checks pass.
 */

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
  const [{ User }] = await Promise.all([import("../src/models/index")]);

  if (env.nodeEnv === "production") {
    throw new Error("verify-csrf refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("csrf");
  await connectDb(uri);

  const app = createApp();
  const server: import("http").Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    const base = `http://127.0.0.1:${(server.address() as import("net").AddressInfo).port}`;
    const EVIL_ORIGIN = "https://evil.example";
    const FAKE_TARGET = "507f1f77bcf86cd799439011";

    interface Jar {
      cookie: string;
      csrf: string;
    }

    const cookieValue = (setCookie: string | null, name: string): string => {
      const m = (setCookie ?? "").match(new RegExp(`${name}=([^;]+)`));
      return m ? m[1] : "";
    };
    const toJar = (setCookie: string | null): Jar => {
      const session = cookieValue(setCookie, "meronote_session");
      const csrf = cookieValue(setCookie, "meronote_csrf");
      return { cookie: `meronote_session=${session}; meronote_csrf=${csrf}`, csrf };
    };
    const withProof = (jar: Jar, extra?: Record<string, string>): Record<string, string> => ({
      cookie: jar.cookie,
      "x-csrf-token": jar.csrf,
      ...(extra ?? {}),
    });

    const req = async (
      method: string,
      path: string,
      headers: Record<string, string> = {},
      body?: unknown,
    ): Promise<{ status: number; json: any; setCookie: string | null; headers: Headers }> => {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: res.status, json: await res.json().catch(() => ({})), setCookie: res.headers.get("set-cookie"), headers: res.headers };
    };
    const authed = (jar: Jar, extra?: Record<string, string>) => withProof(jar, extra);

    // ── Bootstrap: register issues a CSRF cookie alongside the session ──
    const reg = await req("POST", "/api/auth/register", { "content-type": "application/json" }, {
      name: "CSRF User",
      email: "csrf@example.com",
      password: "study-hard-123",
      confirmPassword: "study-hard-123",
    });
    check("register 201 without CSRF proof (pre-session, exempt)", reg.status === 201, `status=${reg.status}`);
    const regJar = toJar(reg.setCookie);
    check("register sets CSRF cookie (64-hex, readable)", regJar.csrf.length === 64, `len=${regJar.csrf.length}`);
    const csrfAttrs = (reg.setCookie ?? "").match(/meronote_csrf=[^;]+((?:;[^,]+)*)/)?.[1] ?? "";
    check("CSRF cookie carries no HttpOnly flag", !/httponly/i.test(csrfAttrs));

    // ── Bootstrap endpoint ──
    const boot = await req("GET", "/api/auth/csrf");
    const bootJar = toJar(boot.setCookie);
    check(
      "GET /api/auth/csrf issues token (body matches cookie)",
      boot.status === 200 && typeof boot.json?.data?.csrfToken === "string" && boot.json.data.csrfToken === bootJar.csrf,
      `status=${boot.status}`,
    );

    // Login rotates the CSRF token.
    const login = await req("POST", "/api/auth/login", { "content-type": "application/json" }, {
      email: "csrf@example.com",
      password: "study-hard-123",
    });
    check("login 200 without CSRF proof (pre-session, exempt)", login.status === 200, `status=${login.status}`);
    const jar = toJar(login.setCookie);
    check("login rotates CSRF token", jar.csrf.length === 64 && jar.csrf !== regJar.csrf);

    // ── Test 1: missing CSRF proof on authenticated mutations → 403 ──
    const cookieOnly = { cookie: jar.cookie };
    const putNoProof = await req("PUT", `/api/me/favorites/resource/${FAKE_TARGET}`, cookieOnly);
    const patchNoProof = await req("PATCH", "/api/auth/me", cookieOnly, { name: "Hacked" });
    const deleteNoProof = await req("DELETE", `/api/me/favorites/resource/${FAKE_TARGET}`, cookieOnly);
    const postNoProof = await req("POST", "/api/me/bookmarks", cookieOnly, {
      targetType: "resource",
      targetId: FAKE_TARGET,
    });
    for (const [label, r] of [
      ["PUT", putNoProof],
      ["PATCH /auth/me", patchNoProof],
      ["DELETE", deleteNoProof],
      ["POST", postNoProof],
    ] as const) {
      check(`missing proof ${label} → 403 (not 401)`, r.status === 403, `status=${r.status}`);
    }

    // Controller must not have executed: profile name unchanged, no bookmark.
    const meAfterBlocked = await req("GET", "/api/auth/me", cookieOnly);
    check("blocked PATCH left profile unchanged", meAfterBlocked.json?.data?.name !== "Hacked");
    const bookmarks = await req("GET", "/api/me/bookmarks", cookieOnly);
    check("blocked POST created nothing", Array.isArray(bookmarks.json?.data) && bookmarks.json.data.length === 0);

    // ── Test 2: invalid CSRF proof → 403 ──
    const wrongToken = await req("PUT", `/api/me/favorites/resource/${FAKE_TARGET}`, {
      cookie: jar.cookie,
      "x-csrf-token": "0".repeat(64),
    });
    check("wrong token → 403", wrongToken.status === 403, `status=${wrongToken.status}`);
    const mismatched = await req("PUT", `/api/me/favorites/resource/${FAKE_TARGET}`, {
      cookie: `meronote_session=${cookieValue(login.setCookie, "meronote_session")}; meronote_csrf=${"1".repeat(64)}`,
      "x-csrf-token": jar.csrf,
    });
    check("header/cookie mismatch → 403", mismatched.status === 403, `status=${mismatched.status}`);

    // ── Test 3: valid proof → request succeeds (controller runs) ──
    const patchOk = await req("PATCH", "/api/auth/me", authed(jar), { name: "Csrf User" });
    check("valid proof PATCH /auth/me → 200 + applied", patchOk.status === 200 && patchOk.json?.data?.name === "Csrf User", `status=${patchOk.status}`);
    // Unknown target with valid proof passes CSRF and reaches the controller (404, not 403).
    const putUnknown = await req("PUT", `/api/me/favorites/resource/${FAKE_TARGET}`, authed(jar));
    check("valid proof reaches controller (unknown target → 404, not 403)", putUnknown.status === 404, `status=${putUnknown.status}`);

    // ── Test 4: GET unaffected without any proof ──
    const getFav = await req("GET", "/api/me/favorites", cookieOnly);
    const getMe = await req("GET", "/api/auth/me", cookieOnly);
    check("authed GET without CSRF header → 200", getFav.status === 200 && getMe.status === 200, `status=${getFav.status}/${getMe.status}`);

    // ── Test 5: preflight unaffected ──
    const preflight = await fetch(`${base}/api/me/favorites/resource/${FAKE_TARGET}`, {
      method: "OPTIONS",
      headers: {
        origin: env.clientUrl,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "x-csrf-token",
      },
    });
    check(
      "OPTIONS preflight succeeds with CORS headers",
      preflight.status === 204 && (preflight.headers.get("access-control-allow-origin") ?? "").length > 0,
      `status=${preflight.status}`,
    );

    // ── Test 6: cross-origin mutation with cookie but no proof → 403 ──
    const evilNoProof = await req("PUT", `/api/me/favorites/resource/${FAKE_TARGET}`, {
      cookie: jar.cookie,
      origin: EVIL_ORIGIN,
    });
    check("evil origin + cookie, no token → 403", evilNoProof.status === 403, `status=${evilNoProof.status}`);
    // Form-style submission (urlencoded, evil origin) → 403.
    const evilForm = await fetch(`${base}/api/me/bookmarks`, {
      method: "POST",
      headers: { cookie: jar.cookie, origin: EVIL_ORIGIN, "content-type": "application/x-www-form-urlencoded" },
      body: "targetType=resource",
    });
    check("cross-site form POST → 403", evilForm.status === 403, `status=${evilForm.status}`);

    // ── Test 7: Origin rule ──
    const evilWithToken = await req("PATCH", "/api/auth/me", authed(jar, { origin: EVIL_ORIGIN }), { name: "Evil" });
    check("valid token + untrusted origin → 403", evilWithToken.status === 403, `status=${evilWithToken.status}`);
    const noOriginWithToken = await req("PATCH", "/api/auth/me", authed(jar), { name: "No Origin Client" });
    check("valid token + absent origin (non-browser) → 200", noOriginWithToken.status === 200, `status=${noOriginWithToken.status}`);
    const goodOrigin = await req("PATCH", "/api/auth/me", authed(jar, { origin: env.clientUrl }), { name: "Csrf Ok" });
    check("valid token + app origin → 200", goodOrigin.status === 200, `status=${goodOrigin.status}`);

    // ── Test 8: logout semantics ──
    const logoutNoProof = await req("POST", "/api/auth/logout", cookieOnly, {});
    check("logout with session but no proof → 403", logoutNoProof.status === 403, `status=${logoutNoProof.status}`);
    const anonLogout = await req("POST", "/api/auth/logout", {}, {});
    check("anonymous logout (no cookies) stays idempotent 200", anonLogout.status === 200, `status=${anonLogout.status}`);
    const logoutOk = await req("POST", "/api/auth/logout", authed(jar), {});
    check("logout with proof → 200", logoutOk.status === 200, `status=${logoutOk.status}`);
    const meAfterLogout = await req("GET", "/api/auth/me", cookieOnly);
    check("session invalidated after CSRF-guarded logout → 401", meAfterLogout.status === 401, `status=${meAfterLogout.status}`);

    // ── Test 9: admin mutations ──
    await req("POST", "/api/auth/register", { "content-type": "application/json" }, {
      name: "CSRF Admin",
      email: "csrf-admin@example.com",
      password: "study-hard-123",
      confirmPassword: "study-hard-123",
    });
    await User.findOneAndUpdate({ email: "csrf-admin@example.com" }, { $set: { role: "ADMIN" } }).exec();
    const adminLogin = await req("POST", "/api/auth/login", { "content-type": "application/json" }, {
      email: "csrf-admin@example.com",
      password: "study-hard-123",
    });
    const adminJar = toJar(adminLogin.setCookie);
    const noticeBody = { heading: "CSRF drill", type: "general", announcer: "library", date: new Date().toISOString() };
    const adminNoProof = await req("POST", "/api/admin/notices", { cookie: adminJar.cookie }, noticeBody);
    check("admin mutation without proof → 403", adminNoProof.status === 403, `status=${adminNoProof.status}`);
    const adminOk = await req("POST", "/api/admin/notices", authed(adminJar), noticeBody);
    check("admin mutation with proof → 201", adminOk.status === 201, `status=${adminOk.status}`);
    const adminList = await req("GET", "/api/admin/notices", { cookie: adminJar.cookie });
    const created = Array.isArray(adminList.json?.data) && adminList.json.data.some((n: any) => n?.heading === "CSRF drill");
    check("admin write applied exactly once (no phantom from blocked attempt)", created && adminList.json.data.filter((n: any) => n?.heading === "CSRF drill").length === 1);
    // DELETE + restore with proof (proves successful DELETE/restore past CSRF).
    const noticeId = Array.isArray(adminList.json?.data)
      ? String(adminList.json.data.find((n: any) => n?.heading === "CSRF drill")?._id ?? "")
      : "";
    const adminDeleteNoProof = await req("DELETE", `/api/admin/notices/${noticeId}`, { cookie: adminJar.cookie });
    check("admin DELETE without proof → 403", adminDeleteNoProof.status === 403, `status=${adminDeleteNoProof.status}`);
    const adminDelete = await req("DELETE", `/api/admin/notices/${noticeId}`, authed(adminJar));
    check("admin DELETE with proof → 200", adminDelete.status === 200, `status=${adminDelete.status}`);
    const adminRestore = await req("POST", `/api/admin/notices/${noticeId}/restore`, authed(adminJar), {});
    check("admin restore POST with proof → 200", adminRestore.status === 200, `status=${adminRestore.status}`);
    const adminGetNoProof = await req("GET", "/api/admin/notices", { cookie: adminJar.cookie });
    check("admin GET without proof → 200", adminGetNoProof.status === 200, `status=${adminGetNoProof.status}`);

    // ── Test 10: CSRF failure never invalidates the session ──
    const meAfter403 = await req("GET", "/api/auth/me", { cookie: adminJar.cookie });
    check("session intact after CSRF 403s → /me 200", meAfter403.status === 200, `status=${meAfter403.status}`);

    console.log(`\nverify:csrf ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await disconnectDb();
    await cleanup();
  }

  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
