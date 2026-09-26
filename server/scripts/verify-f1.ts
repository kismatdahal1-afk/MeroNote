import dotenv from "dotenv";
dotenv.config();
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-f1-test-secret";
}

/**
 * F1 server-side logout-invalidation verification: `npx tsx scripts/verify-f1.ts`
 *
 * Boots the REAL app + real auth stack against an ephemeral in-memory
 * database and proves logout truly invalidates previously issued JWTs via
 * the MongoDB-backed users.sessionVersion epoch (JWT.v must match).
 * Covers: normal auth, old-JWT replay → 401, post-logout relogin, old-vs-new
 * tokens, admin replay, multi-device invalidation, legacy (v-less) tokens,
 * expired/malformed/unknown-user tokens, and logout DB-failure safety.
 *
 * Refuses NODE_ENV=production. Never logs tokens or secrets.
 * Exit 0 = all checks pass.
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
  const [{ sessionCookieName }] = await Promise.all([import("../src/auth/tokens")]);
  const [{ default: jwt }] = await Promise.all([import("jsonwebtoken")]);

  if (env.nodeEnv === "production") {
    throw new Error("verify-f1 refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("f1");
  await connectDb(uri);

  const app = createApp();
  const server: import("http").Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const base = `http://127.0.0.1:${(server.address() as import("net").AddressInfo).port}`;

  const post = async (path: string, body: unknown, cookie?: string, extraHeaders?: Record<string, string>) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(extraHeaders ?? {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json(), setCookie: res.headers.get("set-cookie") };
  };
  const get = async (path: string, cookie?: string) => {
    const res = await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} });
    return { status: res.status, json: await res.json() };
  };
  // Combined set-cookie headers join entries with ", " (Expires dates contain
  // commas), so extract by name instead of splitting.
  const cookieValue = (setCookie: string | null, name: string): string => {
    const m = (setCookie ?? "").match(new RegExp(`${name}=([^;]+)`));
    return m ? m[1] : "";
  };
  // Browser-equivalent credential jar: both cookies for the Cookie header +
  // the raw CSRF value for the double-submit header (F3).
  interface Jar {
    cookie: string;
    csrf: string;
  }
  const toJar = (setCookie: string | null): Jar => {
    const session = cookieValue(setCookie, "meronote_session");
    const csrf = cookieValue(setCookie, "meronote_csrf");
    return { cookie: `meronote_session=${session}; meronote_csrf=${csrf}`, csrf };
  };
  const logoutJar = (jar: Jar) =>
    post("/api/auth/logout", {}, jar.cookie, { "x-csrf-token": jar.csrf });
  // Wrap a raw JWT in the session cookie name so cookie-parser routes it correctly.
  const asCookie = (token: string) => `${sessionCookieName()}=${token}`;

  // Helper: register a fresh user
  async function registerUser(email: string): Promise<Jar> {
    const r = await post("/api/auth/register", {
      email,
      password: "study-hard-123",
      confirmPassword: "study-hard-123",
    });
    return toJar(r.setCookie);
  }

  // Helper: login and return credentials
  async function loginUser(email: string, remember = false): Promise<Jar> {
    const r = await post("/api/auth/login", { email, password: "study-hard-123", remember });
    return toJar(r.setCookie);
  }

  // ── Test 1: Normal authentication ──
  {
    const jar = await registerUser("f1-normal@example.com");
    const me = await get("/api/auth/me", jar.cookie);
    check("F1: normal auth → /me 200", me.status === 200, `status=${me.status}`);
  }

  // ── Test 2: Logout invalidates JWT (core F1 test) ──
  {
    const jar = await registerUser("f1-replay@example.com");
    const meBefore = await get("/api/auth/me", jar.cookie);
    check("F1: pre-logout /me 200", meBefore.status === 200);

    const logout = await logoutJar(jar);
    check("F1: logout 200", logout.status === 200);

    // Replay the EXACT same JWT after logout
    const meAfter = await get("/api/auth/me", jar.cookie);
    check("F1: replay original JWT after logout → 401", meAfter.status === 401, `status=${meAfter.status}`);
  }

  // ── Test 3: New login after logout gets new version ──
  {
    const jar = await registerUser("f1-newlogin@example.com");
    const logout = await logoutJar(jar);
    check("F1: pre-logout logout 200", logout.status === 200);

    const newJar = await loginUser("f1-newlogin@example.com");
    const me = await get("/api/auth/me", newJar.cookie);
    check("F1: new login after logout → /me 200", me.status === 200, `status=${me.status}`);
  }

  // ── Test 4: Old token vs new token after logout ──
  {
    const jar = await registerUser("f1-oldvnew@example.com");
    const logout = await logoutJar(jar);
    check("F1: old-vs-new logout 200", logout.status === 200);

    // Old cookie should be 401
    const oldMe = await get("/api/auth/me", jar.cookie);
    check("F1: old token after logout → 401", oldMe.status === 401);

    // New login should work
    const newJar = await loginUser("f1-oldvnew@example.com");
    const newMe = await get("/api/auth/me", newJar.cookie);
    check("F1: new token after logout → 200", newMe.status === 200);
  }

  // ── Test 5: Admin token logout → 401 replay ──
  {
    const jar = await registerUser("f1-admin@example.com");
    // Promote to admin
    await User.findOneAndUpdate({ email: "f1-admin@example.com" }, { $set: { role: "ADMIN" } }).exec();
    const adminLogin = await post("/api/auth/login", {
      email: "f1-admin@example.com",
      password: "study-hard-123",
    });
    const adminJar = toJar(adminLogin.setCookie);

    // Admin access works
    const adminPing = await get("/api/auth/admin/ping", adminJar.cookie);
    check("F1: admin ping 200", adminPing.status === 200);

    // Logout admin
    const adminLogout = await logoutJar(adminJar);
    check("F1: admin logout 200", adminLogout.status === 200);

    // Replay old admin JWT → 401
    const adminReplay = await get("/api/auth/admin/ping", adminJar.cookie);
    check("F1: replay old admin JWT → 401", adminReplay.status === 401);
  }

  // ── Test 6: Multiple devices (same user, same version) ──
  {
    const jarA = await registerUser("f1-multi@example.com");
    // Login from second device (same user, same sessionVersion)
    const jarB = await loginUser("f1-multi@example.com");

    // Both work before logout
    const meA = await get("/api/auth/me", jarA.cookie);
    const meB = await get("/api/auth/me", jarB.cookie);
    check("F1: device A pre-logout → 200", meA.status === 200);
    check("F1: device B pre-logout → 200", meB.status === 200);

    // Logout from device A
    const logout = await logoutJar(jarA);
    check("F1: multi-device logout 200", logout.status === 200);

    // Both tokens invalidated
    const afterA = await get("/api/auth/me", jarA.cookie);
    const afterB = await get("/api/auth/me", jarB.cookie);
    check("F1: device A after logout → 401", afterA.status === 401);
    check("F1: device B after logout → 401", afterB.status === 401);
  }

  // ── Test 7: Legacy token (no v claim) ──
  {
    // Register a user (gets v=0 cookie)
    const jar = await registerUser("f1-legacy@example.com");

    // Manually create a legacy JWT without v claim for the real user's _id.
    const user = await User.findOne({ email: "f1-legacy@example.com" }).exec();
    if (user) {
      const legacyToken = jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: "7d" });
      const legacyCookie = asCookie(legacyToken);

      // Legacy token (no v) + DB sessionVersion 0 → accepted
      const meLegacy = await get("/api/auth/me", legacyCookie);
      check("F1: legacy token (no v) + version 0 → 200", meLegacy.status === 200, `status=${meLegacy.status}`);

      // Logout → bumps version to 1
      const logout = await logoutJar(jar);
      check("F1: legacy logout 200", logout.status === 200);

      // Same legacy token → 401
      const meLegacyAfter = await get("/api/auth/me", legacyCookie);
      check("F1: legacy token after logout → 401", meLegacyAfter.status === 401);
    } else {
      check("F1: legacy token test skipped (user not found)", false);
    }
  }

  // ── Test 8: Expired JWT → 401 ──
  {
    const expiredToken = jwt.sign({ sub: "nonexistent", role: "USER", v: 0 }, env.jwtSecret, { expiresIn: "-1h" });
    const me = await get("/api/auth/me", asCookie(expiredToken));
    check("F1: expired JWT → 401", me.status === 401, `status=${me.status}`);
  }

  // ── Test 9: Malformed JWT → 401 ──
  {
    const me = await get("/api/auth/me", asCookie("not.a.valid.token"));
    check("F1: malformed JWT → 401", me.status === 401, `status=${me.status}`);
  }

  // ── Test 10: Nonexistent user sub → 401 ──
  {
    const fakeToken = jwt.sign({ sub: "507f1f77bcf86cd799439011", role: "USER", v: 0 }, env.jwtSecret, { expiresIn: "7d" });
    const me = await get("/api/auth/me", asCookie(fakeToken));
    check("F1: nonexistent user sub → 401", me.status === 401, `status=${me.status}`);
  }

  // ── Test 11: Logout DB failure → no false success, cookie NOT cleared ──
  {
    const jar = await registerUser("f1-dbfail@example.com");

    // Simulate a version-increment failure by temporarily breaking updateOne.
    const model = User as unknown as Record<string, unknown>;
    const originalUpdateOne = model.updateOne;
    model.updateOne = () => {
      throw new Error("simulated sessionVersion increment failure");
    };
    let logout: { status: number; json: unknown; setCookie: string | null };
    try {
      logout = await logoutJar(jar);
    } finally {
      model.updateOne = originalUpdateOne;
    }

    const failed = logout.status >= 500;
    check("F1: logout DB failure does not claim success", failed, `status=${logout.status}`);
    check("F1: logout DB failure does not clear cookie", logout.setCookie === null);

    // Server-side token must remain logically valid (DB untouched).
    const stillValid = await get("/api/auth/me", jar.cookie);
    check("F1: token still valid after failed logout", stillValid.status === 200, `status=${stillValid.status}`);
  }

  console.log(`\nverify:f1 ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
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
