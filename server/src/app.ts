import express from "express";
import cors from "cors";
import apiRouter from "./routes";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: env.clientUrl }));
  app.use(express.json());

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
