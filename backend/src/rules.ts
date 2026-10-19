// Pure business rules for Callframe (prd.md sections 3.6 and 6).
// No imports on purpose: no express, no pg, no I/O, so everything here is unit-testable
// (see backend/test/rules.test.ts) and index.ts / ai.ts only wire these into HTTP and SQL.

// ---------------------------------------------------------------- outcomes

export const OUTCOMES = [
  "next_step_set",
  "document_requested",
  "callback_requested",
  "referred",
  "declined",
  "wrong_contact",
  "no_contact",
  "do_not_call",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

export function isOutcome(value: unknown): value is Outcome {
  return typeof value === "string" && (OUTCOMES as readonly string[]).includes(value);
}

// Outcomes that end the conversation without agreeing anything: no next step may be recorded.
export const NO_NEXT_STEP_OUTCOMES: readonly Outcome[] = ["declined", "wrong_contact", "no_contact"];

export type OutcomeClass = "success" | "partial" | "negative" | "restricted";

// Only a call or meeting with a time is a success. A document request, callback or referral
// is always "partial" (prd FR-CLOSE-4).
export function outcomeClass(outcome: Outcome): OutcomeClass {
  switch (outcome) {
    case "next_step_set":
      return "success";
    case "document_requested":
    case "callback_requested":
    case "referred":
      return "partial";
    case "declined":
    case "wrong_contact":
    case "no_contact":
      return "negative";
    case "do_not_call":
      return "restricted";
  }
}

export type FieldError = { field: string; message: string };

export type NextStep = {
  type?: string | null;
  channel?: string | null;
  when?: string | null;
  detail?: string | null;
};

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasAnyNextStep(step: NextStep): boolean {
  return [step.type, step.channel, step.when, step.detail].some(filled);
}

// Returns the field errors for the first rule the outcome breaks (empty array = valid).
export function validateCloseOutcome(outcome: Outcome, step: NextStep): FieldError[] {
  const type = step.type?.trim() ?? "";
  if (outcome === "next_step_set") {
    if (!["call", "meeting"].includes(type) || !filled(step.when)) {
      return [{ field: "next_step.when", message: "A call or meeting time is required." }];
    }
  } else if (outcome === "document_requested") {
    if (type !== "document" || !filled(step.channel)) {
      return [{ field: "next_step.channel", message: "A communication channel is required." }];
    }
  } else if (outcome === "callback_requested") {
    if (type !== "call" || !filled(step.when)) {
      return [{ field: "next_step.when", message: "A callback time is required." }];
    }
  } else if (outcome === "referred") {
    if (type !== "referral" || !filled(step.detail)) {
      return [{ field: "next_step.detail", message: "Who they referred you to is required." }];
    }
  } else if (outcome === "do_not_call") {
    if (hasAnyNextStep(step)) {
      return [{ field: "next_step", message: "A do-not-call outcome cannot include a next step." }];
    }
  } else if (NO_NEXT_STEP_OUTCOMES.includes(outcome) && hasAnyNextStep(step)) {
    return [
      {
        field: "next_step",
        message: "A declined, wrong-contact or no-contact outcome cannot include a next step.",
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------- do-not-call

// The ONLY do-not-call trigger is the stage-6 button with this key. An ordinary refusal
// ("not interested", "no") is never upgraded to do-not-call.
export const DNC_OUTCOME_KEY = "asked_not_to_call";

export function isBlockedByDnc(
  call: { do_not_call: boolean },
  stageRows: ReadonlyArray<{ outcome_key: string | null }>,
): boolean {
  return call.do_not_call === true || stageRows.some((row) => row.outcome_key === DNC_OUTCOME_KEY);
}

// Closing with do_not_call needs the stage-6 button AND the prospect's exact words,
// taken from the latest stage-6 revision.
export function validateDoNotCallEvidence(
  latestStage6: { outcome_key: string | null; prospect_words: string | null } | undefined,
): FieldError[] {
  if (latestStage6?.outcome_key !== DNC_OUTCOME_KEY || !filled(latestStage6.prospect_words)) {
    return [
      {
        field: "dnc_words",
        message: "Stage 6 must contain the do-not-call selection and their exact words.",
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------- status

export const FINAL_STAGE = 8;

// A call keeps the highest stage it reached, even if it is closed from an earlier stage.
export function reachedStage(lastStage: number, endedStage: number): number {
  return Math.max(lastStage, endedStage);
}

export type CallStatus = "in_progress" | "completed" | "ended_early";
export type DisplayStatus = CallStatus | "abandoned";

// "completed" only when stage 8 was reached; anything else that was closed is "ended_early".
export function statusFromStage(reached: number): "completed" | "ended_early" {
  return reached >= FINAL_STAGE ? "completed" : "ended_early";
}

export const ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000;

// Abandoned is a display state only (the row is never rewritten): an in_progress call with
// no activity for MORE than two hours.
export function displayStatus(
  status: CallStatus,
  updatedAt: Date | string | number,
  now: Date | number = Date.now(),
): DisplayStatus {
  if (status !== "in_progress") return status;
  const idleMs = Number(now instanceof Date ? now.getTime() : now) - new Date(updatedAt).getTime();
  return idleMs > ABANDONED_AFTER_MS ? "abandoned" : status;
}

// ---------------------------------------------------------------- revisions

// Latest revision per stage (rows may arrive in any order).
export function latestByStage<T extends { stage: number; revision: number }>(
  rows: readonly T[],
): Map<number, T> {
  const latest = new Map<number, T>();
  for (const row of rows) {
    const current = latest.get(row.stage);
    if (!current || Number(row.revision) > Number(current.revision)) latest.set(row.stage, row);
  }
  return latest;
}

// Same selection as a list ordered by stage (what the API returns as latest_by_stage).
export function latestRevisions<T extends { stage: number; revision: number }>(
  rows: readonly T[],
): T[] {
  return [...latestByStage(rows).values()].sort((a, b) => a.stage - b.stage);
}
