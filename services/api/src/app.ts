import express, { type Express } from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { nutTo3Router } from "./routes/nut-to-3.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRouter);
  app.use("/api/nut-to-3", nutTo3Router);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}
