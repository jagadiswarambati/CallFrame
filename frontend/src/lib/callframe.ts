// Types, labels and small helpers shared by the history screens.
// The titles and button labels mirror frontend/src/app/workspace/page.tsx (which is not refactored yet);
// if a button label changes there, change it here too.

export const STAGE_COUNT = 8;
export const STAGE_TITLES = [
  "Opening",
  "Purpose",
  "Permission",
  "Their business",
  "Their need",
  "Objection",
  "Next step",
  "Close",
] as const;
export const NEED_STAGE = 5;
// The server shows an in_progress call as "Abandoned" after two hours without activity (prd.md 3.8).
export const ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000;

const STAGE_BUTTON_LABELS: Record<string, string>[] = [
  {
    reached_prospect: "Reached the right person",
    via_assistant: "Assistant or switchboard",
    not_available: "Not available now",
    wrong_or_left: "Wrong number or left the company",
    line_or_language: "Bad line or language barrier",
  },
  {
    purpose_heard: "Heard the purpose",
    asked_what_we_do: "Asked what we do",
    asked_number_source: "Asked where we got the number",
    called_it_sales: "Said it sounds like a sales call",
  },
  {
    yes_now: "Agreed to talk now",
    asked_callback: "Asked for a callback",
    send_first: "Wants it sent first",
    no_clear_answer: "Did not answer clearly",
    declined_to_talk: "Declined to talk",
  },
  {
    shared_business: "Described their business",
    one_line_waiting: "One line, then waited",
    corrected_us: "Corrected what we assumed",
    asked_us_first: "Asked about us first",
  },
  {
    named_goal: "Named a goal or problem",
    says_fine: "Says all is fine",
    asked_what_we_offer: "Asked what we can do for them",
    unclear: "Unclear or no answer",
  },
  {
    has_provider: "Already has a team or consultant",
    not_right_person: "Not the right person",
    not_relevant: "Not relevant or no need",
    wants_writing: "Wants it in writing",
    declined: "Said no",
    asked_not_to_call: "Asked not to be called again",
  },
  {
    doc_agreed: "Agreed to receive a document",
    time_named: "Named a time to talk",
    meeting_agreed: "Agreed to a meeting",
    referred: "Referred us to someone",
    nothing_agreed: "Nothing agreed",
  },
  {
    closed_with_agreement: "Closed with something agreed",
    closed_after_no: "Closed after a no",
    line_dropped: "Line dropped or they hung up",
  },
];

export const OUTCOME_LABELS: Record<string, { label: string; tone: "success" | "partial" | "negative" | "restricted" }> = {
  next_step_set: { label: "Call or meeting agreed", tone: "success" },
  document_requested: { label: "Document requested", tone: "partial" },
  callback_requested: { label: "Callback requested", tone: "partial" },
  referred: { label: "Referred to someone", tone: "partial" },
  declined: { label: "Declined", tone: "negative" },
  wrong_contact: { label: "Wrong contact or person left", tone: "negative" },
  no_contact: { label: "No proper contact", tone: "negative" },
  do_not_call: { label: "Do not call again", tone: "restricted" },
};

export type CallStatus = "in_progress" | "completed" | "ended_early";
export type DisplayStatus = CallStatus | "abandoned";

export type CallSummary = {
  id: string;
  prospect_name: string;
  company: string;
  prospect_role: string | null;
  status: CallStatus;
  display_status?: DisplayStatus;
  last_stage: number;
  outcome: string | null;
  next_step_type: string | null;
  next_step_channel: string | null;
  next_step_when: string | null;
  next_step_detail: string | null;
  do_not_call: boolean;
  dnc_words?: string | null;
  started_at: string;
  ended_at: string | null;
  updated_at?: string;
};

export type StageResultRow = {
  id: string;
  call_id: string;
  stage: number;
  revision: number;
  outcome_key: string | null;
  prospect_words: string;
  notes: string;
  created_at: string;
};

export type AiSuggestionRow = {
  id: string;
  call_id: string;
  stage: number;
  model: string;
  suggestion: string;
  created_at: string;
};

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  completed: "Completed",
  ended_early: "Ended early",
  abandoned: "Abandoned",
  in_progress: "In progress",
};

export function stageTitle(stage: number) {
  return STAGE_TITLES[stage - 1] ?? `Stage ${stage}`;
}

export function lastStageText(lastStage: number) {
  return `${lastStage} of ${STAGE_COUNT} \u00b7 ${stageTitle(lastStage)}`;
}

function humanize(key: string) {
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buttonLabel(stage: number, key: string | null) {
  if (!key) return null;
  return STAGE_BUTTON_LABELS[stage - 1]?.[key] ?? humanize(key);
}

export function outcomeInfo(outcome: string | null) {
  if (!outcome) return null;
  return OUTCOME_LABELS[outcome] ?? { label: humanize(outcome), tone: "partial" as const };
}

// The list endpoint sends display_status; the detail endpoint does not, so derive it the same way.
export function displayStatus(call: Pick<CallSummary, "status" | "display_status" | "updated_at">, now = Date.now()): DisplayStatus {
  if (call.display_status) return call.display_status;
  if (call.status === "in_progress" && call.updated_at) {
    const updated = Date.parse(call.updated_at);
    if (Number.isFinite(updated) && now - updated > ABANDONED_AFTER_MS) return "abandoned";
  }
  return call.status;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export type NextStepFields = Pick<
  CallSummary,
  "next_step_type" | "next_step_channel" | "next_step_when" | "next_step_detail"
>;

// One line for lists, e.g. "Call · tomorrow 3pm" or "Document via WhatsApp · Friday". Null when nothing was agreed.
export function nextStepSummary(call: NextStepFields): string | null {
  const type = call.next_step_type;
  if (!type) return null;
  const channel = call.next_step_channel?.trim();
  const when = call.next_step_when?.trim();
  const detail = call.next_step_detail?.trim();
  const head =
    type === "call" ? "Call"
    : type === "meeting" ? "Meeting"
    : type === "document" ? (channel ? `Document via ${channel}` : "Document")
    : type === "referral" ? "Referral"
    : humanize(type);
  const tail = [type === "call" || type === "meeting" ? channel : null, when, type === "referral" || type === "document" ? detail : null]
    .filter((part): part is string => Boolean(part));
  return tail.length ? `${head} \u00b7 ${tail.join(" \u00b7 ")}` : head;
}

// Latest revision per stage plus earlier revisions (newest first), for stages 1..8.
export function groupByStage(rows: StageResultRow[]) {
  return Array.from({ length: STAGE_COUNT }, (_unused, index) => {
    const stage = index + 1;
    const revisions = rows.filter((row) => row.stage === stage).sort((a, b) => b.revision - a.revision);
    return { stage, latest: revisions[0] as StageResultRow | undefined, earlier: revisions.slice(1) };
  });
}
