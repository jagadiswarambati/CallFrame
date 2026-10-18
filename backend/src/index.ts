import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Pool } from "pg";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const origins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "false" ? false : {},
      connectionTimeoutMillis: 5_000,
    })
  : undefined;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"));
    },
  }),
);
app.use(express.json({ limit: "50kb" }));

app.get("/health", async (_request, response) => {
  if (!pool) {
    response.status(503).json({
      status: "degraded",
      service: "callframe-api",
      db: "down",
    });
    return;
  }

  try {
    await pool.query("SELECT 1");
    response.json({
      status: "ok",
      service: "callframe-api",
      db: "up",
      time: new Date().toISOString(),
    });
  } catch {
    response.status(503).json({
      status: "degraded",
      service: "callframe-api",
      db: "down",
    });
  }
});

app.listen(port, () => {
  console.log(`Callframe API listening on port ${port}`);
});
