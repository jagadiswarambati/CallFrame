"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);
const activeCallStorageKey = "callframe.activeCallId";

const stages = [
  {
    title: "Opening",
    guidance:
      "Reach the right person, introduce yourself, and listen for contact or availability issues.",
    prompts: [
      "Introduce yourself and your organisation.",
      "Check that you have reached the intended person.",
      "Listen for a transfer, an unavailable contact, or a wrong number.",
    ],
    outcomes: [
      ["reached_prospect", "Reached the right person"],
      ["via_assistant", "Assistant or switchboard"],
      ["not_available", "Not available now"],
      ["wrong_or_left", "Wrong number or left"],
      ["line_or_language", "Bad line or language barrier"],
    ],
  },
  {
    title: "Purpose",
    guidance:
      "Explain why you are calling in one or two clear sentences, then listen for questions or concerns.",
    prompts: [
      "State the reason for the call simply.",
      "Avoid claims you cannot support.",
      "Listen for questions about the purpose or how you made contact.",
    ],
    outcomes: [
      ["purpose_heard", "Heard the purpose"],
      ["asked_what_we_do", "Asked what we do"],
      ["asked_number_source", "Asked about the number source"],
      ["called_it_sales", "Said it sounds like a sales call"],
    ],
  },
  {
    title: "Permission",
    guidance:
      "Capture a clear yes, no, or callback request; silence and an unanswered question are not permission.",
    prompts: [
      "Ask if they are willing and available to continue.",
      "Listen for an explicit yes or no.",
      "If they ask for another time, record the callback request.",
    ],
    outcomes: [
      ["yes_now", "Clear yes — talk now"],
      ["asked_callback", "Asked for a callback"],
      ["send_first", "Wants information first"],
      ["no_clear_answer", "No clear answer"],
      ["declined_to_talk", "Declined to talk"],
    ],
  },
  {
    title: "Their business",
    guidance:
      "Understand the prospect's company and work before pitching; listen for their own description and corrections.",
    prompts: [
      "Invite them to describe their company or work.",
      "Listen for the terms they use and what they emphasise.",
      "Check your understanding rather than filling in gaps.",
    ],
    outcomes: [
      ["shared_business", "Described their business"],
      ["one_line_waiting", "Brief answer, then paused"],
      ["corrected_us", "Corrected an assumption"],
      ["asked_us_first", "Asked about us first"],
    ],
  },
  {
    title: "Their need, in their words",
    guidance:
      "Capture the prospect's statement exactly; keep your interpretation and notes in the separate field.",
    prompts: [
      "Listen for the goal, concern, or current priority they actually name.",
      "Do not paraphrase in the prospect-words field.",
      "If they do not identify a need, record that without inference.",
    ],
    outcomes: [
      ["named_goal", "Named a goal or problem"],
      ["says_fine", "Says all is fine"],
      ["asked_what_we_offer", "Asked what we can do"],
      ["unclear", "Unclear or no answer"],
    ],
  },
  {
    title: "Objection",
    guidance:
      "Record the reason for hesitation or refusal and respect the prospect's boundary.",
    prompts: [
      "Listen for the specific concern before responding.",
      "Acknowledge a refusal without pressure.",
      "A do-not-call request is a restriction, not a sales outcome.",
    ],
    outcomes: [
      ["has_provider", "Already has a team or adviser"],
      ["not_right_person", "Not the right person"],
      ["not_relevant", "Not relevant or no need"],
      ["wants_writing", "Wants it in writing"],
      ["declined", "Said no"],
      ["asked_not_to_call", "⚠ Asked not to be called again"],
    ],
  },
  {
    title: "Next step",
    guidance:
      "Record one concrete action the prospect agreed to, including a time or channel where relevant.",
    prompts: [
      "Confirm what the prospect explicitly agreed to.",
      "Capture a specific time, channel, or person where applicable.",
      "If nothing was agreed, record that rather than implying a commitment.",
    ],
    outcomes: [
      ["doc_agreed", "Agreed to receive a document"],
      ["time_named", "Named a time to talk"],
      ["meeting_agreed", "Agreed to a meeting"],
      ["referred", "Referred us to someone"],
      ["nothing_agreed", "Nothing agreed"],
    ],
  },
  {
    title: "Close",
    guidance:
      "End respectfully and ensure the outcome and next step match what was actually said.",
    prompts: [
      "Confirm the agreed action, if there is one.",
      "Keep a callback, document request, or referral distinct from a success.",
      "The Stage 5 words below remain the prospect's exact statement.",
    ],
    outcomes: [
      ["closed_with_agreement", "Closed with an agreement"],
      ["closed_after_no", "Closed after a no"],
      ["line_dropped", "Line dropped or they hung up"],
    ],
  },
] as const;

const finalOutcomes = [
  { key: "next_step_set", label: "Call or meeting agreed", className: "success" },
  { key: "document_requested", label: "Document requested", className: "partial" },
  { key: "callback_requested", label: "Callback requested", className: "partial" },
  { key: "referred", label: "Referred to someone", className: "partial" },
  { key: "declined", label: "Declined", className: "negative" },
  { key: "wrong_contact", label: "Wrong contact or person left", className: "negative" },
  { key: "no_contact", label: "No proper contact", className: "negative" },
  { key: "do_not_call", label: "Do not call again", className: "restricted" },
] as const;

type OutcomeKey = (typeof finalOutcomes)[number]["key"];
type StageDraft = {
  outcome: string | null;
  words: string;
  notes: string;
};
type CallRecord = {
  id: string;
  prospect_name: string;
  company: string;
  prospect_role: string | null;
  status: "in_progress" | "completed" | "ended_early";
  last_stage: number;
  outcome: OutcomeKey | null;
  next_step_type: string | null;
  next_step_channel: string | null;
  next_step_when: string | null;
  next_step_detail: string | null;
  do_not_call: boolean;
  dnc_words: string | null;
  started_at: string;
  ended_at: string | null;
};
type StageResult = {
  id: string;
  stage: number;
  revision: number;
  outcome_key: string | null;
  prospect_words: string;
  notes: string;
};
type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
type NextStep = { type: string; channel: string; when: string; detail: string };
type ApiError = Error & { status?: number; details?: { field: string; message: string }[] };

const emptyDraft = (): StageDraft => ({ outcome: null, words: "", notes: "" });
const emptyNextStep = (): NextStep => ({ type: "", channel: "", when: "", detail: "" });

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string; details?: { field: string; message: string }[] } }
    | T
    | null;
  if (!response.ok) {
    const error = new Error(
      (payload as { error?: { message?: string } } | null)?.error?.message ??
        "The request could not be completed. Please retry.",
    ) as ApiError;
    error.status = response.status;
    error.details = (payload as { error?: { details?: { field: string; message: string }[] } } | null)
      ?.error?.details;
    throw error;
  }
  return payload as T;
}

function suggestedOutcome(drafts: StageDraft[]) {
  const key = (stage: number) => drafts[stage - 1]?.outcome;
  if (drafts.some((draft) => draft.outcome === "asked_not_to_call")) {
    return { outcome: "do_not_call" as OutcomeKey, reason: "A do-not-call request was recorded." };
  }
  if (key(7) === "meeting_agreed" || key(7) === "time_named") {
    return { outcome: "next_step_set" as OutcomeKey, reason: "A time or meeting was recorded at Stage 7." };
  }
  if (key(7) === "doc_agreed") {
    return { outcome: "document_requested" as OutcomeKey, reason: "A document was recorded at Stage 7." };
  }
  if (key(7) === "referred") {
    return { outcome: "referred" as OutcomeKey, reason: "A referral was recorded at Stage 7." };
  }
  if (key(3) === "asked_callback") {
    return { outcome: "callback_requested" as OutcomeKey, reason: "A callback was recorded at Stage 3." };
  }
  if (key(3) === "send_first" || key(6) === "wants_writing") {
    return { outcome: "document_requested" as OutcomeKey, reason: "A request for information was recorded." };
  }
  if (
    key(3) === "declined_to_talk" ||
    ["declined", "not_relevant", "has_provider"].includes(key(6) ?? "")
  ) {
    return { outcome: "declined" as OutcomeKey, reason: "A refusal was recorded." };
  }
  if (key(6) === "not_right_person") {
    return { outcome: "declined" as OutcomeKey, reason: "No referral was recorded at Stage 7." };
  }
  if (key(1) === "wrong_or_left") {
    return { outcome: "wrong_contact" as OutcomeKey, reason: "A wrong contact was recorded at Stage 1." };
  }
  if (["line_or_language", "not_available"].includes(key(1) ?? "")) {
    return { outcome: "no_contact" as OutcomeKey, reason: "A contact or availability issue was recorded at Stage 1." };
  }
  return null;
}

function formatDuration(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function Home() {
  const [prospectName, setProspectName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [call, setCall] = useState<CallRecord | null>(null);
  const callRef = useRef<CallRecord | null>(null);
  const [drafts, setDrafts] = useState<StageDraft[]>(() => stages.map(emptyDraft));
  const draftsRef = useRef<StageDraft[]>(drafts);
  const needsSave = useRef<boolean[]>(stages.map(() => false));
  const [currentStage, setCurrentStage] = useState(0);
  const [saveStatuses, setSaveStatuses] = useState<SaveStatus[]>(
    () => stages.map(() => "idle"),
  );
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeOutcome, setCloseOutcome] = useState<OutcomeKey | "">("");
  const [nextStep, setNextStep] = useState<NextStep>(emptyNextStep);
  const [closeError, setCloseError] = useState("");
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const debounceTimer = useRef<number | null>(null);

  const setActiveCall = useCallback((nextCall: CallRecord | null) => {
    callRef.current = nextCall;
    setCall(nextCall);
  }, []);

  const loadCall = useCallback(
    async (id: string) => {
      setLoading(true);
      setLoadError("");
      try {
        const result = await apiRequest<{ call: CallRecord; stage_results: StageResult[] }>(
          `/api/calls/${encodeURIComponent(id)}`,
        );
        const restored = stages.map(() => emptyDraft());
        const statuses = stages.map(() => "idle" as SaveStatus);
        const loadedStages = new Set<number>();
        for (const stageResult of result.stage_results) {
          const index = stageResult.stage - 1;
          if (index < 0 || index >= stages.length || loadedStages.has(index)) continue;
          loadedStages.add(index);
          restored[index] = {
            outcome: stageResult.outcome_key,
            words: stageResult.prospect_words,
            notes: stageResult.notes,
          };
          statuses[index] = "saved";
        }
        draftsRef.current = restored;
        needsSave.current = stages.map(() => false);
        setDrafts(restored);
        setSaveStatuses(statuses);
        setActiveCall(result.call);
        setCurrentStage(Math.max(0, Math.min(7, result.call.last_stage - 1)));
        if (result.call.status !== "in_progress") setCloseOpen(false);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "The call could not be restored. Your saved call id is still available to retry.",
        );
      } finally {
        setLoading(false);
      }
    },
    [setActiveCall],
  );

  useEffect(() => {
    const id = window.localStorage.getItem(activeCallStorageKey);
    if (!id) return;
    const timer = window.setTimeout(() => void loadCall(id), 0);
    return () => window.clearTimeout(timer);
  }, [loadCall]);

  useEffect(() => {
    if (!call || call.status !== "in_progress") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [call]);

  const setStageDraft = (index: number, patch: Partial<StageDraft>) => {
    const next = draftsRef.current.map((draft, draftIndex) =>
      draftIndex === index ? { ...draft, ...patch } : draft,
    );
    draftsRef.current = next;
    needsSave.current[index] = true;
    setDrafts(next);
    setSaveStatuses((previous) =>
      previous.map((status, statusIndex) =>
        statusIndex === index ? "pending" : status,
      ),
    );
    setSaveError("");
  };

  const persistStage = useCallback((index: number) => {
    const callId = callRef.current?.id;
    if (!callId || callRef.current?.status !== "in_progress") {
      return Promise.resolve(false);
    }
    const operation = saveQueue.current.then(async () => {
      const draft = draftsRef.current[index];
      const savedDraft = { ...draft };
      setSaveStatuses((previous) =>
        previous.map((status, statusIndex) =>
          statusIndex === index ? "saving" : status,
        ),
      );
      try {
        await apiRequest(`/api/calls/${encodeURIComponent(callId)}/stages/${index + 1}`, {
          method: "PUT",
          body: JSON.stringify({
            outcome_key: draft.outcome,
            prospect_words: draft.words,
            notes: draft.notes,
          }),
        });
        const latestDraft = draftsRef.current[index];
        const unchanged =
          latestDraft.outcome === savedDraft.outcome &&
          latestDraft.words === savedDraft.words &&
          latestDraft.notes === savedDraft.notes;
        if (unchanged) needsSave.current[index] = false;
        setSaveStatuses((previous) =>
          previous.map((status, statusIndex) =>
            statusIndex === index ? (unchanged ? "saved" : "pending") : status,
          ),
        );
        setSaveError("");
        return true;
      } catch (error) {
        setSaveStatuses((previous) =>
          previous.map((status, statusIndex) =>
            statusIndex === index ? "error" : status,
          ),
        );
        setSaveError(
          error instanceof Error ? error.message : "Stage not saved. Retry before continuing.",
        );
        return false;
      }
    });
    saveQueue.current = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }, []);

  useEffect(() => {
    if (!call || call.status !== "in_progress" || closeOpen) return;
    if (!needsSave.current[currentStage]) return;
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      void persistStage(currentStage);
    }, 700);
    return () => {
      if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    };
  }, [call, closeOpen, currentStage, drafts, persistStage]);

  const startCall = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStartError("");
    setLoading(true);
    try {
      const result = await apiRequest<{ call: CallRecord }>("/api/calls", {
        method: "POST",
        body: JSON.stringify({
          prospect_name: prospectName,
          company,
          prospect_role: role,
        }),
      });
      window.localStorage.setItem(activeCallStorageKey, result.call.id);
      const fresh = stages.map(emptyDraft);
      draftsRef.current = fresh;
      needsSave.current = stages.map(() => false);
      setDrafts(fresh);
      setSaveStatuses(stages.map(() => "idle"));
      setCurrentStage(0);
      setActiveCall(result.call);
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : "The call could not be started. Your details remain in the form; retry when the service is available.",
      );
    } finally {
      setLoading(false);
    }
  };

  const goToStage = async (index: number) => {
    if (!call || index < 0 || index > 7) return;
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    const saved = await persistStage(currentStage);
    if (!saved) return;
    if (index > call.last_stage - 1) {
      try {
        const result = await apiRequest<{ call: CallRecord }>(
          `/api/calls/${encodeURIComponent(call.id)}/progress`,
          {
            method: "PATCH",
            body: JSON.stringify({ stage: index + 1 }),
          },
        );
        setActiveCall({ ...call, ...result.call });
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Progress was not saved. Retry before continuing.",
        );
        return;
      }
    }
    setCurrentStage(index);
    setCloseOpen(false);
  };

  const selectStageOutcome = (index: number, outcome: string) => {
    const selected = draftsRef.current[index].outcome === outcome ? null : outcome;
    setStageDraft(index, { outcome: selected });
    if (selected) void persistStage(index);
    if (index === 5 && selected === "asked_not_to_call") {
      setCloseOutcome("do_not_call");
      setCloseError("");
      setCloseOpen(true);
    }
  };

  const openClosePanel = () => {
    const suggestion = suggestedOutcome(draftsRef.current);
    setCloseOutcome(suggestion?.outcome ?? "");
    setCloseError("");
    setCloseOpen(true);
  };

  const saveAndClose = async () => {
    if (!call || !closeOutcome) {
      setCloseError("Choose the outcome that best matches what happened.");
      return;
    }
    setClosing(true);
    setCloseError("");
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);

    for (let index = 0; index < draftsRef.current.length; index += 1) {
      const draft = draftsRef.current[index];
      const hasData = Boolean(draft.outcome || draft.words || draft.notes);
      if (hasData || needsSave.current[index]) {
        const saved = await persistStage(index);
        if (!saved) {
          setCloseError("A stage could not be saved. Retry; the call is still open and your edits remain here.");
          setClosing(false);
          return;
        }
      }
    }

    try {
      const result = await apiRequest<{ call: CallRecord }>(
        `/api/calls/${encodeURIComponent(call.id)}/close`,
        {
          method: "POST",
          body: JSON.stringify({
            outcome: closeOutcome,
            ended_stage: currentStage + 1,
            next_step: {
              type: nextStep.type || null,
              channel: nextStep.channel || null,
              when: nextStep.when || null,
              detail: nextStep.detail || null,
            },
          }),
        },
      );
      setActiveCall({ ...call, ...result.call });
      setCloseOpen(false);
      window.localStorage.removeItem(activeCallStorageKey);
    } catch (error) {
      setCloseError(
        error instanceof Error
          ? error.message
          : "The call was not closed. Your edits remain here; retry when the service is available.",
      );
    } finally {
      setClosing(false);
    }
  };

  const retryLoad = () => {
    const id = window.localStorage.getItem(activeCallStorageKey);
    if (id) void loadCall(id);
  };

  const startAnotherCall = () => {
    callRef.current = null;
    setCall(null);
    const fresh = stages.map(emptyDraft);
    draftsRef.current = fresh;
    needsSave.current = stages.map(() => false);
    setDrafts(fresh);
    setSaveStatuses(stages.map(() => "idle"));
    setCurrentStage(0);
    setProspectName("");
    setCompany("");
    setRole("");
    setCloseOpen(false);
    setCloseOutcome("");
    setNextStep(emptyNextStep());
    setStartError("");
    setSaveError("");
  };

  const currentDraft = drafts[currentStage];
  const suggestion = suggestedOutcome(drafts);
  if (loadError && !call) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f5f8] px-5 py-12 text-[#16202c]">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Could not restore the call</h1>
          <p className="mt-3 text-sm leading-6 text-red-800" role="alert">
            {loadError}
          </p>
          <button
            className="mt-6 min-h-11 rounded-lg bg-[#2a5bd7] px-5 font-semibold text-white"
            onClick={retryLoad}
            type="button"
          >
            Retry loading
          </button>
        </section>
      </main>
    );
  }

  if (!call) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f5f8] px-5 py-12 text-[#16202c]">
        <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2a5bd7]">
            Callframe
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Start a call
          </h1>
          <p className="mt-3 max-w-lg leading-7 text-slate-600">
            Keep the conversation clear, record what was actually said, and
            capture an honest next step.
          </p>
          {loading && (
            <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900" role="status">
              Restoring a saved call or waiting for the service…
            </p>
          )}
          <form className="mt-7 space-y-5" onSubmit={startCall}>
            <div>
              <label className="block text-sm font-semibold" htmlFor="prospect-name">
                Prospect name
              </label>
              <input
                autoComplete="name"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3.5 focus:border-[#2a5bd7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                id="prospect-name"
                maxLength={4000}
                onChange={(event) => setProspectName(event.target.value)}
                required
                value={prospectName}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="company">
                Company
              </label>
              <input
                autoComplete="organization"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3.5 focus:border-[#2a5bd7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                id="company"
                maxLength={4000}
                onChange={(event) => setCompany(event.target.value)}
                required
                value={company}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="prospect-role">
                Role <span className="font-normal text-slate-500">· optional</span>
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3.5 focus:border-[#2a5bd7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                id="prospect-role"
                maxLength={4000}
                onChange={(event) => setRole(event.target.value)}
                value={role}
              />
            </div>
            {startError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800" role="alert">
                {startError}
              </p>
            )}
            <button
              className="min-h-11 w-full rounded-lg bg-[#2a5bd7] px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7] disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Starting…" : "Start call"}
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Call details are sent to the backend for saving. If saving fails,
            the form stays filled so you can retry.
          </p>
        </section>
      </main>
    );
  }

  if (call.status !== "in_progress") {
    const finalOutcome = finalOutcomes.find((item) => item.key === call.outcome);
    const nextStepText = [
      call.next_step_type,
      call.next_step_when,
      call.next_step_channel,
      call.next_step_detail,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <main className="min-h-screen bg-[#f3f5f8] px-5 py-12 text-[#16202c]">
        <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2a5bd7]">
            Callframe · saved call
          </p>
          <h1 className="mt-4 text-3xl font-semibold">
            {call.status === "completed" ? "Call completed" : "Call ended early"}
          </h1>
          <p className="mt-2 text-slate-600">
            Stage {call.last_stage}: {stages[call.last_stage - 1].title}
          </p>
          <dl className="mt-7 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prospect</dt>
              <dd className="mt-1 font-medium">{call.prospect_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</dt>
              <dd className="mt-1 font-medium">{call.company}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outcome</dt>
              <dd className={`mt-1 font-medium ${call.do_not_call ? "text-red-800" : ""}`}>
                {finalOutcome?.label ?? "Not recorded"}
                {call.do_not_call && " · Restricted"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next step</dt>
              <dd className="mt-1 font-medium">{nextStepText || "None recorded"}</dd>
            </div>
          </dl>
          <section className="mt-6">
            <h2 className="text-sm font-semibold">Stage 5 · Their exact words</h2>
            <p className="mt-2 min-h-16 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-serif leading-7 text-slate-800">
              {drafts[4].words || "No words recorded."}
            </p>
          </section>
          <p className="mt-5 text-sm text-emerald-800" role="status">
            Call saved successfully.
          </p>
          <button
            className="mt-6 min-h-11 rounded-lg bg-[#2a5bd7] px-5 font-semibold text-white"
            onClick={startAnotherCall}
            type="button"
          >
            Start another call
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f8] pb-28 text-[#16202c] lg:pb-10">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="font-semibold tracking-tight">Callframe</p>
            <p className="mt-1 text-sm text-slate-600">
              {call.prospect_name} · {call.company}
              {call.prospect_role ? ` · ${call.prospect_role}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {call.do_not_call && (
              <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-900">
                ⚠ Do not call
              </span>
            )}
            <span className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm tabular-nums">
              {formatDuration(call.started_at, now)}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8 sm:py-8">
        <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <nav
            aria-label="Call stages"
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:p-4"
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="text-sm font-semibold">Call stages</h2>
              <span className="text-xs text-slate-500">
                {currentStage + 1} of {stages.length}
              </span>
            </div>
            <ol className="grid grid-cols-4 gap-2 lg:grid-cols-1">
              {stages.map((stage, index) => {
                const current = index === currentStage;
                const visited = index < call.last_stage;
                return (
                  <li key={stage.title}>
                    <button
                      aria-current={current ? "step" : undefined}
                      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7] lg:justify-start lg:px-3 ${
                        current
                          ? "bg-[#2a5bd7] font-semibold text-white"
                          : visited
                            ? "bg-blue-50 font-medium text-blue-900 hover:bg-blue-100"
                            : "text-slate-600 hover:bg-slate-100"
                      }`}
                      disabled={!visited && index !== call.last_stage}
                      onClick={() => void goToStage(index)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                          current ? "bg-white/20" : visited ? "bg-blue-100" : "bg-slate-100"
                        }`}
                      >
                        {visited && !current ? "✓" : index + 1}
                      </span>
                      <span className="hidden truncate lg:inline">{stage.title}</span>
                      <span className="sr-only lg:hidden">{stage.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <section
            aria-labelledby="stage-heading"
            className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            {closeOpen ? (
              <div className="space-y-6 p-5 sm:p-8">
                <div>
                  <p className="text-sm font-semibold text-[#2a5bd7]">
                    Closing · stage reached {currentStage + 1} of 8
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold" id="stage-heading">
                    End this call
                  </h1>
                  <p className="mt-2 leading-7 text-slate-600">
                    Choose what actually happened. A document, callback, or
                    referral is a partial outcome, not a success.
                  </p>
                </div>

                {suggestion && (
                  <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
                    <strong>Suggested from what you recorded:</strong>{" "}
                    {finalOutcomes.find((item) => item.key === suggestion.outcome)?.label}.{" "}
                    {suggestion.reason}
                  </p>
                )}

                <fieldset>
                  <legend className="text-sm font-semibold">Final outcome</legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {finalOutcomes.map((outcome) => {
                      const disabledDnc =
                        outcome.key === "do_not_call" &&
                        drafts[5].outcome !== "asked_not_to_call";
                      const selected = closeOutcome === outcome.key;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7] disabled:cursor-not-allowed disabled:opacity-50 ${
                            outcome.className === "restricted"
                              ? "border-red-300 bg-red-50 text-red-900"
                              : selected
                                ? "border-[#2a5bd7] bg-blue-50 text-blue-900 ring-1 ring-[#2a5bd7]"
                                : "border-slate-300 text-slate-700 hover:bg-slate-50"
                          } ${selected && outcome.className === "restricted" ? "ring-1 ring-red-700" : ""}`}
                          disabled={disabledDnc}
                          key={outcome.key}
                          onClick={() => {
                            setCloseOutcome(outcome.key);
                            setNextStep(emptyNextStep());
                            setCloseError("");
                          }}
                          type="button"
                        >
                          {outcome.label}
                          {outcome.className === "partial" && (
                            <span className="ml-2 text-xs font-normal">(partial)</span>
                          )}
                          {outcome.className === "restricted" && (
                            <span className="ml-2 text-xs font-normal">(restricted)</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {drafts[5].outcome !== "asked_not_to_call" && (
                    <p className="mt-2 text-xs text-slate-500">
                      Do not call is available only after recording that explicit request at Stage 6.
                    </p>
                  )}
                </fieldset>

                {closeOutcome &&
                  ["next_step_set", "document_requested", "callback_requested", "referred"].includes(
                    closeOutcome,
                  ) && (
                    <fieldset className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                      <legend className="px-1 text-sm font-semibold">Agreed next step</legend>
                      {closeOutcome === "next_step_set" && (
                        <>
                          <label className="text-sm font-medium">
                            Type
                            <select
                              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                              onChange={(event) =>
                                setNextStep({ ...nextStep, type: event.target.value })
                              }
                              value={nextStep.type}
                            >
                              <option value="">Choose call or meeting</option>
                              <option value="call">Call</option>
                              <option value="meeting">Meeting</option>
                            </select>
                          </label>
                          <label className="text-sm font-medium">
                            When
                            <input
                              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                              maxLength={4000}
                              onChange={(event) =>
                                setNextStep({ ...nextStep, when: event.target.value })
                              }
                              placeholder="Agreed date or time"
                              value={nextStep.when}
                            />
                          </label>
                        </>
                      )}
                      {closeOutcome === "callback_requested" && (
                        <label className="text-sm font-medium sm:col-span-2">
                          Callback time
                          <input
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                            maxLength={4000}
                            onChange={(event) =>
                              setNextStep({
                                ...nextStep,
                                type: "call",
                                when: event.target.value,
                              })
                            }
                            placeholder="Time they requested"
                            value={nextStep.when}
                          />
                        </label>
                      )}
                      {closeOutcome === "document_requested" && (
                        <label className="text-sm font-medium sm:col-span-2">
                          Send via
                          <input
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                            maxLength={4000}
                            onChange={(event) =>
                              setNextStep({
                                ...nextStep,
                                type: "document",
                                channel: event.target.value,
                              })
                            }
                            placeholder="Agreed communication channel"
                            value={nextStep.channel}
                          />
                        </label>
                      )}
                      {closeOutcome === "referred" && (
                        <label className="text-sm font-medium sm:col-span-2">
                          Who were you referred to?
                          <input
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                            maxLength={4000}
                            onChange={(event) =>
                              setNextStep({
                                ...nextStep,
                                type: "referral",
                                detail: event.target.value,
                              })
                            }
                            placeholder="Name or role they provided"
                            value={nextStep.detail}
                          />
                        </label>
                      )}
                    </fieldset>
                  )}

                {closeOutcome === "do_not_call" && (
                  <section className="rounded-lg border border-red-300 bg-red-50 p-4">
                    <p className="font-semibold text-red-950">Restricted · no further calls</p>
                    <p className="mt-1 text-sm leading-6 text-red-900">
                      Their exact request must be captured in the Stage 6 words field. No next step is allowed.
                    </p>
                    <p className="mt-3 whitespace-pre-wrap font-serif text-red-950">
                      {drafts[5].words || "No exact words recorded yet."}
                    </p>
                    {!drafts[5].words.trim() && (
                      <button
                        className="mt-3 min-h-11 rounded-lg border border-red-400 bg-white px-4 text-sm font-semibold text-red-900"
                        onClick={() => {
                          setCloseOpen(false);
                          void goToStage(5);
                        }}
                        type="button"
                      >
                        Return to Stage 6 and record their words
                      </button>
                    )}
                  </section>
                )}

                <section>
                  <h2 className="text-sm font-semibold">Stage 5 · Their need, in their words</h2>
                  <p className="mt-2 min-h-16 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-serif leading-7 text-slate-800">
                    {drafts[4].words || "No exact words recorded at Stage 5."}
                  </p>
                </section>

                {closeError && (
                  <div className="rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
                    <p>{closeError}</p>
                    {saveError && (
                      <button
                        className="mt-2 min-h-10 rounded-md border border-red-300 bg-white px-3 font-semibold"
                        onClick={() => {
                          const failedStage = saveStatuses.findIndex((status) => status === "error");
                          void persistStage(failedStage >= 0 ? failedStage : currentStage);
                        }}
                        type="button"
                      >
                        Retry stage save
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                  <button
                    className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setCloseOpen(false)}
                    type="button"
                  >
                    Return to Stage {currentStage + 1}
                  </button>
                  <button
                    className="min-h-11 rounded-lg bg-[#16202c] px-5 font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
                    disabled={closing || !closeOutcome || (closeOutcome === "do_not_call" && !drafts[5].words.trim())}
                    onClick={() => void saveAndClose()}
                    type="button"
                  >
                    {closing ? "Saving call…" : "Save and end call"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
                  <p className="text-sm font-semibold text-[#2a5bd7]">
                    Stage {currentStage + 1} of {stages.length}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl" id="stage-heading">
                    {stages[currentStage].title}
                  </h1>
                  <p className="mt-2 max-w-2xl leading-7 text-slate-600">
                    {stages[currentStage].guidance}
                  </p>
                </div>
                <div className="space-y-7 px-5 py-6 sm:px-8 sm:py-7">
                  <section aria-labelledby="talking-points-heading">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-sm font-semibold" id="talking-points-heading">
                        Guidance · listen for
                      </h2>
                      <span className="text-xs text-slate-500">Illustrative prompts, not transcript quotes</span>
                    </div>
                    <ul className="mt-3 grid gap-2 md:grid-cols-3">
                      {stages[currentStage].prompts.map((prompt) => (
                        <li className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700" key={prompt}>
                          {prompt}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <fieldset>
                    <legend className="text-sm font-semibold">What happened?</legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {stages[currentStage].outcomes.map(([key, label]) => {
                        const selected = currentDraft.outcome === key;
                        const restricted = key === "asked_not_to_call";
                        return (
                          <button
                            aria-pressed={selected}
                            className={`min-h-11 rounded-lg border px-3.5 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7] ${
                              restricted
                                ? selected
                                  ? "border-red-700 bg-red-700 text-white"
                                  : "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                                : selected
                                  ? "border-[#2a5bd7] bg-blue-50 text-blue-900 ring-1 ring-[#2a5bd7]"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                            key={key}
                            onClick={() => selectStageOutcome(currentStage, key)}
                            type="button"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid gap-5">
                    <div>
                      <label className="block text-sm font-semibold" htmlFor="prospect-words">
                        {currentStage === 4 ? "What they said they need, in their words" : "Their words"}
                      </label>
                      <textarea
                        className="mt-2 min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 font-serif text-base leading-7 text-slate-800 placeholder:font-sans placeholder:text-sm placeholder:text-slate-400 focus:border-[#2a5bd7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                        id="prospect-words"
                        maxLength={4000}
                        onBlur={() => void persistStage(currentStage)}
                        onChange={(event) => setStageDraft(currentStage, { words: event.target.value })}
                        placeholder="Record only what the prospect actually said."
                        value={currentDraft.words}
                      />
                      {currentStage === 4 && !currentDraft.words.trim() && (
                        <p className="mt-2 text-sm text-amber-800">
                          Exact words are not captured yet. You can continue without them.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold" htmlFor="caller-notes">
                        Your note <span className="font-normal text-slate-500">· caller interpretation or context</span>
                      </label>
                      <textarea
                        className="mt-2 min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 placeholder:text-slate-400 focus:border-[#2a5bd7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                        id="caller-notes"
                        maxLength={4000}
                        onBlur={() => void persistStage(currentStage)}
                        onChange={(event) => setStageDraft(currentStage, { notes: event.target.value })}
                        placeholder="Keep your note separate from the prospect's words."
                        value={currentDraft.notes}
                      />
                    </div>
                    <div aria-live="polite" className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>
                        {saveStatuses[currentStage] === "saving"
                          ? "Saving…"
                          : saveStatuses[currentStage] === "saved"
                            ? "Saved"
                            : saveStatuses[currentStage] === "error"
                              ? "Not saved"
                              : saveStatuses[currentStage] === "pending"
                                ? "Changes not saved yet"
                                : "No unsaved changes"}
                      </span>
                      {saveStatuses[currentStage] === "error" && (
                        <button
                          className="font-semibold text-red-800 underline"
                          onClick={() => void persistStage(currentStage)}
                          type="button"
                        >
                          Retry
                        </button>
                      )}
                      {saveError && <span className="text-red-800">{saveError}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:text-slate-300"
                      disabled={currentStage === 0}
                      onClick={() => void goToStage(currentStage - 1)}
                      type="button"
                    >
                      Back
                    </button>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      <button
                        className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
                        onClick={openClosePanel}
                        type="button"
                      >
                        End call
                      </button>
                      {currentStage < stages.length - 1 && (
                        <button
                          className="min-h-11 rounded-lg bg-[#2a5bd7] px-5 text-sm font-semibold text-white hover:bg-blue-800"
                          onClick={() => void goToStage(currentStage + 1)}
                          type="button"
                        >
                          Next: {stages[currentStage + 1].title}
                        </button>
                      )}
                      {currentStage === stages.length - 1 && (
                        <button
                          className="min-h-11 rounded-lg bg-[#2a5bd7] px-5 text-sm font-semibold text-white hover:bg-blue-800"
                          onClick={openClosePanel}
                          type="button"
                        >
                          Review and finish
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
