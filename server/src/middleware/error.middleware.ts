import { NextFunction, Request, Response } from "express";

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404);
  next(new Error(`Not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = res.statusCode !== 200 ? res.statusCode : 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
