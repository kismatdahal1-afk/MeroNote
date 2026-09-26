import dotenv from "dotenv";

dotenv.config();

// Test-only fallback, assigned here at module evaluation — before main()
// dynamic-imports the env-dependent modules below.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-refresh-only-test-secret";
}

/**
 * F4 refresh-token verification: `npx tsx scripts/verify-refresh.ts`
 *
 * Boots the REAL app + real auth/refresh stack against an ephemeral
 * in-memory database and asserts the access/refresh lifecycle over HTTP:
 * dual-credential issuance, short-lived access use, one-time atomic
 * rotation, replay/reuse rejection with family revocation, expiry/unknown
 * handling, F1-epoch integration, concurrent-rotation safety, CSRF gating,
 * logout invalidation of both layers, and multi-device semantics.
 *
 * Refuses NODE_ENV=production. Never logs raw tokens, hashes, cookies, or
 * secrets (only presence/length/shape is asserted). Exit 0 = all pass.
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
  const [{ User, RefreshToken }] = await Promise.all([import("../src/models/index")]);
  const [{ default: jwt }] = await Promise.all([import("jsonwebtoken")]);

  if (env.nodeEnv === "production") {
    throw new Error("verify-refresh refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("refresh");
  await connectDb(uri);

  const app = createApp();
  const server: import("http").Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    const base = `http://127.0.0.1:${(server.address() as import("net").AddressInfo).port}`;

    interface Jar {
      cookie: string;
      csrf: string;
      refresh: string;
    }

    const cookieValue = (setCookie: string | null, name: string): string => {
      const m = (setCookie ?? "").match(new RegExp(`${name}=([^;]+)`));
      return m ? m[1] : "";
    };
    const toJar = (setCookie: string | null): Jar => {
      const session = cookieValue(setCookie, "meronote_session");
      const csrf = cookieValue(setCookie, "meronote_csrf");
      const refresh = cookieValue(setCookie, "meronote_refresh");
      return {
        cookie: `meronote_session=${session}; meronote_csrf=${csrf}; meronote_refresh=${refresh}`,
        csrf,
        refresh,
      };
    };
    // Rotation responses carry no CSRF cookie (rotation never invalidates it;
    // browsers keep their own). Merge a fresh pair with a known-good CSRF.
    const refreshJar = (setCookie: string | null, csrf: string): Jar => {
      const session = cookieValue(setCookie, "meronote_session");
      const refresh = cookieValue(setCookie, "meronote_refresh");
      return {
        cookie: `meronote_session=${session}; meronote_csrf=${csrf}; meronote_refresh=${refresh}`,
        csrf,
        refresh,
      };
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
    ): Promise<{ status: number; json: any; setCookie: string | null }> => {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: res.status, json: await res.json().catch(() => ({})), setCookie: res.headers.get("set-cookie") };
    };
    const registerUser = async (email: string): Promise<Jar> => {
      const r = await req("POST", "/api/auth/register", { "content-type": "application/json" }, {
        name: "Refresh User",
        email,
        password: "study-hard-123",
        confirmPassword: "study-hard-123",
      });
      if (r.status !== 201) throw new Error(`register failed: ${r.status}`);
      return toJar(r.setCookie);
    };
    const doRefresh = (jar: Jar, extra?: Record<string, string>) =>
      req("POST", "/api/auth/refresh", withProof(jar, extra), {});
    // Fresh public CSRF pair for presenting a bare refresh cookie (e.g. an
    // old refresh token after its session cookies were cleared on logout).
    const freshCsrfPair = async (): Promise<{ cookie: string; csrf: string }> => {
      const boot = await req("GET", "/api/auth/csrf");
      const csrf = cookieValue(boot.setCookie, "meronote_csrf");
      return { cookie: `meronote_csrf=${csrf}`, csrf };
    };

    // ── Test 1: login issues both credentials, SafeUser-compatible body ──
    const reg = await req("POST", "/api/auth/register", { "content-type": "application/json" }, {
      name: "Refresh User",
      email: "refresh@example.com",
      password: "study-hard-123",
      confirmPassword: "study-hard-123",
    });
    check("register 201", reg.status === 201, `status=${reg.status}`);
    const jarR1 = toJar(reg.setCookie);
    check(
      "register sets access + refresh cookies",
      /meronote_session=[A-Za-z0-9]/.test(jarR1.cookie) && jarR1.refresh.length === 64,
    );
    const bodyKeys = Object.keys(reg.json?.data ?? {}).sort().join(",");
    check("register body stays SafeUser-shaped", reg.status === 201 && bodyKeys === "email,id,name,role", `keys=${bodyKeys}`);
    check("register body leaks no token material", !JSON.stringify(reg.json ?? {}).includes(jarR1.refresh || "no-refresh-issued"));

    // ── Test 2: access token works ──
    const me = await req("GET", "/api/auth/me", { cookie: jarR1.cookie });
    check("login pair → /me 200", me.status === 200 && me.json?.data?.email === "refresh@example.com", `status=${me.status}`);

    // ── Test 3: expired access + refresh → new pair → /me 200 ──
    const userId = String(me.json.data.id);
    const expiredAccess = jwt.sign({ sub: userId, role: "USER", v: 0 }, env.jwtSecret, { expiresIn: "-1h" });
    const meExpired = await req("GET", "/api/auth/me", { cookie: `meronote_session=${expiredAccess}` });
    check("expired access JWT → /me 401", meExpired.status === 401, `status=${meExpired.status}`);
    const rotated = await doRefresh(jarR1);
    check("refresh with R1 → 200", rotated.status === 200, `status=${rotated.status}`);
    const jarR2 = refreshJar(rotated.setCookie, jarR1.csrf);
    check("rotation issues a different refresh token", jarR2.refresh.length === 64 && jarR2.refresh !== jarR1.refresh);
    check("refresh body stays SafeUser-shaped", Object.keys(rotated.json?.data ?? {}).sort().join(",") === "email,id,name,role");
    const meAfter = await req("GET", "/api/auth/me", { cookie: jarR2.cookie });
    check("new access JWT → /me 200 as same user (T18)", meAfter.status === 200 && meAfter.json?.data?.email === "refresh@example.com", `status=${meAfter.status}`);

    // ── Test 4/5: R1 spent; replay → 401 ──
    const replayR1 = await doRefresh(jarR1);
    check("old refresh token replay (R1) → 401", replayR1.status === 401, `status=${replayR1.status}`);

    // ── Test 6: reuse revokes the family — R2 now dead too ──
    const replayR2 = await doRefresh(jarR2);
    check("remaining family token (R2) unusable after reuse → 401", replayR2.status === 401, `status=${replayR2.status}`);

    // ── Test 7: expired refresh record → 401, no new auth ──
    const jarExp = await registerUser("refresh-expired@example.com");
    const { createHash } = await import("crypto");
    const expiredRaw = "e".repeat(64);
    const owner = await User.findOne({ email: "refresh-expired@example.com" }).exec();
    if (!owner) throw new Error("seed user missing");
    await RefreshToken.create({
      userId: owner._id,
      familyId: "expired-family",
      tokenHash: createHash("sha256").update(expiredRaw, "utf8").digest("hex"),
      sessionVersion: 0,
      lifetimeDays: 7,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const csrfPair = await freshCsrfPair();
    const expiredAttempt = await req("POST", "/api/auth/refresh", {
      cookie: `meronote_refresh=${expiredRaw}; ${csrfPair.cookie}`,
      "x-csrf-token": csrfPair.csrf,
    }, {});
    check("expired refresh token → 401", expiredAttempt.status === 401, `status=${expiredAttempt.status}`);
    void jarExp;

    // ── Test 8: unknown refresh token → generic 401 ──
    const unknownAttempt = await req("POST", "/api/auth/refresh", {
      cookie: `meronote_refresh=${"f".repeat(64)}; ${csrfPair.cookie}`,
      "x-csrf-token": csrfPair.csrf,
    }, {});
    check(
      "unknown refresh token → generic 401",
      unknownAttempt.status === 401 && unknownAttempt.json?.message === "Authentication required.",
      `status=${unknownAttempt.status}`,
    );

    // ── Test 9: logout kills refresh (version bump + family revocation) ──
    const jarLogout = await registerUser("refresh-logout@example.com");
    const logoutRes = await req("POST", "/api/auth/logout", withProof(jarLogout), {});
    check("logout 200", logoutRes.status === 200, `status=${logoutRes.status}`);
    const cleared = logoutRes.setCookie ?? "";
    check(
      "logout clears access + refresh cookies",
      /meronote_session=[^;]*;[^,]*Expires/i.test(cleared) && /meronote_refresh=[^;]*;[^,]*Expires/i.test(cleared),
    );
    const postLogoutCsrf = await freshCsrfPair();
    const refreshAfterLogout = await req("POST", "/api/auth/refresh", {
      cookie: `meronote_refresh=${jarLogout.refresh}; ${postLogoutCsrf.cookie}`,
      "x-csrf-token": postLogoutCsrf.csrf,
    }, {});
    check("old refresh token after logout → 401", refreshAfterLogout.status === 401, `status=${refreshAfterLogout.status}`);

    // ── Test 9b: epoch mismatch alone (no revocation) blocks rotation ──
    const jarEpoch = await registerUser("refresh-epoch@example.com");
    await User.updateOne({ email: "refresh-epoch@example.com" }, { $inc: { sessionVersion: 1 } }).exec();
    const epochAttempt = await doRefresh(jarEpoch);
    check("refresh under stale sessionVersion → 401", epochAttempt.status === 401, `status=${epochAttempt.status}`);

    // ── Test: deleted user cannot rotate ──
    const jarGone = await registerUser("refresh-gone@example.com");
    await User.deleteOne({ email: "refresh-gone@example.com" }).exec();
    const goneAttempt = await doRefresh(jarGone);
    check("refresh for deleted user → 401", goneAttempt.status === 401, `status=${goneAttempt.status}`);

    // ── Test 11: concurrent rotation — exactly one winner; the loser's
    // reuse presentation revokes the family (fail-closed), so no child
    // survives and the next rotation attempt 401s. Honest collisions are
    // prevented client-side by single-flight; cross-tab races re-login.
    const jarRace = await registerUser("refresh-race@example.com");
    const raceFamily = await RefreshToken.findOne({ revokedAt: null, usedAt: null })
      .sort({ createdAt: -1 })
      .select("familyId")
      .lean()
      .exec();
    const [winA, winB] = await Promise.all([doRefresh(jarRace), doRefresh(jarRace)]);
    const statuses = [winA.status, winB.status].sort().join(",");
    check("concurrent refresh → one 200 + one 401", statuses === "200,401", `statuses=${statuses}`);
    const winnerJar = winA.status === 200 ? refreshJar(winA.setCookie, jarRace.csrf) : refreshJar(winB.setCookie, jarRace.csrf);
    const liveChildren = raceFamily
      ? await RefreshToken.countDocuments({ familyId: raceFamily.familyId, usedAt: null, revokedAt: null }).exec()
      : -1;
    check("loser reuse revoked the family (zero live records)", liveChildren === 0, `live=${liveChildren}`);
    const afterRace = await doRefresh(winnerJar);
    check("winner child unusable after family revocation → 401", afterRace.status === 401, `status=${afterRace.status}`);

    // ── Test 15: CSRF gating on refresh ──
    const jarCsrf = await registerUser("refresh-csrf@example.com");
    const noProof = await req("POST", "/api/auth/refresh", { cookie: jarCsrf.cookie }, {});
    check("refresh without CSRF proof → 403", noProof.status === 403, `status=${noProof.status}`);
    const noCookies = await req("POST", "/api/auth/refresh", {}, {});
    check("refresh without any cookies → 401 (not 403)", noCookies.status === 401, `status=${noCookies.status}`);

    // ── Test 17: multi-device — logout kills every family ──
    const jarDevA = await registerUser("refresh-multi@example.com");
    const loginB = await req("POST", "/api/auth/login", { "content-type": "application/json" }, {
      email: "refresh-multi@example.com",
      password: "study-hard-123",
    });
    const jarDevB = toJar(loginB.setCookie);
    await req("POST", "/api/auth/logout", withProof(jarDevA), {});
    const refreshB = await doRefresh(jarDevB);
    check("device B refresh fails after A logout → 401", refreshB.status === 401, `status=${refreshB.status}`);
    const meB = await req("GET", "/api/auth/me", { cookie: jarDevB.cookie });
    check("device B access dead after A logout → 401", meB.status === 401, `status=${meB.status}`);

    console.log(`\nverify:refresh ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
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
