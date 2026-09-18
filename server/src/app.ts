import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import apiRouter from "./routes";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";

export function createApp(): express.Express {
  const app = express();

  // Cookie sessions require credentialed CORS with a fixed origin (never "*").
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
