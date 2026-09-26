import dotenv from "dotenv";

dotenv.config();

/**
 * Fixed 8-semester verification: `npm run verify:fixed-semesters`
 *
 * Focused checks for the fixed-semester architecture (ephemeral test DB —
 * real Atlas is never touched):
 *  1. Exactly 8 official semesters exist.
 *  2. Re-running the initializer creates no duplicates.
 *  3. Semester 1–8 ordering is stable.
 *  4. No 9th semester via admin API (create → 403).
 *  5. Official semesters cannot be deleted via admin API (delete → 403).
 *  6. Empty semesters return correctly (list + detail, no 404).
 *  7. Subjects can be created under an empty semester.
 *  8. Resources attach correctly through the hierarchy.
 *  9. Student portal still renders all 8 cards (static UI check).
 * 10. Admin portal still renders all 8 cards (static UI check).
 * 11. Semester cards match the FINAL NOW design (static UI check).
 * 12. (Covered by the separate regression run below.)
 *
 * Refuses NODE_ENV=production. Exit 0 = all pass. No test rows are written
 * to real Atlas; temp subjects/resources live only in the ephemeral DB.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { useTestDatabase } from "./testDb";
import { Semester } from "../src/models/index";
import { FIXED_SEMESTERS, ensureFixedSemesters } from "../src/seed/fixedSemesters";
import { User } from "../src/models/index";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("verify:fixed-semesters refuses to run with NODE_ENV=production.");
  }

  // 1–3. Bootstrap idempotency + identity + order (DB level).
  const { uri, cleanup } = await useTestDatabase("fixed-semesters");
  await connectDb(uri);
  const first = await ensureFixedSemesters();
  const count1 = await Semester.countDocuments().exec();
  check("exactly 8 official semesters exist", first.total === 8 && count1 === 8, `total=${first.total} count=${count1}`);
  const idsBefore = (await Semester.find().sort({ number: 1 }).select("_id number").lean().exec()).map((s) => String(s._id));
  const second = await ensureFixedSemesters();
  const count2 = await Semester.countDocuments().exec();
  const idsAfter = (await Semester.find().sort({ number: 1 }).select("_id number").lean().exec()).map((s) => String(s._id));
  check(
    "re-running initializer creates no duplicates (stable identity)",
    count2 === 8 && second.upserted === 0 && idsBefore.join() === idsAfter.join(),
    `count=${count2} upserted=${second.upserted}`,
  );
  const ordered = await Semester.find().sort({ order: 1 }).select("number order name").lean().exec();
  const numbers = ordered.map((s) => s.number);
  check(
    "semester 1–8 ordering stable",
    numbers.join() === "1,2,3,4,5,6,7,8" && ordered.every((s, i) => s.order === i + 1),
    `order=${numbers.join(",")}`,
  );
  check(
    "canonical metadata matches FINAL NOW source",
    FIXED_SEMESTERS.length === 8 && ordered.every((s, i) => s.name === FIXED_SEMESTERS[i].name),
  );

  // HTTP level: boot app + admin auth.
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, cookie: string | null, body?: unknown): Promise<{ status: number; json: any }> => {
    const init: RequestInit = { method, headers: {} };
    if (cookie) (init.headers as Record<string, string>).cookie = cookie;
    if (body !== undefined) {
      (init.headers as Record<string, string>)["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${base}${path}`, init);
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  const cookieOf = (setCookie: string | null): string => (setCookie ? setCookie.split(";")[0] : "");
  const register = async (email: string): Promise<void> => {
    const res = await call("POST", "/api/auth/register", null, { name: "Fixed User", email, password: "fixed-test-123", confirmPassword: "fixed-test-123" });
    if (res.status !== 201) throw new Error(`fixture register failed: ${res.status}`);
  };
  await register("fixedadmin@example.com");
  await User.findOneAndUpdate({ email: "fixedadmin@example.com" }, { $set: { role: "ADMIN" } }).exec();
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "fixedadmin@example.com", password: "fixed-test-123" }),
  });
  const admin = cookieOf(loginRes.headers.get("set-cookie"));

  // 4–5. Server-side guards.
  const create9th = await call("POST", "/api/admin/semesters", admin, { name: "Semester 9", number: 9 });
  check("no 9th semester via admin API → 403", create9th.status === 403);
  const createAny = await call("POST", "/api/admin/semesters", admin, { name: "Any" });
  check("any semester create via admin API → 403", createAny.status === 403);
  const semList = await call("GET", "/api/admin/semesters?limit=100", admin);
  const semId = String((semList.json?.data as any[])?.[0]?._id ?? "");
  const delOfficial = await call("DELETE", `/api/admin/semesters/${semId}`, admin);
  check("official semester delete via admin API → 403", delOfficial.status === 403);
  const patchOrder = await call("PATCH", `/api/admin/semesters/${semId}`, admin, { order: 8 });
  const patchNumber = await call("PATCH", `/api/admin/semesters/${semId}`, admin, { number: 8 });
  check("immutable identity/order (number+order) → 400", patchOrder.status === 400 && patchNumber.status === 400);

  // 6. Empty semesters are valid (public API, no content yet).
  const pubList = await call("GET", "/api/semesters?limit=100", null);
  const pubRows = (pubList.json?.data as any[]) ?? [];
  check("public list returns 8 empty semesters", pubList.status === 200 && pubRows.length === 8, `count=${pubRows.length}`);
  const detail = await call("GET", `/api/semesters/${semId}`, null);
  const detailSubjects = detail.json?.data?.subjects as any[];
  check(
    "empty semester detail 200 with empty subjects (not 404)",
    detail.status === 200 && Array.isArray(detailSubjects) && detailSubjects.length === 0,
  );

  // 7–8. Content hierarchy on fixed semesters (ephemeral rows only).
  const subCreate = await call("POST", "/api/admin/subjects", admin, {
    semesterId: semId,
    name: "Fixed Verify Subject",
    code: "FIX101",
    category: "core",
    status: "published",
  });
  const subId = String(subCreate.json?.data?._id ?? "");
  check("subject created under empty fixed semester → 201", subCreate.status === 201 && subId.length > 0);
  const resCreate = await call("POST", "/api/admin/resources", admin, {
    semesterId: semId,
    subjectId: subId,
    title: "Fixed Verify Resource",
    type: "short_note",
  });
  const resId = String(resCreate.json?.data?._id ?? "");
  check("resource attaches through hierarchy → 201", resCreate.status === 201 && resId.length > 0);
  const semDetailAfter = await call("GET", `/api/semesters/${semId}`, null);
  const subjectsAfter = (semDetailAfter.json?.data?.subjects as any[]) ?? [];
  check(
    "semester detail reflects new subject (stable reference)",
    semDetailAfter.status === 200 && subjectsAfter.some((s) => String(s._id) === subId),
    `subjects=${subjectsAfter.length}`,
  );

  // 9–11. Static portal/UI checks (FINAL NOW design preserved).
  const root = join(__dirname, "..", "..");
  const studentPage = readFileSync(join(root, "client", "src", "pages", "Semesters.tsx"), "utf8");
  const adminPage = readFileSync(join(root, "client", "src", "pages", "admin", "AdminSemesters.tsx"), "utf8");
  const card = readFileSync(join(root, "client", "src", "components", "cards", "SemesterCard.tsx"), "utf8");
  check(
    "student portal renders all semesters as cards (no hiding)",
    studentPage.includes("SemesterCard") && studentPage.includes("semesters.map") && !studentPage.includes("Add Semester"),
  );
  const adminHasNoSemesterCrud =
    !adminPage.includes("Add Semester") && !adminPage.includes("Delete Semester") && !adminPage.includes("Duplicate Semester") && !adminPage.includes("Reorder");
  check(
    "admin portal shows fixed cards, no Add/Delete/Duplicate/Reorder semester UI",
    adminHasNoSemesterCrud && adminPage.includes("Add Subject") && adminPage.includes("Add Resource") && adminPage.includes("No subjects yet for"),
  );
  const cardMatchesFinal =
    card.includes("min-h-[148px]") &&
    card.includes("SemesterStatusChip") &&
    card.includes("subjects") &&
    card.includes("resources") &&
    card.includes("group-hover:shadow-card-hover");
  check("semester cards match FINAL NOW design tokens", cardMatchesFinal);

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:fixed-semesters ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
