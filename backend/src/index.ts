import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

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

const outcomes = new Set([
  "next_step_set",
  "document_requested",
  "callback_requested",
  "referred",
  "declined",
  "wrong_contact",
  "no_contact",
  "do_not_call",
]);

type FieldError = { field: string; message: string };

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
    await client.query("ROLLBACK");
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
  } catch {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call could not be started. Please retry.");
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
    const [callResult, stageResult] = await Promise.all([
      pool.query("SELECT * FROM calls WHERE id = $1", [request.params.id]),
      pool.query(
        `SELECT id, call_id, stage, revision, outcome_key, prospect_words, notes, created_at
         FROM stage_results WHERE call_id = $1 ORDER BY stage, revision DESC`,
        [request.params.id],
      ),
    ]);
    if (!callResult.rowCount) {
      sendError(response, 404, "NOT_FOUND", "Call not found.");
      return;
    }
    response.json({ call: callResult.rows[0], stage_results: stageResult.rows });
  } catch {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call could not be loaded. Please retry.");
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
        if (!callResult.rowCount) throw new Error("CALL_NOT_FOUND");
        if (callResult.rows[0].status !== "in_progress") throw new Error("CALL_CLOSED");

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
    } catch (error) {
      if (error instanceof Error && error.message === "CALL_NOT_FOUND") {
        sendError(response, 404, "NOT_FOUND", "Call not found.");
      } else if (error instanceof Error && error.message === "CALL_CLOSED") {
        sendError(response, 409, "CALL_CLOSED", "This call is already closed.");
      } else {
        sendError(response, 503, "DATABASE_UNAVAILABLE", "The stage could not be saved. Please retry.");
      }
    } finally {
      client.release();
    }
  } catch {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The stage could not be saved. Please retry.");
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
  } catch {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "Progress could not be saved. Please retry.");
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
    typeof body.outcome !== "string" ||
    !outcomes.has(body.outcome) ||
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

  const outcome = body.outcome;
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
  const required: FieldError[] = [];
  if (outcome === "next_step_set" && (!["call", "meeting"].includes(type ?? "") || !when?.trim())) {
    required.push({ field: "next_step.when", message: "A call or meeting time is required." });
  } else if (outcome === "document_requested" && (type !== "document" || !channel?.trim())) {
    required.push({ field: "next_step.channel", message: "A communication channel is required." });
  } else if (outcome === "callback_requested" && (type !== "call" || !when?.trim())) {
    required.push({ field: "next_step.when", message: "A callback time is required." });
  } else if (outcome === "referred" && (type !== "referral" || !detail?.trim())) {
    required.push({ field: "next_step.detail", message: "Who they referred you to is required." });
  } else if (
    outcome === "do_not_call" &&
    [type, channel, when, detail].some((value) => Boolean(value?.trim()))
  ) {
    required.push({ field: "next_step", message: "A do-not-call outcome cannot include a next step." });
  }
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
        "SELECT status FROM calls WHERE id = $1 FOR UPDATE",
        [request.params.id],
      );
      if (!callResult.rowCount) throw new Error("CALL_NOT_FOUND");
      if (callResult.rows[0].status !== "in_progress") throw new Error("CALL_CLOSED");

      let dncWords: string | null = null;
      if (outcome === "do_not_call") {
        const dncResult = await client.query(
          `SELECT outcome_key, prospect_words FROM stage_results
           WHERE call_id = $1 AND stage = 6
           ORDER BY revision DESC LIMIT 1`,
          [request.params.id],
        );
        const latestDnc = dncResult.rows[0];
        if (
          latestDnc?.outcome_key !== "asked_not_to_call" ||
          !latestDnc.prospect_words?.trim()
        ) {
          throw new Error("DNC_WORDS_MISSING");
        }
        dncWords = latestDnc.prospect_words;
      }

      const updated = await client.query(
        `UPDATE calls
         SET status = $2, last_stage = $3, outcome = $4,
             next_step_type = $5, next_step_channel = $6,
             next_step_when = $7, next_step_detail = $8,
             do_not_call = $9, dnc_words = $10, ended_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING id, status, last_stage, outcome, next_step_type,
                   next_step_channel, next_step_when, next_step_detail,
                   do_not_call, dnc_words, ended_at`,
        [
          request.params.id,
          endedStage === 8 ? "completed" : "ended_early",
          endedStage,
          outcome,
          type,
          channel?.trim() || null,
          when?.trim() || null,
          detail?.trim() || null,
          outcome === "do_not_call",
          dncWords,
        ],
      );
      return updated.rows[0];
    });
    response.json({ call: result });
  } catch (error) {
    if (error instanceof Error && error.message === "CALL_NOT_FOUND") {
      sendError(response, 404, "NOT_FOUND", "Call not found.");
    } else if (error instanceof Error && error.message === "CALL_CLOSED") {
      sendError(response, 409, "CALL_CLOSED", "This call is already closed.");
    } else if (error instanceof Error && error.message === "DNC_WORDS_MISSING") {
      sendError(response, 422, "RULE_VIOLATION", "Record the explicit do-not-call request and exact words at Stage 6 first.", [
        { field: "dnc_words", message: "Stage 6 must contain the do-not-call selection and their exact words." },
      ]);
    } else {
      sendError(response, 503, "DATABASE_UNAVAILABLE", "The call could not be closed. Please retry.");
    }
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Callframe API listening on port ${port}`);
});
