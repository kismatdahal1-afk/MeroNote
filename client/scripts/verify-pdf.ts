import { getDocument } from "pdfjs-dist";
import { describePdfError } from "../src/lib/pdfErrors.ts";

/**
 * Phase 6 PDF.js verification: `npm run verify:pdf` (plain `node`, no new deps).
 * Builds a synthetic multi-page PDF in code and asserts the real loading
 * contract PdfCanvas depends on: page count authority, page access,
 * invalid-PDF rejection, destroy() cleanup, and friendly error mapping.
 * Canvas rendering itself needs a browser and is covered by build + review.
 * Exit 0 = all checks pass.
 */

let passes = 0;
let failures = 0;

function check(name: string, pass: boolean, detail = ""): void {
  if (pass) passes += 1;
  else failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Minimal valid PDF with N text pages (all ASCII, computed xref offsets). */
function buildPdf(pageCount: number): Uint8Array {
  const objs: Array<{ num: number; body: string }> = [];
  const kids: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    const pageNum = 3 + i * 2;
    const contentNum = 4 + i * 2;
    kids.push(`${pageNum} 0 R`);
    const fontNum = 3 + pageCount * 2;
    objs.push({
      num: pageNum,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R /Resources << /Font << /F1 ${fontNum} 0 R >> >> >>`,
    });
    const text = `BT /F1 24 Tf 72 720 Td (Page ${i + 1}) Tj ET`;
    objs.push({ num: contentNum, body: `<< /Length ${text.length} >>\nstream\n${text}\nendstream` });
  }
  const fontNum = 3 + pageCount * 2;
  objs.push({ num: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" });
  objs.push({ num: 2, body: `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>` });
  objs.push({ num: fontNum, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" });
  objs.sort((a, b) => a.num - b.num);

  let out = "%PDF-1.7\n";
  const offsets = new Map<number, number>();
  for (const o of objs) {
    offsets.set(o.num, out.length);
    out += `${o.num} 0 obj\n${o.body}\nendobj\n`;
  }
  const xrefPos = out.length;
  const size = fontNum + 1;
  out += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let n = 1; n < size; n++) {
    out += `${String(offsets.get(n) ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new TextEncoder().encode(out);
}

async function main(): Promise<void> {
  // 1. Valid multi-page PDF loads; PDF.js count is authoritative.
  const data = buildPdf(3);
  const doc = await getDocument({ data }).promise;
  check("synthetic PDF loads with 3 pages", doc.numPages === 3, `numPages=${doc.numPages}`);

  // 2. Page access + viewport math (what canvas rendering consumes).
  const page2 = await doc.getPage(2);
  const viewport = page2.getViewport({ scale: 1 });
  check("page viewport correct", Math.round(viewport.width) === 612 && Math.round(viewport.height) === 792);

  // 3. Cleanup resolves.
  await doc.destroy();
  check("document destroy() resolves", true);

  // 4. Invalid bytes rejected with a typed PDF.js error.
  let invalidName = "";
  try {
    await getDocument({ data: new TextEncoder().encode("this is not a pdf at all") }).promise;
  } catch (err) {
    invalidName = err instanceof Error ? err.name : String(err);
  }
  check("invalid PDF rejected", invalidName.length > 0, invalidName);
  // Real PDF.js errors are Error instances with .name set — mirror that.
  const named = (name: string): Error => Object.assign(new Error(name), { name });
  check("invalid PDF maps to friendly message", describePdfError(named("InvalidPDFException")).includes("couldn't be opened as a PDF"));

  // 5. Error-message vectors (same mapper PdfCanvas uses).
  check("password error mapped", describePdfError(named("PasswordException")).includes("password-protected"));
  check("missing error mapped", describePdfError(named("MissingPDFException")).includes("could not be found"));
  check("network error mapped", describePdfError(new Error("fetch failed")).includes("connection"));
  check("unknown error mapped generic", describePdfError(new Error("weird xyz")).includes("Something went wrong"));
  const mapped = describePdfError(new Error("weird xyz"));
  check("mapped messages leak no internals", !/B2_|secret|mongodb|stack/i.test(mapped));

  console.log(`\nverify:pdf ${failures === 0 ? "ALL PASS" : failures + " FAILURES"} (${passes + failures} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
