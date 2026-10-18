import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

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
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : {
              ca: fs.readFileSync(path.resolve(__dirname, "../certs/supabase-ca.crt")),
            },
      connectionTimeoutMillis: 5_000,
    })
  : undefined;

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

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

app.get("/api/calls", async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }
  const limit = Math.min(Number(request.query.limit ?? 50), 100);
  const offset = Math.max(Number(request.query.offset ?? 0), 0);
  try {
    const [callsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, prospect_name, company, prospect_role, status, last_stage,
                outcome, next_step_type, next_step_channel, next_step_when, next_step_detail,
                do_not_call, started_at, ended_at
         FROM calls
         ORDER BY started_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query("SELECT COUNT(*) FROM calls"),
    ]);
    response.json({
      calls: callsResult.rows,
      limit,
      offset,
      total: Number(countResult.rows[0].count),
    });
  } catch {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "Calls could not be listed. Please retry.");
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

// ============================================================
// GEMINI AI ASSISTANCE ENDPOINTS
// ============================================================

interface AssistRequest {
  type: "suggest" | "objection" | "summary";
  stage?: number;
  objectionText?: string;
}

interface AssistResponse {
  suggestion: string;
  model: string;
  type: "suggest" | "objection" | "summary";
}

function buildSuggestPrompt(call: any, stage: number, drafts: any[], stageResults: any[]): string {
  const stageInfo = stages[stage - 1];
  const currentDraft = drafts[stage - 1] || { outcome: null, words: "", notes: "" };
  const stage5Words = drafts[4]?.words || "";
  
  let context = `You are an AI assistant helping a caller during a live phone call. The caller is using a structured 8-stage framework.\n\n`;
  context += `Call Context:\n`;
  context += `- Prospect: ${call.prospect_name}\n`;
  context += `- Company: ${call.company}\n`;
  if (call.prospect_role) context += `- Role: ${call.prospect_role}\n`;
  context += `\nCurrent Stage: ${stage} - ${stageInfo.title}\n`;
  context += `Stage Purpose: ${stageInfo.guidance}\n`;
  context += `\nWhat the caller has recorded so far:\n`;
  
  for (let i = 0; i < 8; i++) {
    const draft = drafts[i];
    const stageResult = stageResults.find((sr) => sr.stage === i + 1);
    const latestOutcome = stageResult?.outcome_key || draft.outcome;
    const latestWords = stageResult?.prospect_words || draft.words;
    const latestNotes = stageResult?.notes || draft.notes;
    
    if (latestOutcome || latestWords || latestNotes) {
      context += `\nStage ${i + 1} (${stages[i].title}):\n`;
      if (latestOutcome) context += `  Outcome: ${latestOutcome}\n`;
      if (latestWords) context += `  Their words: "${latestWords}"\n`;
      if (latestNotes) context += `  Caller notes: "${latestNotes}"\n`;
    }
  }
  
  if (stage5Words) {
    context += `\nStage 5 (Their Need) exact words: "${stage5Words}"\n`;
  }
  
  context += `\nThe caller's offering: "We prepare a free growth report about the prospect's company."\n`;
  context += `\nRules:\n`;
  context += `- Provide ONE short, practical line the caller can say next (max 40 words).\n`;
  context += `- Match the tone to the current stage.\n`;
  context += `- Do NOT invent facts about the prospect not in the captured text.\n`;
  context += `- Do NOT make claims about the offering beyond "free growth report".\n`;
  context += `- If the prospect declined or said they're not the right person, suggest a brief respectful acknowledgement or polite request for the right contact.\n`;
  context += `- If the prospect asked not to be called, suggest ending politely.\n`;
  context += `- Output ONLY the suggested line, no explanations.\n`;
  
  return context;
}

function buildObjectionPrompt(call: any, objectionText: string, drafts: any[], stageResults: any[]): string {
  const stage6Draft = drafts[5] || { outcome: null, words: "", notes: "" };
  const stage6Result = stageResults.find((sr) => sr.stage === 6);
  const objectionOutcome = stage6Result?.outcome_key || stage6Draft.outcome;
  
  let context = `You are an AI assistant helping a caller handle an objection during a live phone call.\n\n`;
  context += `Call Context:\n`;
  context += `- Prospect: ${call.prospect_name}\n`;
  context += `- Company: ${call.company}\n`;
  if (call.prospect_role) context += `- Role: ${call.prospect_role}\n`;
  context += `\nThe prospect raised this objection/concern: "${objectionText}"\n`;
  if (objectionOutcome) {
    context += `Recorded outcome at Stage 6: ${objectionOutcome}\n`;
  }
  
  context += `\nThe caller's offering: "We prepare a free growth report about the prospect's company."\n`;
  context += `\nRules:\n`;
  context += `- Provide a respectful, professional response to the objection (max 50 words).\n`;
  context += `- Include ONE clarifying question to understand the prospect better.\n`;
  context += `- NEVER recommend pressuring someone who has declined or said no.\n`;
  context += `- If they said "not interested" or "we have a team", acknowledge and ask if there's anything specific they'd like to know.\n`;
  context += `- If they said "not the right person", ask who the right contact might be.\n`;
  context += `- If they asked not to be called again, suggest a polite acknowledgment only.\n`;
  context += `- Do NOT invent facts about the prospect or the offering.\n`;
  context += `- Output format: "Response: [your response]. Question: [your question]"\n`;
  
  return context;
}

function buildSummaryPrompt(call: any, drafts: any[], stageResults: any[]): string {
  let context = `Generate a structured call summary for a sales call record. Use ONLY the information provided below. Do not invent or assume anything.\n\n`;
  context += `Call Metadata:\n`;
  context += `- Prospect: ${call.prospect_name}\n`;
  context += `- Company: ${call.company}\n`;
  if (call.prospect_role) context += `- Role: ${call.prospect_role}\n`;
  context += `- Started: ${call.started_at}\n`;
  if (call.ended_at) context += `- Ended: ${call.ended_at}\n`;
  context += `- Last Stage Reached: ${call.last_stage} (${stages[call.last_stage - 1]?.title})\n`;
  context += `- Final Outcome: ${call.outcome || "Not recorded"}\n`;
  if (call.next_step_type) context += `- Next Step Type: ${call.next_step_type}\n`;
  if (call.next_step_when) context += `- Next Step When: ${call.next_step_when}\n`;
  if (call.next_step_channel) context += `- Next Step Channel: ${call.next_step_channel}\n`;
  if (call.next_step_detail) context += `- Next Step Detail: ${call.next_step_detail}\n`;
  context += `- Do Not Call: ${call.do_not_call ? "Yes" : "No"}\n`;
  
  context += `\nStage-by-Stage Details:\n`;
  
  for (let i = 0; i < 8; i++) {
    const draft = drafts[i];
    const stageResult = stageResults.find((sr) => sr.stage === i + 1);
    const latestOutcome = stageResult?.outcome_key || draft.outcome;
    const latestWords = stageResult?.prospect_words || draft.words;
    const latestNotes = stageResult?.notes || draft.notes;
    
    context += `\nStage ${i + 1} (${stages[i].title}):\n`;
    if (latestOutcome) context += `  Outcome: ${latestOutcome}\n`;
    else context += `  Outcome: Not recorded\n`;
    if (latestWords) context += `  Prospect words: "${latestWords}"\n`;
    else context += `  Prospect words: Not recorded\n`;
    if (latestNotes) context += `  Caller notes: "${latestNotes}"\n`;
    else context += `  Caller notes: Not recorded\n`;
  }
  
  context += `\nFormat the summary as follows:\n`;
  context += `1. PROSPECT STATED NEEDS (exact words from Stage 5, or "Not recorded")\n`;
  context += `2. CALLER INTERPRETATION (summary of caller notes across stages, or "Not recorded")\n`;
  context += `3. OBJECTIONS RAISED (from Stage 6, or "None recorded")\n`;
  context += `4. OUTCOME (final outcome with explanation)\n`;
  context += `5. NEXT STEP (type, when, channel, detail - or "None agreed")\n`;
  context += `6. MISSING INFORMATION (list any stages with no data recorded)\n`;
  context += `\nIf information is missing for any section, explicitly state "Not recorded" rather than inferring.\n`;
  
  return context;
}

const stages = [
  {
    title: "Opening",
    guidance:
      "Reach the right person, introduce yourself, and listen for contact or availability issues.",
  },
  {
    title: "Purpose",
    guidance:
      "Explain why you are calling in one or two clear sentences, then listen for questions or concerns.",
  },
  {
    title: "Permission",
    guidance:
      "Capture a clear yes, no, or callback request; silence and an unanswered question are not permission.",
  },
  {
    title: "Their business",
    guidance:
      "Understand the prospect's company and work before pitching; listen for their own description and corrections.",
  },
  {
    title: "Their need, in their words",
    guidance:
      "Capture the prospect's statement exactly; keep your interpretation and notes in the separate field.",
  },
  {
    title: "Objection",
    guidance:
      "Record the reason for hesitation or refusal and respect the prospect's boundary.",
  },
  {
    title: "Next step",
    guidance:
      "Record one concrete action the prospect agreed to, including a time or channel where relevant.",
  },
  {
    title: "Close",
    guidance:
      "End respectfully and ensure the outcome and next step match what was actually said.",
  },
];

app.post("/api/calls/:id/assist", async (request, response) => {
  if (!pool) {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call service is unavailable.");
    return;
  }
  if (!genAI) {
    sendError(response, 503, "AI_NOT_CONFIGURED", "AI assistance is not available. GEMINI_API_KEY is not configured.");
    return;
  }

  if (!isUuid(request.params.id)) {
    sendError(response, 404, "NOT_FOUND", "Call not found.");
    return;
  }

  const body = (request.body ?? {}) as AssistRequest;
  const { type, stage, objectionText } = body;

  if (!type || !["suggest", "objection", "summary"].includes(type)) {
    sendError(response, 422, "VALIDATION", "Invalid assist type. Must be 'suggest', 'objection', or 'summary'.", [
      { field: "type", message: "Required: suggest, objection, or summary" },
    ]);
    return;
  }

  if (type === "suggest" && (!stage || stage < 1 || stage > 8)) {
    sendError(response, 422, "VALIDATION", "Stage is required for 'suggest' type (1-8).", [
      { field: "stage", message: "Required for suggest type" },
    ]);
    return;
  }

  if (type === "objection" && !objectionText?.trim()) {
    sendError(response, 422, "VALIDATION", "Objection text is required for 'objection' type.", [
      { field: "objectionText", message: "Required for objection type" },
    ]);
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

    const call = callResult.rows[0];
    const stageResults = stageResult.rows;

    // Check DNC block for suggestions
    if (type === "suggest") {
      const dncCheck = await pool.query(
        `SELECT outcome_key FROM stage_results
         WHERE call_id = $1 AND stage = 6
         ORDER BY revision DESC LIMIT 1`,
        [request.params.id],
      );
      const latestDnc = dncCheck.rows[0];
      if (latestDnc?.outcome_key === "asked_not_to_call") {
        response.json({
          suggestion: "They asked not to be called. End the call politely.",
          model: geminiModel,
          type: "suggest",
          blocked: true,
        });
        return;
      }
    }

    // Build drafts from latest stage results
    const drafts = stages.map(() => ({ outcome: null, words: "", notes: "" }));
    for (const sr of stageResults) {
      const idx = sr.stage - 1;
      if (idx >= 0 && idx < 8 && !drafts[idx].outcome) {
        drafts[idx] = {
          outcome: sr.outcome_key,
          words: sr.prospect_words,
          notes: sr.notes,
        };
      }
    }

    let prompt: string;
    switch (type) {
      case "suggest":
        prompt = buildSuggestPrompt(call, stage!, drafts, stageResults);
        break;
      case "objection":
        prompt = buildObjectionPrompt(call, objectionText!, drafts, stageResults);
        break;
      case "summary":
        prompt = buildSummaryPrompt(call, drafts, stageResults);
        break;
    }

    const model = genAI.getGenerativeModel({
      model: geminiModel,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200,
      },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    try {
      const result = await model.generateContent(prompt, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const suggestion = result.response.text().trim();
      if (!suggestion) {
        throw new Error("Empty response from model");
      }

      // Store AI suggestion in database
      const assistStage = type === "suggest" ? stage! : (type === "objection" ? 6 : 8);
      await pool.query(
        `INSERT INTO ai_suggestions (call_id, stage, model, suggestion)
         VALUES ($1, $2, $3, $4)`,
        [request.params.id, assistStage, geminiModel, suggestion],
      );

      response.json({
        suggestion,
        model: geminiModel,
        type,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        sendError(response, 503, "AI_UNAVAILABLE", "AI request timed out. Please try again.");
        return;
      }
      if (error instanceof Error && (error.message.includes("429") || error.message.includes("quota"))) {
        sendError(response, 429, "AI_QUOTA", "AI quota reached for now. Carry on; nothing is lost.");
        return;
      }
      if (error instanceof Error && (error.message.includes("400") || error.message.includes("401") || error.message.includes("403") || error.message.includes("404"))) {
        sendError(response, 502, "AI_CONFIG", "AI assistance is not available. Please check configuration.");
        return;
      }
      sendError(response, 503, "AI_UNAVAILABLE", "AI assistance is currently unavailable. Please try again.");
    }
  } catch {
    sendError(response, 503, "DATABASE_UNAVAILABLE", "The call could not be loaded for AI assistance.");
  }
});

app.listen(port, () => {
  console.log(`Callframe API listening on port ${port}`);
});