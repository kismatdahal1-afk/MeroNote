import { env } from "../config/env";

/**
 * Server-side PDF acceptance rules (Phase 5: PDFs only).
 *
 * Defense in depth — three independent checks, because the client MIME type
 * alone is never trusted:
 * 1. file extension must be .pdf
 * 2. declared MIME must be application/pdf
 * 3. content must start with the %PDF- magic bytes
 * Plus: non-empty and within MAX_PDF_BYTES.
 */

export const ALLOWED_PDF_MIME = "application/pdf";
const PDF_MAGIC = Buffer.from("%PDF-");

export class FileRejectedError extends Error {
  reason: string;

  constructor(reason: string) {
    super(`PDF rejected: ${reason}`);
    this.name = "FileRejectedError";
    this.reason = reason;
  }
}

export interface ValidatedPdf {
  fileName: string;
  mime: typeof ALLOWED_PDF_MIME;
  sizeBytes: number;
}

export function maxPdfBytes(): number {
  return env.maxPdfBytes > 0 ? env.maxPdfBytes : 100 * 1024 * 1024;
}

export function validatePdfUpload(input: { fileName: string; mime: string; body: Uint8Array }): ValidatedPdf {
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  if (!fileName || !fileName.toLowerCase().endsWith(".pdf")) {
    throw new FileRejectedError("only .pdf files are accepted.");
  }
  if (input.mime !== ALLOWED_PDF_MIME) {
    throw new FileRejectedError("MIME type must be application/pdf.");
  }
  const body = Buffer.from(input.body);
  if (body.length === 0) {
    throw new FileRejectedError("file is empty.");
  }
  if (body.length > maxPdfBytes()) {
    throw new FileRejectedError(`file exceeds the ${maxPdfBytes()} byte limit.`);
  }
  if (!body.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new FileRejectedError("content is not a PDF (missing %PDF- header).");
  }
  return { fileName, mime: ALLOWED_PDF_MIME, sizeBytes: body.length };
}
