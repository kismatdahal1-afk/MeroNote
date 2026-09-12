import { Request, Response } from "express";

export function getHealth(_req: Request, res: Response): void {
  res.json({
    status: "ok",
    message: "Mero Note API is running",
    timestamp: new Date().toISOString(),
  });
}
