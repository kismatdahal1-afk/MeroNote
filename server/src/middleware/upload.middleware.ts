import multer, { MulterError } from "multer";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * Phase 11 PDF upload intake. Memory storage only (no temp files on disk);
 * size capped at MAX_PDF_BYTES as the first gate. The filename/MIME filter
 * below is intentionally shallow — real validation always runs on actual
 * bytes via Phase 5 fileRules before anything is stored.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: env.maxPdfBytes },
  fileFilter: (_req, file, cb) => {
    const nameOk = file.originalname.toLowerCase().endsWith(".pdf");
    const mimeOk = file.mimetype === "application/pdf";
    cb(null, nameOk && mimeOk);
  },
});

/** Multer errors become safe 400s; anything else propagates. */
export function uploadSinglePdf(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `File exceeds the ${env.maxPdfBytes} byte limit.`
          : err.code === "LIMIT_UNEXPECTED_FILE"
            ? "Expected a single file field named 'file'."
            : "Invalid file upload.";
      res.status(400).json({ status: "error", message });
      return;
    }
    next(err);
  });
}
