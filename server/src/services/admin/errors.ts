import type { Response } from "express";

/**
 * Phase 11 admin error contract. Controllers translate these (and duplicate
 * keys) into safe envelopes; anything else propagates to error.middleware.
 */
export class AdminError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminError";
    this.status = status;
  }
}

/** Map AdminError / duplicate keys / Mongoose validation to responses. Returns true if handled. */
export function sendAdminError(res: Response, err: unknown, duplicateMessage?: string): boolean {
  if (err instanceof AdminError) {
    res.status(err.status).json({ status: "error", message: err.message });
    return true;
  }
  if ((err as { code?: number })?.code === 11000) {
    res.status(409).json({ status: "error", message: duplicateMessage ?? "Duplicate value: a record with these unique fields already exists." });
    return true;
  }
  if ((err as { name?: string })?.name === "ValidationError") {
    res.status(400).json({ status: "error", message: (err as Error).message || "Validation failed." });
    return true;
  }
  return false;
}
