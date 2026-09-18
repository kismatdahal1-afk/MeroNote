import dotenv from "dotenv";

dotenv.config();

/**
 * Phase 5 B2 verification: `npm run verify-b2`
 *
 * Tier 1 (always runs, no credentials/network/DB needed):
 * config validation, endpoint derivation, object-key vectors (incl.
 * traversal attacks), PDF validation rules, checksum vectors, and the
 * no-credentials failure path (B2 upload fails → MongoDB never touched).
 *
 * Tier 2 (live, ONLY when B2_KEY_ID + B2_APPLICATION_KEY + B2_BUCKET_NAME
 * are all set): bucket HEAD → upload temp object
 * `resources/phase5-verify/*.pdf` → HEAD exists → presigned-URL byte
 * round-trip → delete → HEAD confirms removal. Without credentials it
 * honestly reports LIVE SKIPPED and still exits 0 on Tier 1 pass.
 *
 * Never prints keys, secrets, URIs, or signed URLs. Never touches MongoDB.
 * Exit 0 = pass (or clean skip of Tier 2).
 */

import { env } from "../src/config/env";
import { b2Bucket, b2Endpoint, requireB2Config } from "../src/storage/b2.client";
import {
  ALLOWED_PDF_MIME,
  FileRejectedError,
  maxPdfBytes,
  validatePdfUpload,
} from "../src/storage/fileRules";
import { buildResourceKey, sanitizeFileName, UnsafeKeyError } from "../src/storage/objectKeys";
import {
  checkBucketAccess,
  deleteObject,
  getDownloadUrl,
  objectExists,
  sha256Hex,
  StorageMissingError,
  uploadPdf,
} from "../src/storage/b2.service";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function expectThrow(name: string, fn: () => unknown, kind: new (...args: never[]) => Error): void {
  try {
    fn();
    check(name, false, "expected throw, returned instead");
  } catch (err) {
    check(name, err instanceof kind, err instanceof Error ? err.message.slice(0, 100) : String(err));
  }
}

const MINIMAL_PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("verify-b2 refuses to run with NODE_ENV=production.");
  }

  // ---- Tier 1: offline ----
  const rawEndpoint = (process.env.B2_ENDPOINT ?? "").trim();
  const expectedEndpoint = rawEndpoint || `https://s3.${env.b2Region}.backblaze.com`;
  check("endpoint derivation", b2Endpoint() === expectedEndpoint, b2Endpoint());

  const credsPresent = Boolean(env.b2KeyId && env.b2ApplicationKey && env.b2BucketName);
  if (credsPresent) {
    let ok = true;
    try {
      requireB2Config();
    } catch {
      ok = false;
    }
    check("config accepts complete credentials", ok);
  } else {
    expectThrow("config rejects missing credentials", () => requireB2Config(), Error);
  }

  check("resource key shape", buildResourceKey("res-123", "My Notes.pdf") === "resources/res-123/my-notes.pdf");
  check("key deterministic", buildResourceKey("res-123", "My Notes.pdf") === buildResourceKey("res-123", "My Notes.pdf"));
  check(
    "traversal neutralized",
    buildResourceKey("abc", "../../etc/passwd.pdf") === "resources/abc/passwd.pdf" &&
      buildResourceKey("abc", "/abs/path/x.pdf") === "resources/abc/x.pdf" &&
      !buildResourceKey("abc", "..\\..\\win.pdf").includes(".."),
  );
  check("slugify unsafe chars", sanitizeFileName("DSA: Trees & Graphs (v2).PDF") === "dsa-trees-graphs-v2.pdf");
  expectThrow("bad resource id rejected", () => buildResourceKey("../x", "a.pdf"), UnsafeKeyError);
  expectThrow("empty resource id rejected", () => buildResourceKey("", "a.pdf"), UnsafeKeyError);
  expectThrow("empty file name rejected", () => sanitizeFileName("..."), UnsafeKeyError);

  const valid = validatePdfUpload({ fileName: "notes.pdf", mime: ALLOWED_PDF_MIME, body: MINIMAL_PDF });
  check("valid PDF accepted", valid.sizeBytes === MINIMAL_PDF.length && valid.mime === ALLOWED_PDF_MIME);
  expectThrow("wrong extension rejected", () => validatePdfUpload({ fileName: "notes.txt", mime: ALLOWED_PDF_MIME, body: MINIMAL_PDF }), FileRejectedError);
  expectThrow("wrong MIME rejected", () => validatePdfUpload({ fileName: "notes.pdf", mime: "image/png", body: MINIMAL_PDF }), FileRejectedError);
  expectThrow("empty file rejected", () => validatePdfUpload({ fileName: "notes.pdf", mime: ALLOWED_PDF_MIME, body: Buffer.alloc(0) }), FileRejectedError);
  expectThrow(
    "non-PDF content rejected",
    () => validatePdfUpload({ fileName: "notes.pdf", mime: ALLOWED_PDF_MIME, body: Buffer.from("hello world, not a pdf") }),
    FileRejectedError,
  );
  check("max size default 100MB", maxPdfBytes() === 100 * 1024 * 1024, `${maxPdfBytes()}`);
  const oversize = Buffer.alloc(maxPdfBytes() + 1);
  oversize.set(Buffer.from("%PDF-"));
  expectThrow("oversize file rejected", () => validatePdfUpload({ fileName: "big.pdf", mime: ALLOWED_PDF_MIME, body: oversize }), FileRejectedError);

  check(
    "sha256 known vector",
    sha256Hex(Buffer.from("abc")) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );

  if (!credsPresent) {
    let blocked = false;
    try {
      await uploadPdf({ resourceId: "phase5-verify", fileName: "t.pdf", mime: ALLOWED_PDF_MIME, body: MINIMAL_PDF });
    } catch (err) {
      blocked = err instanceof Error && err.message.includes("not configured");
    }
    check("upload without creds fails before any storage (case A)", blocked);
  }

  // ---- Tier 2: live (gated) ----
  if (!credsPresent) {
    console.log("LIVE SKIPPED — B2_KEY_ID / B2_APPLICATION_KEY / B2_BUCKET_NAME not all set.");
  } else {
    const probe = await checkBucketAccess();
    check("bucket reachable", probe.reachable, `bucket=${probe.bucket}`);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const resourceId = "phase5-verify";
    const before = await objectExists(`resources/${resourceId}/roundtrip-${stamp}.pdf`);
    check("temp key absent before upload", before === false);

    const meta = await uploadPdf({ resourceId, fileName: `roundtrip-${stamp}.pdf`, mime: ALLOWED_PDF_MIME, body: MINIMAL_PDF });
    check("upload returns pointer meta", meta.bucket === b2Bucket() && meta.checksum.length === 64 && meta.sizeBytes === MINIMAL_PDF.length, meta.key);
    try {
      check("object exists after upload", (await objectExists(meta.key)) === true);
      const url = await getDownloadUrl(meta.key, 300);
      const fetched = Buffer.from(await (await fetch(url)).arrayBuffer());
      check("presigned-URL byte round-trip", fetched.equals(MINIMAL_PDF));

      let missingThrows = false;
      try {
        await getDownloadUrl(`resources/${resourceId}/does-not-exist.pdf`);
      } catch (err) {
        missingThrows = err instanceof StorageMissingError;
      }
      check("missing object → StorageMissingError (case C)", missingThrows);
    } finally {
      await deleteObject(meta.key);
    }
    check("object removed after delete", (await objectExists(meta.key)) === false);
  }

  console.log(`\nverify:b2 ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
