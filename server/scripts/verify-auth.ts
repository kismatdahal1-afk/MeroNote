import dotenv from "dotenv";

dotenv.config();

// Test-only fallback, assigned here at module evaluation — before main()
// dynamic-imports the env-dependent modules below.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "verify-auth-only-test-secret";
}

/**
 * Phase 3 auth verification: `npm run verify-auth`
 *
 * Boots the REAL app + real auth stack against a live database
 * (MONGODB_URI when set, otherwise an ephemeral in-memory server)
 * and asserts the full contract over HTTP:
 * register → duplicate rejection → hash-only storage → login ok/ko →
 * me → logout → protected-route matrix (401/403/200) → health.
 *
 * Refuses NODE_ENV=production. Never logs passwords, hashes, or tokens
 * (cookie values are redacted before any output).
 * Exit 0 = all checks pass.
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

function redactCookieHeader(value: string | null): string {
  if (!value) return "(none)";
  return value
    .split(";")
    .map((part) => {
      const [k, ...rest] = part.trim().split("=");
      return rest.length > 0 ? `${k}=<redacted>` : k;
    })
    .join("; ");
}

async function main(): Promise<void> {
  const [{ MongoMemoryServer }] = await Promise.all([import("mongodb-memory-server")]);
  const [{ createApp }] = await Promise.all([import("../src/app")]);
  const [{ env }] = await Promise.all([import("../src/config/env")]);
  const [{ connectDb, disconnectDb }] = await Promise.all([import("../src/db/connection")]);
  const [{ User }] = await Promise.all([import("../src/models/index")]);

  if (env.nodeEnv === "production") {
    throw new Error("verify-auth refuses to run with NODE_ENV=production.");
  }

  let memory: MongoMemoryServer | null = null;
  let uri = env.mongodbUri;
  if (!uri) {
    memory = await MongoMemoryServer.create();
    uri = memory.getUri("meronote-auth");
    console.log("verify: no MONGODB_URI set — using ephemeral in-memory MongoDB");
  }
  await connectDb(uri);

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const post = async (path: string, body: unknown, cookie?: string): Promise<{ status: number; json: any; setCookie: string | null }> => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json(), setCookie: res.headers.get("set-cookie") };
  };
  const get = async (path: string, cookie?: string): Promise<{ status: number; json: any }> => {
    const res = await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} });
    return { status: res.status, json: await res.json() };
  };
  const sessionCookie = (setCookie: string | null): string => (setCookie ? setCookie.split(";")[0] : "");

  // 1. Register succeeds.
  const reg = await post("/api/auth/register", {
    email: "student@example.com",
    password: "study-hard-123",
    confirmPassword: "study-hard-123",
  });
  check("register 201 + safe user", reg.status === 201 && reg.json.data?.role === "USER", `status=${reg.status}`);
  const studentCookie = sessionCookie(reg.setCookie);
  check("register sets HttpOnly session cookie", Boolean(studentCookie) && (reg.setCookie ?? "").includes("HttpOnly"));

  // 2. Duplicate email rejected.
  const dup = await post("/api/auth/register", {
    email: "student@example.com",
    password: "study-hard-123",
    confirmPassword: "study-hard-123",
  });
  check("duplicate email 409", dup.status === 409);

  // 3. Invalid input rejected.
  const badEmail = await post("/api/auth/register", { email: "not-an-email", password: "study-hard-123", confirmPassword: "study-hard-123" });
  const weak = await post("/api/auth/register", { email: "weak@example.com", password: "short", confirmPassword: "short" });
  const mismatch = await post("/api/auth/register", { email: "mm@example.com", password: "study-hard-123", confirmPassword: "different-123" });
  check("invalid email/weak password/mismatch → 400", badEmail.status === 400 && weak.status === 400 && mismatch.status === 400);

  // 4. Password stored only as hash; never returned.
  const stored = await User.findOne({ email: "student@example.com" }).select("+passwordHash").lean().exec();
  const hash = (stored as { passwordHash?: string } | null)?.passwordHash ?? "";
  check("passwordHash is bcrypt hash, not plain text", hash.startsWith("$2") && hash !== "study-hard-123");
  const bodies = JSON.stringify([reg.json, dup.json, badEmail.json]);
  check("passwordHash never in responses", !bodies.includes("passwordHash") && !bodies.includes("$2"));

  // 5. Login ok / ko.
  const login = await post("/api/auth/login", { email: "student@example.com", password: "study-hard-123", remember: true });
  check("login 200 + sets cookie", login.status === 200 && Boolean(sessionCookie(login.setCookie)));
  check("remember-me cookie is persistent", (login.setCookie ?? "").includes("Expires=") || (login.setCookie ?? "").includes("Max-Age"));
  const wrong = await post("/api/auth/login", { email: "student@example.com", password: "wrong-password-1" });
  const unknown = await post("/api/auth/login", { email: "nobody@example.com", password: "study-hard-123" });
  check(
    "wrong password / unknown user → 401 generic",
    wrong.status === 401 && unknown.status === 401 && wrong.json.message === unknown.json.message,
  );

  // 6. me + logout.
  const meAuthed = await get("/api/auth/me", sessionCookie(login.setCookie));
  check("me returns current user", meAuthed.status === 200 && meAuthed.json.data?.email === "student@example.com");
  const meAnon = await get("/api/auth/me");
  check("me without cookie → 401", meAnon.status === 401);
  const logout = await post("/api/auth/logout", {}, sessionCookie(login.setCookie));
  check("logout 200 and clears cookie", logout.status === 200 && (logout.setCookie ?? "").includes("Expires="));
  const meAfter = await get("/api/auth/me", "");
  check("me after logout → 401", meAfter.status === 401);

  // 7. Authorization matrix on the admin probe.
  const anonAdmin = await get("/api/auth/admin/ping");
  const userAdmin = await get("/api/auth/admin/ping", studentCookie);
  await User.findOneAndUpdate({ email: "student@example.com" }, { $set: { role: "ADMIN" } }).exec();
  const adminLogin = await post("/api/auth/login", { email: "student@example.com", password: "study-hard-123" });
  const adminCookie = sessionCookie(adminLogin.setCookie);
  const adminAdmin = await get("/api/auth/admin/ping", adminCookie);
  check("anonymous → admin route 401", anonAdmin.status === 401);
  check("USER → admin route 403", userAdmin.status === 403);
  check("ADMIN → admin route 200", adminAdmin.status === 200 && adminLogin.json.data?.role === "ADMIN");

  // 8. Health untouched.
  const health = await get("/api/health");
  check("GET /api/health still ok", health.status === 200 && health.json.status === "ok");

  console.log(`session cookie sample: ${redactCookieHeader(reg.setCookie)}`);

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  if (memory) await memory.stop();

  console.log(`\nverify:auth ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
