import express, { type Express } from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { nutTo3Router } from "./routes/nut-to-3.js";
import { nutToRouter } from "./routes/nut-to.js";
import { headsUpRouter } from "./routes/heads-up.js";
import { authRouter } from "./routes/auth.js";

export function createApp(): Express {
  const app = express();

  // CORS_ORIGIN: 쉼표로 구분된 허용 origin 목록 (미설정 시 전체 허용 — dev 전용)
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : [];
  app.use(
    cors(
      allowedOrigins.length > 0
        ? { origin: allowedOrigins, credentials: true }
        : undefined,
    ),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRouter);
  app.use("/api/nut-to", nutTo3Router);
  app.use("/api/nut-to", nutToRouter);
  app.use("/api/play-lab/heads-up", headsUpRouter);
  app.use("/api/auth", authRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}
