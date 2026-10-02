import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import apiRouter from "./routes";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";

export function createApp(): express.Express {
  const app = express();

  // Render terminates TLS at its router (single proxy hop) and forwards
  // client IPs via X-Forwarded-For. Trust exactly one hop so `req.ip` (used
  // by express-rate-limit's default key generator) reflects the real client.
  // Never `true`: that would let any client spoof its IP and bypass limits.
  app.set("trust proxy", 1);

  // Fingerprint + baseline hardening for a JSON API (no CSP: no HTML served).
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));

  // Cookie sessions require credentialed CORS with a fixed origin (never "*").
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Temporary request timing middleware — remove after debugging
  app.use((req, res, next) => {
    const _t0 = Date.now();
    res.on("finish", () => {
      console.log(`[TIMING] ${req.method} ${req.originalUrl} → ${res.statusCode} in ${Date.now() - _t0}ms`);
    });
    next();
  });

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
