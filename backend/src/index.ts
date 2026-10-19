import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseError, Pool, type PoolClient } from "pg";
import {
  createRateLimiter,
  normalizeApiKey,
  normalizeModel,
  runAssist,
  type CallRow,
  type StageRow,
} from "./ai";
import {
  displayStatus,
  isOutcome,
  latestRevisions,
  reachedStage,
  statusFromStage,
  validateCloseOutcome,
  validateDoNotCallEvidence,
  type CallStatus,
  type FieldError,
  type Outcome,
} from "./rules";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
// Render puts one proxy in front of the service; trust it so request.ip is the real client
// (the AI rate limit is per IP). Do not raise this number unless more proxies are added.
app.set("trust proxy", 1);
const port = Number(process.env.PORT ?? 4000);
const origins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : {
              ca: fs.readFileSync(path.resolve(__dirname, "../certs/supabase-ca.crt")),
            },
      connectionTimeoutMillis: 5_000,
    })
  : undefined;

// Idle or dropped connections emit "error" events; without listeners Node would crash.
pool?.on("error", (error) => console.error("Idle database client error", describeError(error)));
pool?.on("connect", (client) => {
  client.on("error", (error) => console.error("Database client error", describeError(error)));
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", describeError(reason));
});

// If set, every /api route requires the x-access-code header. Unset or blank = open API.
const accessCode = process.env.APP_ACCESS_CODE?.trim() || undefined;

// Outcome, status, do-not-call and revision rules live in ./rules (pure and unit-tested).

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
  details: FieldError[] = [],
) {
  response.status(status).json({
    error: { code, message, ...(details.length ? { details } : {}) },
  });
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Log only the error type and code, never the message (it can contain hosts or user data).
function describeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, code: (error as { code?: unknown }).code };
  }
  return { type: typeof error };
}

// True when the database cannot serve us (unreachable, auth failure, overloaded, restarting).
// Query-level failures (constraint violations, bad input) and our own bugs are NOT "unavailable".
function isDatabaseUnavailable(error: unknown) {
  if (error instanceof DatabaseError) {
    const code = error.code ?? "";
    return code.startsWith("08") || code.startsWith("28") || code.startsWith("53") || code.startsWith("57P");
  }
  return !(
    error instanceof TypeError ||
    error instanceof RangeError ||
    error instanceof ReferenceError
  );
}

// One place that turns any thrown error into a JSON response. Mapping is by error type/status.
function handleError(response: Response, error: unknown, unavailableMessage: string) {
  if (response.headersSent) return;
  if (error instanceof ApiError) {
    sendError(response, error.status, error.code, error.message, error.details);
    return;
  }
  if (isDatabaseUnavailable(error)) {
    console.error("Database unavailable", describeError(error));
    sendError(response, 503, "DATABASE_UNAVAILABLE", unavailableMessage);
    return;
  }
  console.error("Unexpected error", describeError(error));
  sendError(response, 500, "INTERNAL_ERROR", "Something went wrong. Please retry.");
}

function requireAccessCode(request: Request, response: Response, next: NextFunction) {
  if (!accessCode) {
    next();
    return;
  }
  const provided = request.get("x-access-code");
  if (provided !== undefined) {
    const given = Buffer.from(provided);
    const expected = Buffer.from(accessCode);
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) {
      next();
      return;
    }
  }
  sendError(response, 401, "UNAUTHORIZED", "A valid access code is required.");
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length <= 4000;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function validateTextFields(
  body: Record<string, unknown>,
  fields: string[],
): FieldError[] {
  return fields.flatMap((field) =>
    body[field] === undefined || isText(body[field])
      ? []
      : [{ field, message: "Must be text with at most 4,000 characters." }],
  );
}

async function transaction<T>(
  client: PoolClient,
  action: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    const result = await action();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    // If the connection is already dead, ROLLBACK fails too; keep the original error.
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new ApiError(403, "FORBIDDEN", "Origin not allowed."));
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

// /health above stays open; everything under /api needs the access code when one is configured.
app.use("/api", requireAccessCode);

app.get("/api/calls", async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }
  const limitParam = Number(request.query.limit ?? 50);
  const offsetParam = Number(request.query.offset ?? 0);
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;
  const offset = Number.isInteger(offsetParam) ? Math.max(offsetParam, 0) : 0;
  try {
    const [callsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, prospect_name, company, prospect_role, status, last_stage,
                outcome, next_step_type, next_step_channel, next_step_when, next_step_detail,
                do_not_call, started_at, ended_at, updated_at
         FROM calls
         ORDER BY started_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query("SELECT COUNT(*) FROM calls"),
    ]);
    const now = Date.now();
    response.json({
      calls: callsResult.rows.map((row) => ({
        ...row,
        display_status: displayStatus(row.status as CallStatus, row.updated_at, now),
      })),
      limit,
      offset,
      total: Number(countResult.rows[0].count),
    });
  } catch (error) {
    handleError(response, error, "Calls could not be listed. Please retry.");
  }
});

app.post("/api/calls", async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }

  const body = (request.body ?? {}) as Record<string, unknown>;
  const prospectName =
    typeof body.prospect_name === "string" ? body.prospect_name : "";
  const prospectCompany = typeof body.company === "string" ? body.company : "";
  const details = validateTextFields(body, [
    "prospect_name",
    "company",
    "prospect_role",
  ]);
  if (!prospectName.trim()) {
    details.push({ field: "prospect_name", message: "Required." });
  }
  if (!prospectCompany.trim()) {
    details.push({ field: "company", message: "Required." });
  }
  if (details.length) {
    sendError(response, 422, "VALIDATION", "Check the call details.", details);
    return;
  }

  try {
    const client = await pool.connect();
    try {
      const restricted = await client.query<{ id: string }>(
        `SELECT id FROM calls
         WHERE do_not_call = true
           AND status <> 'in_progress'
           AND lower(btrim(prospect_name)) = lower(btrim($1))
           AND lower(btrim(company)) = lower(btrim($2))
         ORDER BY ended_at DESC
         LIMIT 1`,
        [prospectName, prospectCompany],
      );
      if (restricted.rowCount) {
        sendError(response, 409, "DNC_RESTRICTED", "This prospect has requested no further calls.", [
          { field: "call_id", message: restricted.rows[0].id },
        ]);
        return;
      }

      const result = await client.query(
        `INSERT INTO calls (prospect_name, company, prospect_role)
         VALUES ($1, $2, $3)
         RETURNING id, prospect_name, company, prospect_role, status,
                   last_stage, started_at, do_not_call`,
        [
          prospectName.trim(),
          prospectCompany.trim(),
          typeof body.prospect_role === "string" && body.prospect_role.trim()
            ? body.prospect_role.trim()
            : null,
        ],
      );
      response.status(201).json({ call: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(response, error, "The call could not be started. Please retry.");
  }
});

app.get("/api/calls/:id", async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }
  if (!isUuid(request.params.id)) {
    sendError(response, 404, "NOT_FOUND", "Call not found.");
    return;
  }

  try {
    const [callResult, stageResult, suggestionResult] = await Promise.all([
      pool.query("SELECT * FROM calls WHERE id = $1", [request.params.id]),
      pool.query(
        `SELECT id, call_id, stage, revision, outcome_key, prospect_words, notes, created_at
         FROM stage_results WHERE call_id = $1 ORDER BY stage, revision DESC`,
        [request.params.id],
      ),
      pool.query(
        `SELECT id, call_id, stage, model, suggestion, created_at
         FROM ai_suggestions WHERE call_id = $1 ORDER BY created_at, id`,
        [request.params.id],
      ),
    ]);
    if (!callResult.rowCount) {
      sendError(response, 404, "NOT_FOUND", "Call not found.");
      return;
    }
    const latestByStage = latestRevisions(stageResult.rows);
    response.json({
      call: callResult.rows[0],
      stage_results: stageResult.rows,
      latest_by_stage: latestByStage,
      ai_suggestions: suggestionResult.rows,
    });
  } catch (error) {
    handleError(response, error, "The call could not be loaded. Please retry.");
  }
});

app.put("/api/calls/:id/stages/:stage", async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }
  const stage = Number(request.params.stage);
  if (!isUuid(request.params.id) || !Number.isInteger(stage) || stage < 1 || stage > 8) {
    sendError(response, 422, "VALIDATION", "Use a valid call id and stage.");
    return;
  }

  const body = (request.body ?? {}) as Record<string, unknown>;
  const details = validateTextFields(body, ["prospect_words", "notes"]);
  if (
    body.outcome_key !== undefined &&
    body.outcome_key !== null &&
    (typeof body.outcome_key !== "string" ||
      !/^[a-z0-9_]{1,40}$/.test(body.outcome_key))
  ) {
    details.push({ field: "outcome_key", message: "Choose a valid stage outcome." });
  }
  if (details.length) {
    sendError(response, 422, "VALIDATION", "Check the stage details.", details);
    return;
  }

  const outcomeKey =
    typeof body.outcome_key === "string" ? body.outcome_key : null;
  const words = typeof body.prospect_words === "string" ? body.prospect_words : "";
  const notes = typeof body.notes === "string" ? body.notes : "";

  try {
    const client = await pool.connect();
    try {
      const result = await transaction(client, async () => {
        const callResult = await client.query(
          "SELECT status FROM calls WHERE id = $1 FOR UPDATE",
          [request.params.id],
        );
        if (!callResult.rowCount) throw new ApiError(404, "NOT_FOUND", "Call not found.");
        if (callResult.rows[0].status !== "in_progress") {
          throw new ApiError(409, "CALL_CLOSED", "This call is already closed.");
        }

        const latestResult = await client.query(
          `SELECT * FROM stage_results
           WHERE call_id = $1 AND stage = $2
           ORDER BY revision DESC LIMIT 1`,
          [request.params.id, stage],
        );
        const latest = latestResult.rows[0];
        if (
          latest &&
          latest.outcome_key === outcomeKey &&
          latest.prospect_words === words &&
          latest.notes === notes
        ) {
          return latest;
        }
        const revision = latest ? Number(latest.revision) + 1 : 1;
        const saved = await client.query(
          `INSERT INTO stage_results
             (call_id, stage, revision, outcome_key, prospect_words, notes)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, call_id, stage, revision, outcome_key,
                     prospect_words, notes, created_at`,
          [request.params.id, stage, revision, outcomeKey, words, notes],
        );
        await client.query(
          `UPDATE calls SET last_stage = GREATEST(last_stage, $2), updated_at = now()
           WHERE id = $1`,
          [request.params.id, stage],
        );
        return saved.rows[0];
      });
      response.json({ result });
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(response, error, "The stage could not be saved. Please retry.");
  }
});

app.patch("/api/calls/:id/progress", async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }
  const body = (request.body ?? {}) as Record<string, unknown>;
  const stage = Number(body.stage);
  if (!isUuid(request.params.id) || !Number.isInteger(stage) || stage < 1 || stage > 8) {
    sendError(response, 422, "VALIDATION", "Use a valid call id and stage.");
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE calls SET last_stage = GREATEST(last_stage, $2), updated_at = now()
       WHERE id = $1 AND status = 'in_progress'
       RETURNING id, status, last_stage, started_at, do_not_call`,
      [request.params.id, stage],
    );
    if (!result.rowCount) {
      const exists = await pool.query("SELECT status FROM calls WHERE id = $1", [
        request.params.id,
      ]);
      sendError(
        response,
        exists.rowCount ? 409 : 404,
        exists.rowCount ? "CALL_CLOSED" : "NOT_FOUND",
        exists.rowCount ? "This call is already closed." : "Call not found.",
      );
      return;
    }
    response.json({ call: result.rows[0] });
  } catch (error) {
    handleError(response, error, "Progress could not be saved. Please retry.");
  }
});

app.post("/api/calls/:id/close", async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }
  const body = (request.body ?? {}) as Record<string, unknown>;
  const endedStage = Number(body.ended_stage);
  const nextStep =
    body.next_step && typeof body.next_step === "object"
      ? (body.next_step as Record<string, unknown>)
      : {};
  const textFields = validateTextFields(nextStep, ["type", "channel", "when", "detail"]);
  if (
    !isOutcome(body.outcome) ||
    !Number.isInteger(endedStage) ||
    endedStage < 1 ||
    endedStage > 8
  ) {
    sendError(response, 422, "VALIDATION", "Choose a valid outcome and ended stage.");
    return;
  }
  if (!isUuid(request.params.id)) {
    sendError(response, 404, "NOT_FOUND", "Call not found.");
    return;
  }

  const outcome = body.outcome as Outcome;
  const type =
    typeof nextStep.type === "string" && nextStep.type.trim()
      ? nextStep.type.trim()
      : null;
  const channel = typeof nextStep.channel === "string" ? nextStep.channel : null;
  const when = typeof nextStep.when === "string" ? nextStep.when : null;
  const detail = typeof nextStep.detail === "string" ? nextStep.detail : null;
  if (textFields.length) {
    sendError(response, 422, "VALIDATION", "Check the next-step details.", textFields);
    return;
  }
  const required = validateCloseOutcome(outcome, { type, channel, when, detail });
  if (required.length) {
    sendError(response, 422, "RULE_VIOLATION", "The selected outcome needs more information.", required);
    return;
  }

  const client = await pool.connect().catch(() => undefined);
  if (!client) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call could not be closed. Please retry.");
    return;
  }
  try {
    const result = await transaction(client, async () => {
      const callResult = await client.query(
        "SELECT status, last_stage FROM calls WHERE id = $1 FOR UPDATE",
        [request.params.id],
      );
      if (!callResult.rowCount) throw new ApiError(404, "NOT_FOUND", "Call not found.");
      if (callResult.rows[0].status !== "in_progress") {
        throw new ApiError(409, "CALL_CLOSED", "This call is already closed.");
      }
      // The call keeps the highest stage it reached; status follows from that stage (rules.ts).
      const reached = reachedStage(Number(callResult.rows[0].last_stage), endedStage);
      const finalStatus = statusFromStage(reached);

      let dncWords: string | null = null;
      if (outcome === "do_not_call") {
        const dncResult = await client.query(
          `SELECT outcome_key, prospect_words FROM stage_results
           WHERE call_id = $1 AND stage = 6
           ORDER BY revision DESC LIMIT 1`,
          [request.params.id],
        );
        const latestDnc = dncResult.rows[0];
        const dncErrors = validateDoNotCallEvidence(latestDnc);
        if (dncErrors.length) {
          throw new ApiError(
            422,
            "RULE_VIOLATION",
            "Record the explicit do-not-call request and exact words at Stage 6 first.",
            dncErrors,
          );
        }
        dncWords = latestDnc.prospect_words;
      }

      const updated = await client.query(
        `UPDATE calls
         SET last_stage = $2::smallint,
             status = $10,
             outcome = $3,
             next_step_type = $4, next_step_channel = $5,
             next_step_when = $6, next_step_detail = $7,
             do_not_call = $8, dnc_words = $9, ended_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING id, status, last_stage, outcome, next_step_type,
                   next_step_channel, next_step_when, next_step_detail,
                   do_not_call, dnc_words, ended_at`,
        [
          request.params.id,
          reached,
          outcome,
          type,
          channel?.trim() || null,
          when?.trim() || null,
          detail?.trim() || null,
          outcome === "do_not_call",
          dncWords,
          finalStatus,
        ],
      );
      return updated.rows[0];
    });
    response.json({ call: result });
  } catch (error) {
    handleError(response, error, "The call could not be closed. Please retry.");
  } finally {
    client.release();
  }
});

// ============================================================
// AI: "Suggest what to say" (the only AI feature). Logic lives in ./ai.ts
// ============================================================

const allowAssist = createRateLimiter();

function limitAssist(request: Request, response: Response, next: NextFunction) {
  if (allowAssist(request.ip ?? "unknown")) {
    next();
    return;
  }
  sendError(response, 429, "RATE_LIMITED", "Too many AI requests. Wait a minute and try again.");
}

app.post("/api/calls/:id/assist", limitAssist, async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }
  if (!isUuid(request.params.id)) {
    sendError(response, 404, "NOT_FOUND", "Call not found.");
    return;
  }

  const stage = (request.body as { stage?: unknown } | undefined)?.stage;
  if (typeof stage !== "number" || !Number.isInteger(stage) || stage < 1 || stage > 8) {
    sendError(response, 422, "VALIDATION", "Stage must be a whole number from 1 to 8.", [
      { field: "stage", message: "Must be a whole number from 1 to 8." },
    ]);
    return;
  }

  try {
    // Context always comes from the database, never from the request body.
    const result = await runAssist(
      {
        loadCall: async (id) =>
          (
            await pool.query<CallRow>(
              "SELECT id, prospect_name, company, prospect_role, do_not_call FROM calls WHERE id = $1",
              [id],
            )
          ).rows[0],
        loadStageRows: async (id) =>
          (
            await pool.query<StageRow>(
              `SELECT stage, revision, outcome_key, prospect_words, notes
               FROM stage_results WHERE call_id = $1 ORDER BY stage, revision DESC`,
              [id],
            )
          ).rows,
        saveSuggestion: async ({ callId, stage: savedStage, model, text }) =>
          (
            await pool.query<{ id: string }>(
              `INSERT INTO ai_suggestions (call_id, stage, model, suggestion)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [callId, savedStage, model, text],
            )
          ).rows[0],
        model: normalizeModel(process.env.GEMINI_MODEL),
        apiKey: normalizeApiKey(process.env.GEMINI_API_KEY),
      },
      request.params.id,
      stage,
    );
    if (result.status >= 400) {
      const code = (result.body as { error?: { code?: string } }).error?.code;
      if (code?.startsWith("AI_")) console.error("AI request failed", { code });
    }
    response.status(result.status).json(result.body);
  } catch (error) {
    handleError(response, error, "AI assistance could not be completed. Please retry.");
  }
});

app.use((_request, response) => {
  sendError(response, 404, "NOT_FOUND", "Not found.");
});

// Final safety net: body-parser errors carry their own 4xx status; anything else becomes a 500.
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (response.headersSent) return;
  if (error instanceof ApiError) {
    sendError(response, error.status, error.code, error.message, error.details);
    return;
  }
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 413) {
    sendError(response, 413, "PAYLOAD_TOO_LARGE", "The request is too large.");
    return;
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    sendError(response, status, "BAD_REQUEST", "The request could not be read.");
    return;
  }
  console.error("Unhandled request error", describeError(error));
  sendError(response, 500, "INTERNAL_ERROR", "Something went wrong. Please retry.");
});

app.listen(port, () => {
  console.log(`Callframe API listening on port ${port}`);
});
