import dotenv from "dotenv";

dotenv.config();

/**
 * Phase 6 file-access verification: `npm run verify:resource-file`
 *
 * Boots the REAL app against an ephemeral database (ALLOW_REAL_DB=1 for an
 * intentional real-DB run), seeds the mock transform, and asserts the secure
 * PDF access contract over HTTP:
 * 400 invalid id / 404 missing+hidden+draft / 410 fileless /
 * 503 without B2 credentials (credential-free body) / route isolation.
 * Live presigned-URL issuance is honestly skipped without B2 credentials.
 *
 * Refuses NODE_ENV=production. Never prints URLs, keys, or secrets.
 * Exit 0 = all checks pass.
 */

import type { Server } from "http";
import type { AddressInfo } from "net";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { useTestDatabase } from "./testDb";
import { b2CredsUsable } from "./b2TestEnv";
import { deleteObject, uploadPdf } from "../src/storage/b2.service";
import { Resource } from "../src/models/index";
import { seedDev } from "../src/seed/seedDev";
import { loadDevSeedInput } from "./devSeedInput";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function leaksSecrets(body: string): boolean {
  // Generic patterns only — never embed a real hostname or credential here.
  return /B2_|APPLICATION_KEY|secret|mongodb(\+srv)?:\/\/|\.mongodb\.net|backblaze/i.test(body);
}

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("verify:resource-file refuses to run with NODE_ENV=production.");
  }

  const { uri, cleanup } = await useTestDatabase("file");
  await connectDb(uri);
  await seedDev(loadDevSeedInput());

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (path: string): Promise<{ status: number; text: string; json: any }> => {
    const res = await fetch(`${base}${path}`);
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON bodies fail the envelope checks below.
    }
    return { status: res.status, text, json };
  };

  const seeded = await Resource.findOne().exec();
  const seededId = String(seeded?._id);

  // 1-2. ID handling.
  const badId = await get("/api/resources/not-an-id/file");
  check("invalid id → 400 + error envelope", badId.status === 400 && badId.json?.status === "error");
  const missing = await get("/api/resources/000000000000000000000000/file");
  check("missing resource → 404", missing.status === 404 && missing.json?.status === "error");

  // 3. Fileless resource → 410 (key removed via raw update, bypassing validation).
  await Resource.collection.updateOne({ _id: seeded?._id }, { $unset: { "file.key": "" } });
  const fileless = await get(`/api/resources/${seededId}/file`);
  check("resource without file → 410", fileless.status === 410 && /no file/i.test(fileless.json?.message ?? ""));
  await Resource.collection.updateOne({ _id: seeded?._id }, { $set: { "file.key": "pending-migration/restore.pdf" } });

  // 4. Hidden + draft unreachable.
  await Resource.findByIdAndUpdate(seeded?._id, { $set: { hidden: true } }).exec();
  const hidden = await get(`/api/resources/${seededId}/file`);
  await Resource.findByIdAndUpdate(seeded?._id, { $set: { hidden: false } }).exec();
  const draft = await Resource.create({
    semesterId: seeded?.semesterId,
    subjectId: seeded?.subjectId,
    title: "Draft File Verify",
    type: "short_note",
    fileName: "draft-file-verify.pdf",
    fileSize: 512,
    pageCount: 3,
    status: "draft",
    file: { key: "content/draft-file.pdf", bucket: "mero-note-dev", mime: "application/pdf" },
  });
  const draftRes = await get(`/api/resources/${draft._id}/file`);
  await Resource.findByIdAndDelete(draft._id).exec();
  check("hidden resource → 404", hidden.status === 404);
  check("draft resource → 404", draftRes.status === 404);

  // 5. Valid resource without usable B2 creds → 503, credential-free,
  // envelope-shaped. Template placeholders count as unconfigured (offline tier).
  // The offline fetch runs only on the offline tier — live mode provisions
  // its own temp object below instead of hitting the seed key.
  if (!b2CredsUsable()) {
    const live = await get(`/api/resources/${seededId}/file`);
    check(
      "no B2 creds → 503 + error envelope",
      live.status === 503 && live.json?.status === "error" && typeof live.json?.message === "string",
      `status=${live.status}`,
    );
    check("503 body leaks no secrets", !leaksSecrets(live.text));
    console.log("LIVE SKIPPED — B2 credentials not configured; presigned-URL issuance untested against real B2.");
  } else {
    // Live: self-provision a temp object + temp resource, prove the 200
    // envelope, then remove both (nothing permanent left behind).
    const tinyPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
    let liveKey = "";
    let liveResId = "";
    try {
      const meta = await uploadPdf({
        resourceId: "phase6-verify",
        fileName: "live-probe.pdf",
        mime: "application/pdf",
        body: tinyPdf,
      });
      liveKey = meta.key;
      const probe = await Resource.create({
        semesterId: seeded?.semesterId,
        subjectId: seeded?.subjectId,
        title: "Live File Verify",
        type: "short_note",
        fileName: "live-probe.pdf",
        fileSize: meta.sizeBytes,
        pageCount: 1,
        status: "published",
        file: { key: meta.key, bucket: meta.bucket, mime: meta.mime },
      });
      liveResId = String(probe._id);
      const liveHit = await get(`/api/resources/${liveResId}/file`);
      const okShape =
        liveHit.status === 200 &&
        typeof liveHit.json?.data?.url === "string" &&
        liveHit.json?.data?.expiresIn === 900;
      check("valid resource → presigned URL envelope", okShape, `status=${liveHit.status}`);
      check("URL body leaks no secrets", !leaksSecrets(liveHit.text.replace(liveHit.json?.data?.url ?? "", "<url>")));
    } finally {
      if (liveResId) await Resource.findByIdAndDelete(liveResId).exec().catch(() => {});
      if (liveKey) await deleteObject(liveKey).catch(() => {});
    }
  }

  // 6. Route isolation: detail endpoint unaffected.
  const detail = await get(`/api/resources/${seededId}`);
  check("GET /:id still 200 (no route clash)", detail.status === 200 && detail.json?.status === "ok");

  // 7. Health untouched.
  const health = await get("/api/health");
  check("GET /api/health still ok", health.status === 200 && health.json?.status === "ok");

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectDb();
  await cleanup();

  console.log(`\nverify:resource-file ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
