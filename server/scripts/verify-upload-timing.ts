/**
 * Upload-timing limit regression: `npm run verify:upload-timing`
 *
 * Offline, ephemeral, no database, no B2, no secrets:
 * - exercises the real server-side `validatePdfUpload` limit path with a
 *   small overridden MAX_PDF_BYTES (dotenv never overrides pre-set env, so
 *   the override wins before config loads);
 * - asserts the production wiring still enforces MAX_PDF_BYTES at both
 *   gates (multer intake + fileRules) without changing the 350 MB value.
 *
 * Refuses NODE_ENV=production. Exit 0 = all pass.
 */

process.env.MAX_PDF_BYTES = "1024";

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("verify:upload-timing refuses to run with NODE_ENV=production.");
  }
  const { validatePdfUpload, maxPdfBytes, FileRejectedError } = await import("../src/storage/fileRules");
  const fs = await import("node:fs");
  const path = await import("node:path");

  check("override limit active (1024)", maxPdfBytes() === 1024, `got=${maxPdfBytes()}`);

  const tinyPdf = new Uint8Array(Buffer.from("%PDF-1.4\ntrailer\n<<>>\n%%EOF\n"));
  const ok = validatePdfUpload({ fileName: "tiny.pdf", mime: "application/pdf", body: tinyPdf });
  check("valid tiny PDF passes", ok.sizeBytes === tinyPdf.length);

  const bigBody = new Uint8Array(1025).fill(0x25);
  bigBody.set(Buffer.from("%PDF-"), 0);
  let rejected = "";
  try {
    validatePdfUpload({ fileName: "big.pdf", mime: "application/pdf", body: bigBody });
  } catch (err) {
    rejected = err instanceof Error ? err.message : String(err);
  }
  check(
    "oversize body rejected on the limit path",
    rejected.includes("1024") && rejected.includes("byte limit"),
    rejected,
  );
  void FileRejectedError;

  let emptyRejected = false;
  try {
    validatePdfUpload({ fileName: "e.pdf", mime: "application/pdf", body: new Uint8Array(0) });
  } catch {
    emptyRejected = true;
  }
  check("empty file rejected", emptyRejected);

  let magicRejected = false;
  try {
    validatePdfUpload({ fileName: "t.pdf", mime: "application/pdf", body: new Uint8Array(Buffer.from("NOTAPDF.....")) });
  } catch {
    magicRejected = true;
  }
  check("non-PDF bytes rejected", magicRejected);

  // Production wiring intact (static, no execution): multer gate + rules gate.
  const root = path.join(__dirname, "..");
  const middleware = fs.readFileSync(path.join(root, "src", "middleware", "upload.middleware.ts"), "utf8");
  const rules = fs.readFileSync(path.join(root, "src", "storage", "fileRules.ts"), "utf8");
  check("multer intake capped at env.maxPdfBytes", middleware.includes("fileSize: env.maxPdfBytes"));
  check("fileRules enforces body.length > maxPdfBytes()", rules.includes("body.length > maxPdfBytes()"));

  const envFile = fs.readFileSync(path.join(root, ".env"), "utf8");
  const match = envFile.match(/^MAX_PDF_BYTES=(\d+)\s*$/m);
  check("production MAX_PDF_BYTES still 367001600 (350 MB)", match?.[1] === "367001600", `got=${match?.[1] ?? "missing"}`);

  console.log(`\nverify:upload-timing ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
