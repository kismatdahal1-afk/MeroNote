import { NextFunction, Request, Response } from "express";

export function notFoundHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404);
  next(new Error("Not found."));
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = res.statusCode !== 200 ? res.statusCode : 500;
  // Unexpected 5xx failures never leak internals outside development —
  // controllers already map every known failure to a safe DTO.
  const message =
    status >= 500 && process.env.NODE_ENV !== "development"
      ? "Internal server error."
      : err.message || "Internal server error";

  res.status(status).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
