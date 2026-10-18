"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import examplesData from "@/data/examples.json";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);
const activeCallStorageKey = "callframe.activeCallId";

const transcriptExamples = examplesData.examples;

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
      ["wrong_or_left", "Wrong number or left the company"],
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
      ["asked_number_source", "Asked where we got the number"],
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
      ["yes_now", "Agreed to talk now"],
      ["asked_callback", "Asked for a callback"],
      ["send_first", "Wants it sent first"],
      ["no_clear_answer", "Did not answer clearly"],
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
      ["one_line_waiting", "One line, then waited"],
      ["corrected_us", "Corrected what we assumed"],
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
      ["asked_what_we_offer", "Asked what we can do for them"],
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
      ["has_provider", "Already has a team or consultant"],
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
      ["closed_with_agreement", "Closed with something agreed"],
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
  call_id: string;
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

function Workspace() {
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
  const [serverReady, setServerReady] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });
  const [showTips, setShowTips] = useState(() => {
    if (typeof window !== "undefined") {
      return !window.localStorage.getItem("callframe.tipsDismissed");
    }
    return true;
  });
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [aiAssistType, setAiAssistType] = useState<"suggest" | "objection" | "summary">("suggest");
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAssistError, setAiAssistError] = useState("");
  const [aiAssistResult, setAiAssistResult] = useState("");
  const [aiObjectionText, setAiObjectionText] = useState("");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const debounceTimer = useRef<number | null>(null);
  const warmupTimer = useRef<number | null>(null);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (serverReady) return;
    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiUrl}/health`, { method: "GET" });
        if (response.ok) {
          const data = await response.json();
          if (data.db === "up") {
            setServerReady(true);
            if (warmupTimer.current) window.clearInterval(warmupTimer.current);
          }
        }
      } catch {
      }
    };
    checkHealth();
    warmupTimer.current = window.setInterval(checkHealth, 3000);
    return () => {
      if (warmupTimer.current) window.clearInterval(warmupTimer.current);
    };
  }, [serverReady]);

  const dismissTips = () => {
    window.localStorage.setItem("callframe.tipsDismissed", "true");
    setShowTips(false);
  };

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
    if (!serverReady) {
      setStartError("Server is still warming up. Please wait a moment and try again.");
      return;
    }
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

  const requestAiAssist = async (type: "suggest" | "objection" | "summary", extra?: { stage?: number; objectionText?: string }) => {
    if (!call) return;
    setAiAssistLoading(true);
    setAiAssistError("");
    setAiAssistResult("");
    try {
      const response = await apiRequest<{ suggestion: string; model: string; type: string; blocked?: boolean }>(
        `/api/calls/${encodeURIComponent(call.id)}/assist`,
        {
          method: "POST",
          body: JSON.stringify({ type, ...extra }),
        },
      );
      if (response.blocked) {
        setAiAssistResult("AI assistance is blocked because the prospect asked not to be called again.");
      } else {
        setAiAssistResult(response.suggestion);
      }
    } catch (error) {
      setAiAssistError(
        error instanceof Error
          ? error.message
          : "AI assistance failed. Please try again.",
      );
    } finally {
      setAiAssistLoading(false);
    }
  };

  const openAiSuggest = () => {
    setAiAssistType("suggest");
    setAiAssistOpen(true);
    setAiAssistResult("");
    setAiAssistError("");
    void requestAiAssist("suggest", { stage: currentStage + 1 });
  };

  const openAiObjection = () => {
    setAiAssistType("objection");
    setAiAssistOpen(true);
    setAiAssistResult("");
    setAiAssistError("");
    setAiObjectionText(drafts[5]?.words || "");
  };

  const requestAiObjection = () => {
    if (!aiObjectionText.trim()) {
      setAiAssistError("Enter the objection or concern first.");
      return;
    }
    void requestAiAssist("objection", { objectionText: aiObjectionText });
  };

  const openAiSummary = () => {
    setAiAssistType("summary");
    setAiAssistOpen(true);
    setAiAssistResult("");
    setAiAssistError("");
    void requestAiAssist("summary");
  };

  const closeAiAssist = () => {
    setAiAssistOpen(false);
    setAiAssistResult("");
    setAiAssistError("");
    setAiObjectionText("");
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
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="card p-8 max-w-lg w-full text-center">
          <h1 className="heading-3 text-espresso-100 mb-3">Could not restore the call</h1>
          <p className="body text-espresso-500 mb-6" role="alert">{loadError}</p>
          <button className="btn btn--primary" onClick={retryLoad} type="button">
            Retry loading
          </button>
        </div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="card p-8 md:p-12 max-w-xl w-full">
          <Link href="/" className="logo flex items-center gap-3 mb-6 inline-block" aria-label="Callframe Home">
            <span className="logo-mark" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </span>
            <span>Callframe</span>
          </Link>
          <h1 className="heading-2 text-espresso-100 mb-3">Start a call</h1>
          <p className="body-lg text-espresso-500 mb-8">Keep the conversation clear, record what was actually said, and capture an honest next step.</p>
          {loading && (
            <p className="mb-6 p-3 rounded-lg bg-ochre-50 text-sm text-ochre-800" role="status">
              Restoring a saved call or waiting for the service…
            </p>
          )}
          {!serverReady && (
            <div className="mb-6 rounded-lg bg-ochre-50 border border-ochre-200 p-4" role="status">
              <p className="font-semibold text-ochre-800">Warming up the server…</p>
              <p className="mt-1 text-sm text-ochre-700">
                The API is starting (cold start on free tier). This may take up to a minute.
                We&apos;ll retry automatically.
              </p>
              <div className="mt-2 h-2 w-full bg-ochre-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-ochre-500 ${reduceMotion ? "" : "animate-pulse"}`}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}
          <form className="space-y-5" onSubmit={startCall}>
            <div>
              <label className="label" htmlFor="prospect-name">Prospect name</label>
              <input
                autoComplete="name"
                className="input"
                id="prospect-name"
                maxLength={4000}
                onChange={(event) => setProspectName(event.target.value)}
                required
                value={prospectName}
              />
            </div>
            <div>
              <label className="label" htmlFor="company">Company</label>
              <input
                autoComplete="organization"
                className="input"
                id="company"
                maxLength={4000}
                onChange={(event) => setCompany(event.target.value)}
                required
                value={company}
              />
            </div>
            <div>
              <label className="label" htmlFor="prospect-role">
                Role <span className="font-normal text-espresso-500">· optional</span>
              </label>
              <input
                className="input"
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
              className="btn btn--primary btn--lg w-full"
              disabled={loading || !serverReady}
              type="submit"
            >
              {loading ? "Starting…" : !serverReady ? "Warming up server…" : "Start call"}
            </button>
          </form>
          <p className="mt-4 caption text-espresso-500">
            Call details are sent to the backend for saving. If saving fails, the form stays filled so you can retry.
          </p>
        </div>
      </div>
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
      <div className="min-h-[calc(100vh-8rem)] px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="card p-8">
            <Link href="/" className="logo flex items-center gap-3 mb-6 inline-block" aria-label="Callframe Home">
              <span className="logo-mark" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </span>
              <span>Callframe</span>
            </Link>
            <h1 className="heading-2 text-espresso-100 mb-2">
              {call.status === "completed" ? "Call completed" : "Call ended early"}
            </h1>
            <p className="body text-espresso-500 mb-8">
              Stage {call.last_stage}: {stages[call.last_stage - 1].title}
            </p>
            <dl className="grid gap-4 md:grid-cols-2 mb-8 p-6 rounded-xl bg-cream-100">
              <div>
                <dt className="caption text-espresso-500 mb-1">Prospect</dt>
                <dd className="font-medium text-espresso-100">{call.prospect_name}</dd>
              </div>
              <div>
                <dt className="caption text-espresso-500 mb-1">Company</dt>
                <dd className="font-medium text-espresso-100">{call.company}</dd>
              </div>
              <div>
                <dt className="caption text-espresso-500 mb-1">Outcome</dt>
                <dd className={`font-medium ${call.do_not_call ? "text-red-700" : "text-espresso-100"}`}>
                  {finalOutcome?.label ?? "Not recorded"}
                  {call.do_not_call && <span className="ml-2 badge badge--restricted">Restricted</span>}
                </dd>
              </div>
              <div>
                <dt className="caption text-espresso-500 mb-1">Next step</dt>
                <dd className="font-medium text-espresso-100">{nextStepText || "None recorded"}</dd>
              </div>
            </dl>
            <section className="mb-8">
              <h2 className="caption text-espresso-500 mb-2">Stage 5 · Their exact words</h2>
              <p className="min-h-[6rem] whitespace-pre-wrap rounded-lg border border-espresso-200 bg-white p-4 font-display leading-7 text-espresso-100">
                {drafts[4].words || "No words recorded."}
              </p>
            </section>
            <p className="mb-6 text-sm text-green-700" role="status">Call saved successfully.</p>
            <button className="btn btn--primary w-full sm:w-auto" onClick={startAnotherCall} type="button">
              Start another call
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-cream-50">
      <header className="border-b border-espresso-200 bg-white sticky top-16 z-40">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-3 md:py-4">
          <div>
            <Link href="/" className="logo flex items-center gap-2" aria-label="Callframe Home">
              <span className="logo-mark" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </span>
              <span className="font-semibold">Callframe</span>
            </Link>
            <p className="mt-1 text-sm text-espresso-500">
              {call.prospect_name} · {call.company}
              {call.prospect_role ? ` · ${call.prospect_role}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {call.do_not_call && (
              <span className="badge badge--restricted">⚠ Do not call</span>
            )}
            <span className="rounded-lg bg-espresso-100 px-3 py-2 font-mono text-sm tabular-nums text-espresso-100">
              {formatDuration(call.started_at, now)}
            </span>
          </div>
        </div>
      </header>

      {showTips && (
        <div className="container px-4 py-3 border-b border-espresso-200 bg-ochre-50 animate-slide-down">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ochre-600 flex-shrink-0">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <span className="text-sm font-medium text-espresso-100">Tip: Tap an outcome, add notes, then click Next. Use &ldquo;Their words&rdquo; for verbatim quotes.</span>
            </div>
            <button
              onClick={dismissTips}
              className="btn btn--ghost btn--sm text-espresso-500 hover:text-espresso-100"
              type="button"
              aria-label="Dismiss tips"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="container px-4 py-6 md:py-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav
            aria-label="Call stages"
            className="card p-4 sticky top-24 self-start h-fit"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="heading-4 text-espresso-100">Call stages</h2>
              <span className="caption text-espresso-500">
                {currentStage + 1} of {stages.length}
              </span>
            </div>
            <ol className="space-y-2" role="list" aria-label="Stage progress">
              {stages.map((stage, index) => {
                const current = index === currentStage;
                const visited = index < call.last_stage;
                const completed = visited && !current;
                return (
                  <li key={stage.title}>
                    <button
                      aria-current={current ? "step" : undefined}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                        current
                          ? "bg-ochre-50 border-2 border-ochre-400"
                          : completed
                          ? "bg-neutral-50 border border-neutral-200"
                          : "border border-transparent hover:bg-espresso-50"
                      }`}
                      disabled={!visited && index !== call.last_stage}
                      onClick={() => void goToStage(index)}
                      type="button"
                    >
                      <span
                        className={`stage-indicator flex-shrink-0 ${
                          current ? "stage-indicator--active" : completed ? "stage-indicator--completed" : ""
                        }`}
                        aria-hidden="true"
                      >
                        {completed ? "" : index + 1}
                      </span>
                      <span className={`font-medium truncate ${current ? "text-espresso-100" : completed ? "text-espresso-500" : "text-espresso-400"}`}>
                        {stage.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

{mainContent}
              </section>
        </div>
      </div>
    </div>

    {aiAssistOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
        onClick={closeAiAssist}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-assist-title"
      >
        <div
          className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-espresso-200">
            <h2 id="ai-assist-title" className="heading-4 text-espresso-100">
              {aiAssistType === "suggest"
                ? "Suggest what to say"
                : aiAssistType === "objection"
                ? "Objection assistance"
                : "Call summary"}
            </h2>
            <button
              className="btn btn--ghost btn--sm text-espresso-500 hover:text-espresso-100"
              onClick={closeAiAssist}
              type="button"
              aria-label="Close AI assistant"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {aiAssistType === "objection" && (
              <div className="space-y-4">
                <p className="body-sm text-espresso-500">
                  Enter the prospect's objection or concern, then click "Get assistance" for a respectful response and a clarifying question.
                </p>
                <div>
                  <label className="label" htmlFor="ai-objection-text">Objection / concern</label>
                  <textarea
                    id="ai-objection-text"
                    className="textarea min-h-[8rem]"
                    maxLength={4000}
                    placeholder="e.g., \"We already have a consulting firm\" or \"Not interested right now\""
                    value={aiObjectionText}
                    onChange={(e) => setAiObjectionText(e.target.value)}
                  />
                </div>
                {aiAssistError && (
                  <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg" role="alert">{aiAssistError}</p>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    className="btn btn--primary flex-1"
                    onClick={requestAiObjection}
                    disabled={aiAssistLoading || !aiObjectionText.trim()}
                    type="button"
                  >
                    {aiAssistLoading ? "Getting assistance…" : "Get assistance"}
                  </button>
                  <button
                    className="btn btn--secondary"
                    onClick={closeAiAssist}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {aiAssistType === "summary" && aiAssistLoading && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-ochre-500 border-t-transparent" aria-hidden="true" />
                <p className="text-espresso-500">Generating call summary…</p>
              </div>
            )}

            {(aiAssistType === "suggest" || aiAssistType === "objection" || aiAssistType === "summary") && aiAssistResult && !aiAssistLoading && (
              <div className="space-y-4">
                <div className="rounded-lg bg-ochre-50 border border-ochre-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ochre-600" aria-hidden="true">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"></path>
                      <path d="M12 6v6l4 2"></path>
                    </svg>
                    <span className="caption text-ochre-700 font-semibold">AI suggestion</span>
                    <span className="ml-auto badge badge--partial text-xs">Gemini: {aiAssistType}</span>
                  </div>
                  <p className="body text-espresso-100 whitespace-pre-wrap font-display">{aiAssistResult}</p>
                </div>
                <p className="caption text-espresso-500">
                  This is an AI-generated suggestion. Review before using. It does not replace your judgment.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    className="btn btn--primary flex-1"
                    onClick={closeAiAssist}
                    type="button"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {(aiAssistType === "suggest" || aiAssistType === "summary") && !aiAssistResult && !aiAssistLoading && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-ochre-500 border-t-transparent" aria-hidden="true" />
                <p className="text-espresso-500">
                  {aiAssistType === "suggest" ? "Generating suggestion…" : "Generating call summary…"}
                </p>
              </div>
            )}

            {aiAssistError && !aiAssistLoading && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800" role="alert">{aiAssistError}</p>
                <div className="flex gap-3 mt-3">
                  <button
                    className="btn btn--primary flex-1"
                    onClick={() => {
                      if (aiAssistType === "suggest") void requestAiAssist("suggest", { stage: currentStage + 1 });
                      else if (aiAssistType === "summary") void requestAiAssist("summary");
                    }}
                    type="button"
                  >
                    Retry
                  </button>
                  <button
                    className="btn btn--secondary flex-1"
                    onClick={closeAiAssist}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  );
}

export default Workspace;