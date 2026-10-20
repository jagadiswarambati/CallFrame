import { apiFetch, ApiError } from "@/lib/api";

export type CallStatus = "in_progress" | "completed" | "ended_early";
export type CallDisplayStatus = CallStatus | "abandoned";
export type DisplayStatus = CallDisplayStatus;
export const STATUS_LABELS: Record<DisplayStatus, string> = {
  in_progress: "In progress",
  completed: "Completed",
  ended_early: "Ended early",
  abandoned: "Abandoned",
};
export function outcomeInfo(outcome: string | null): { label: string; tone: "success" | "partial" | "negative" | "restricted" } | null {
  if (!outcome) return null;
  const labels: Record<string, { label: string; tone: "success" | "partial" | "negative" | "restricted" }> = {
    next_step_set: { label: "Call or meeting agreed", tone: "success" },
    document_requested: { label: "Document requested", tone: "partial" },
    callback_requested: { label: "Callback requested", tone: "partial" },
    referred: { label: "Referred to someone", tone: "partial" },
    declined: { label: "Declined", tone: "negative" },
    wrong_contact: { label: "Wrong contact", tone: "negative" },
    no_contact: { label: "No contact", tone: "negative" },
    do_not_call: { label: "Do not call", tone: "restricted" },
  };
  return labels[outcome] ?? null;
}
export type StageDraft = { outcomeKey: string | null; prospectWords: string; notes: string; revision?: number; createdAt?: string };
export type StageHistoryEntry = StageDraft & { stage: number; revision: number; createdAt?: string };
export type CallSession = {
  id: string;
  callerName: string;
  company: string;
  callerRole?: string | null;
  currentStage: number;
  lastStage: number;
  timerSeconds: number;
  stageData: Record<number, StageDraft>;
  stageHistory: StageHistoryEntry[];
  notes: string;
  outcome?: string | null;
  followUpDate?: string | null;
  nextStepType?: string | null;
  nextStepChannel?: string | null;
  nextStepDetail?: string | null;
  status: CallStatus;
  displayStatus: CallDisplayStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  endedAt?: string | null;
  doNotCall: boolean;
  dncWords?: string | null;
  aiSuggestions: Array<{ id: number; stage: number; suggestion: string; created_at: string }>;
};

const ACTIVE_CALL_KEY = "callframe.activeCallId";
const RESUME_CALL_KEY = "callframe.explicitResumeCallId";
const CALL_DRAFT_PREFIX = "callframe_draft_";

type ApiCall = {
  id?: string | number;
  prospect_name?: string | null;
  company?: string | null;
  prospect_role?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  ended_at?: string | null;
  status?: CallStatus | null;
  display_status?: CallDisplayStatus | null;
  last_stage?: number | string | null;
  outcome?: string | null;
  next_step_when?: string | null;
  next_step_type?: string | null;
  next_step_channel?: string | null;
  next_step_detail?: string | null;
  updated_at?: string | null;
  do_not_call?: boolean | null;
  dnc_words?: string | null;
};
type ApiStage = { stage: number; revision: number; outcome_key: string | null; prospect_words: string | null; notes: string | null; created_at?: string };
type ApiAiSuggestion = { id: number | string; stage: number | string; suggestion: string; created_at: string };
type ApiCallDetails = { call: ApiCall; stage_results?: ApiStage[]; latest_by_stage?: ApiStage[]; ai_suggestions?: ApiAiSuggestion[] };

function storageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try { if (value) window.localStorage.setItem(key, value); else window.localStorage.removeItem(key); } catch { /* storage is optional */ }
}

export function getActiveCallId(): string | null { return storageGet(ACTIVE_CALL_KEY); }
export function setActiveCallId(id: string | null): void { storageSet(ACTIVE_CALL_KEY, id); }
export function getResumeCallId(): string | null { return storageGet(RESUME_CALL_KEY); }
export function setResumeCallId(id: string | null): void { storageSet(RESUME_CALL_KEY, id); }

export function saveCallDraft(id: string, data: Partial<CallSession>): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(`${CALL_DRAFT_PREFIX}${id}`, JSON.stringify(data)); } catch { /* optional cache */ }
}
export function getCallDraft(id: string): Partial<CallSession> | null {
  const raw = storageGet(`${CALL_DRAFT_PREFIX}${id}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as Partial<CallSession>; } catch { return null; }
}
export function clearCallDraft(id: string): void { storageSet(`${CALL_DRAFT_PREFIX}${id}`, null); }

function elapsedSeconds(startedAt?: string, endedAt?: string | null): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}

function mapCall(raw: ApiCall, stages: ApiStage[] = [], ai: ApiAiSuggestion[] = [], allStages: ApiStage[] = []): CallSession {
  const stageData: Record<number, StageDraft> = {};
  for (const item of stages) {
    stageData[Number(item.stage)] = {
      outcomeKey: item.outcome_key ?? null,
      prospectWords: item.prospect_words ?? "",
      notes: item.notes ?? "",
      revision: Number(item.revision),
      createdAt: item.created_at,
    };
  }
  const startedAt = raw.started_at ?? raw.created_at ?? new Date().toISOString();
  const endedAt = raw.ended_at ?? null;
  const status = (raw.status ?? "in_progress") as CallStatus;
  const displayStatus = (raw.display_status ?? raw.status ?? "in_progress") as CallDisplayStatus;
  const lastStage = Number(raw.last_stage ?? 1);
  const currentStage = Math.min(8, Math.max(1, lastStage));
  return {
    id: String(raw.id),
    callerName: String(raw.prospect_name ?? ""),
    company: String(raw.company ?? ""),
    callerRole: raw.prospect_role ?? null,
    currentStage,
    lastStage,
    timerSeconds: elapsedSeconds(startedAt, endedAt),
    stageData,
    stageHistory: allStages.map((item) => ({ stage: Number(item.stage), revision: Number(item.revision), outcomeKey: item.outcome_key ?? null, prospectWords: item.prospect_words ?? "", notes: item.notes ?? "", createdAt: item.created_at })),
    notes: stageData[currentStage]?.notes ?? "",
    outcome: raw.outcome ?? null,
    followUpDate: raw.next_step_when ?? null,
    nextStepType: raw.next_step_type ?? null,
    nextStepChannel: raw.next_step_channel ?? null,
    nextStepDetail: raw.next_step_detail ?? null,
    status,
    displayStatus,
    createdAt: startedAt,
    updatedAt: raw.updated_at ?? startedAt,
    startedAt,
    endedAt,
    doNotCall: Boolean(raw.do_not_call),
    dncWords: raw.dnc_words ?? null,
    aiSuggestions: ai.map((item) => ({ id: Number(item.id), stage: Number(item.stage), suggestion: String(item.suggestion ?? ""), created_at: String(item.created_at ?? "") })),
  };
}

export async function startNewCall(details: { name?: string; company?: string; role?: string }): Promise<CallSession> {
  const payload = await apiFetch<{ call: ApiCall }>("/api/calls", {
    method: "POST",
    body: JSON.stringify({ prospect_name: details.name ?? "", company: details.company ?? "", prospect_role: details.role ?? "" }),
  });
  const call = mapCall(payload.call);
  setActiveCallId(call.id);
  setResumeCallId(null);
  clearCallDraft(call.id);
  return call;
}

export async function fetchCallById(id: string): Promise<CallSession> {
  const payload = await apiFetch<ApiCallDetails>(`/api/calls/${encodeURIComponent(id)}`);
  return mapCall(payload.call, payload.latest_by_stage ?? [], payload.ai_suggestions ?? [], payload.stage_results ?? []);
}

export async function saveStageProgress(id: string, payload: { stage: number; outcomeKey?: string | null; prospectWords?: string; notes?: string }): Promise<CallSession> {
  await apiFetch<{ result: ApiStage }>(`/api/calls/${encodeURIComponent(id)}/stages/${payload.stage}`, {
    method: "PUT",
    body: JSON.stringify({ outcome_key: payload.outcomeKey ?? null, prospect_words: payload.prospectWords ?? "", notes: payload.notes ?? "" }),
  });
  const updated = await fetchCallById(id);
  saveCallDraft(id, updated);
  return updated;
}

export type NextStepPayload = { type?: string | null; channel?: string | null; when?: string | null; detail?: string | null };
export async function endCallSession(id: string, payload: { outcome: string; endedStage: number; nextStep?: NextStepPayload }): Promise<CallSession> {
  let result: { call: ApiCall };
  try {
    result = await apiFetch<{ call: ApiCall }>(`/api/calls/${encodeURIComponent(id)}/close`, {
      method: "POST",
      body: JSON.stringify({ outcome: payload.outcome, ended_stage: payload.endedStage, next_step: payload.nextStep ?? {} }),
    });
  } catch (error) {
    // A timeout can happen after the server has committed the close transaction but before
    // the response reaches the browser. Re-read the authoritative record before offering retry.
    const ambiguousNetworkFailure = error instanceof ApiError && ["TIMEOUT", "NETWORK", "ABORTED"].includes(error.code);
    if (ambiguousNetworkFailure) {
      const persisted = await fetchCallById(id).catch(() => null);
      if (persisted && persisted.status !== "in_progress") {
        setActiveCallId(null);
        setResumeCallId(null);
        clearCallDraft(id);
        return persisted;
      }
    }
    throw error;
  }
  setActiveCallId(null);
  setResumeCallId(null);
  clearCallDraft(id);
  return mapCall(result.call);
}

export async function fetchCallHistory(): Promise<CallSession[]> {
  const payload = await apiFetch<{ calls: ApiCall[]; total: number }>("/api/calls?limit=50&offset=0");
  return payload.calls.map((call) => mapCall(call));
}

/** Fetch every saved call in pages for exports without changing the History page's normal loading behavior. */
export async function fetchAllCallHistory(): Promise<CallSession[]> {
  const pageSize = 100;
  const allCalls: CallSession[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const payload = await apiFetch<{ calls: ApiCall[]; total: number }>(
      `/api/calls?limit=${pageSize}&offset=${offset}`,
    );
    allCalls.push(...payload.calls.map((call) => mapCall(call)));
    total = Number(payload.total);
    if (payload.calls.length === 0) break;
    offset += payload.calls.length;
  }

  return allCalls;
}

export { ApiError };
