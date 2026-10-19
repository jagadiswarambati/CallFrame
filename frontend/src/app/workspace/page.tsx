"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import examplesData from "@/data/examples.json";
import { ApiError, apiFetch, apiUrl } from "@/lib/api";
import { finalOutcomes, stages, type OutcomeKey } from "@/lib/stages";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const activeCallStorageKey = "callframe.activeCallId";

const transcriptExamples = examplesData.examples;

const DNC_STAGE6_MESSAGE =
  'Do not call can only be recorded from Stage 6. Go to Stage 6, tap \u201cAsked not to be called again\u201d, and write down their exact words.';

const apiRequest = apiFetch;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StageDraft = { outcome: string | null; words: string; notes: string };
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

const emptyDraft = (): StageDraft => ({ outcome: null, words: "", notes: "" });
const emptyNextStep = (): NextStep => ({ type: "", channel: "", when: "", detail: "" });

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function suggestedOutcome(drafts: StageDraft[]) {
  const key = (s: number) => drafts[s - 1]?.outcome;
  if (drafts.some((d) => d.outcome === "asked_not_to_call"))
    return { outcome: "do_not_call" as OutcomeKey, reason: "A do-not-call request was recorded." };
  if (key(7) === "meeting_agreed" || key(7) === "time_named")
    return { outcome: "next_step_set" as OutcomeKey, reason: "A time or meeting was recorded at Stage 7." };
  if (key(7) === "doc_agreed")
    return { outcome: "document_requested" as OutcomeKey, reason: "A document was recorded at Stage 7." };
  if (key(7) === "referred")
    return { outcome: "referred" as OutcomeKey, reason: "A referral was recorded at Stage 7." };
  if (key(3) === "asked_callback")
    return { outcome: "callback_requested" as OutcomeKey, reason: "A callback was recorded at Stage 3." };
  if (key(3) === "send_first" || key(6) === "wants_writing")
    return { outcome: "document_requested" as OutcomeKey, reason: "A request for information was recorded." };
  if (key(3) === "declined_to_talk" || ["declined", "not_relevant", "has_provider"].includes(key(6) ?? ""))
    return { outcome: "declined" as OutcomeKey, reason: "A refusal was recorded." };
  if (key(6) === "not_right_person")
    return { outcome: "declined" as OutcomeKey, reason: "No referral was recorded at Stage 7." };
  if (key(1) === "wrong_or_left")
    return { outcome: "wrong_contact" as OutcomeKey, reason: "A wrong contact was recorded at Stage 1." };
  if (["line_or_language", "not_available"].includes(key(1) ?? ""))
    return { outcome: "no_contact" as OutcomeKey, reason: "A contact or availability issue was recorded at Stage 1." };
  return null;
}

function formatDuration(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace component
// ─────────────────────────────────────────────────────────────────────────────

function Workspace() {
  const router = useRouter();

  // Form state
  const [prospectName, setProspectName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  // Call state
  const [call, setCall] = useState<CallRecord | null>(null);
  const callRef = useRef<CallRecord | null>(null);

  // Stage drafts — kept in both ref (for async closures) and state (for render)
  const [drafts, setDrafts] = useState<StageDraft[]>(() => stages.map(emptyDraft));
  const draftsRef = useRef<StageDraft[]>(drafts);
  const needsSave = useRef<boolean[]>(stages.map(() => false));
  const [currentStage, setCurrentStage] = useState(0);
  const [saveStatuses, setSaveStatuses] = useState<SaveStatus[]>(() => stages.map(() => "idle"));

  // Status/error flags
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState("");
  const [startDncCallId, setStartDncCallId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");

  // Close/end-call panel
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeOutcome, setCloseOutcome] = useState<OutcomeKey | "">("");
  const [nextStep, setNextStep] = useState<NextStep>(emptyNextStep());
  const [closeError, setCloseError] = useState("");
  const [closing, setClosing] = useState(false);

  // Timer
  const [now, setNow] = useState(0);

  // Server readiness
  const [serverReady, setServerReady] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const [showTips, setShowTips] = useState(() =>
    typeof window !== "undefined"
      ? !window.localStorage.getItem("callframe.tipsDismissed")
      : true,
  );

  // AI feature
  const [aiLoadingStage, setAiLoadingStage] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<{ stage: number; text: string; model: string } | null>(null);
  const [aiError, setAiError] = useState<{ stage: number; message: string } | null>(null);
  const [aiBlockedCallId, setAiBlockedCallId] = useState<string | null>(null);

  // Save queue — serialises stage PUT requests
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const debounceTimer = useRef<number | null>(null);
  const warmupTimer = useRef<number | null>(null);
  // Prevents double-submit on Start a Call (belt-and-suspenders on top of the
  // disabled={loading} prop — guards against rapid form submission events).
  const startingRef = useRef(false);

  // ── Setters ──────────────────────────────────────────────────────────────

  const setActiveCall = useCallback((next: CallRecord | null) => {
    callRef.current = next;
    setCall(next);
  }, []);

  // ── Load an existing call from the API ───────────────────────────────────
  //
  // BUG FIX #1: when loadCall receives a call that is NOT in_progress (i.e.
  // completed / ended_early), we must:
  //   a) Remove the stale localStorage key so future visits show the start form.
  //   b) NOT restore that call into workspace state — the user should see the
  //      start-call form, not the finished call's workspace.
  //
  // Completed / ended-early calls are accessible through History; the workspace
  // is only for calls that are actively in progress.

  const loadCall = useCallback(
    async (id: string) => {
      setLoading(true);
      setLoadError("");
      try {
        const result = await apiRequest<{ call: CallRecord; stage_results: StageResult[] }>(
          `/api/calls/${encodeURIComponent(id)}`,
        );

        // BUG FIX #1a — completed or ended-early call in localStorage.
        // Clear the stale key and leave call === null so the start form appears.
        if (result.call.status !== "in_progress") {
          try { window.localStorage.removeItem(activeCallStorageKey); } catch { /* storage blocked */ }
          // Do NOT call setActiveCall — leave the user on the start-call form.
          return;
        }

        const restored = stages.map(() => emptyDraft());
        const statuses = stages.map(() => "idle" as SaveStatus);
        const loadedStages = new Set<number>();

        for (const sr of result.stage_results) {
          const index = sr.stage - 1;
          if (index < 0 || index >= stages.length || loadedStages.has(index)) continue;
          loadedStages.add(index);
          restored[index] = { outcome: sr.outcome_key, words: sr.prospect_words, notes: sr.notes };
          statuses[index] = "saved";
        }

        draftsRef.current = restored;
        needsSave.current = stages.map(() => false);
        setDrafts(restored);
        setSaveStatuses(statuses);
        setActiveCall(result.call);
        setCurrentStage(Math.max(0, Math.min(7, result.call.last_stage - 1)));
      } catch (error) {
        // BUG FIX #1b — 404 or network error: clear the stale key so the user
        // can start a new call instead of being stuck on a "Retry loading" screen.
        if (error instanceof ApiError && error.status === 404) {
          try { window.localStorage.removeItem(activeCallStorageKey); } catch { /* storage blocked */ }
          // Silent clear — just show the start form.
          return;
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : "The call could not be restored. Use the form below to start a new call.",
        );
      } finally {
        setLoading(false);
      }
    },
    [setActiveCall],
  );

  // ── On mount: restore an in-progress call (if any) ───────────────────────

  useEffect(() => {
    const id = window.localStorage.getItem(activeCallStorageKey);
    if (!id) return;
    const timer = window.setTimeout(() => void loadCall(id), 0);
    return () => window.clearTimeout(timer);
  }, [loadCall]);

  // ── Timer for active call ─────────────────────────────────────────────────

  useEffect(() => {
    if (!call || call.status !== "in_progress") return;
    // Update immediately then on each second tick.
    // setNow is called inside the tick function (not at effect body level)
    // to satisfy react-hooks/set-state-in-effect.
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [call]);

  // ── Reduced-motion detection ──────────────────────────────────────────────

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Server warm-up polling ────────────────────────────────────────────────

  useEffect(() => {
    if (serverReady) return;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiUrl}/health`);
        if (res.ok) {
          const data = await res.json();
          if (data.db === "up") {
            setServerReady(true);
            if (warmupTimer.current) window.clearInterval(warmupTimer.current);
          }
        }
      } catch { /* keep polling */ }
    };
    checkHealth();
    warmupTimer.current = window.setInterval(checkHealth, 3000);
    return () => { if (warmupTimer.current) window.clearInterval(warmupTimer.current); };
  }, [serverReady]);

  const dismissTips = () => {
    window.localStorage.setItem("callframe.tipsDismissed", "true");
    setShowTips(false);
  };

  // ── Draft management ──────────────────────────────────────────────────────

  const setStageDraft = (index: number, patch: Partial<StageDraft>) => {
    const next = draftsRef.current.map((d, i) => i === index ? { ...d, ...patch } : d);
    draftsRef.current = next;
    needsSave.current[index] = true;
    setDrafts(next);
    setSaveStatuses((prev) => prev.map((s, i) => i === index ? "pending" : s));
    setSaveError("");
  };

  // ── persistStage — PUT one stage to the API ───────────────────────────────
  //
  // Returns true on success, false on error. Never throws.
  // Chains on saveQueue so concurrent calls are serialised.

  const persistStage = useCallback((index: number): Promise<boolean> => {
    const callId = callRef.current?.id;
    if (!callId || callRef.current?.status !== "in_progress") return Promise.resolve(false);

    const operation = saveQueue.current.then(async () => {
      const draft = draftsRef.current[index];
      const snapshot = { ...draft };

      setSaveStatuses((prev) => prev.map((s, i) => i === index ? "saving" : s));

      try {
        await apiRequest(`/api/calls/${encodeURIComponent(callId)}/stages/${index + 1}`, {
          method: "PUT",
          body: JSON.stringify({
            outcome_key: draft.outcome,
            prospect_words: draft.words,
            notes: draft.notes,
          }),
        });

        const latest = draftsRef.current[index];
        const unchanged =
          latest.outcome === snapshot.outcome &&
          latest.words === snapshot.words &&
          latest.notes === snapshot.notes;
        if (unchanged) needsSave.current[index] = false;

        setSaveStatuses((prev) => prev.map((s, i) => i === index ? (unchanged ? "saved" : "pending") : s));
        setSaveError("");
        return true;
      } catch (error) {
        setSaveStatuses((prev) => prev.map((s, i) => i === index ? "error" : s));
        const msg = error instanceof Error ? error.message : "Stage not saved.";
        setSaveError(msg);
        return false;
      }
    });

    saveQueue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, []);

  // ── Debounced auto-save ───────────────────────────────────────────────────

  useEffect(() => {
    if (!call || call.status !== "in_progress" || closeOpen) return;
    if (!needsSave.current[currentStage]) return;
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => { void persistStage(currentStage); }, 700);
    return () => { if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current); };
  }, [call, closeOpen, currentStage, drafts, persistStage]);

  // ── Start a new call ──────────────────────────────────────────────────────

  const startCall = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serverReady) {
      setStartError("Server is still warming up. Please wait a moment.");
      return;
    }
    // Double-submit guard — the disabled prop covers normal clicks, but rapid
    // keyboard submissions (Enter key) can fire before the state re-renders.
    if (startingRef.current) return;
    startingRef.current = true;
    setStartError("");
    setStartDncCallId(null);
    setLoading(true);
    try {
      // Clear any stale in-progress call so the mount effect cannot restore it
      // in the same session if the user navigates away and comes back.
      try { window.localStorage.removeItem(activeCallStorageKey); } catch { /* storage blocked */ }
      const result = await apiRequest<{ call: CallRecord }>("/api/calls", {
        method: "POST",
        body: JSON.stringify({ prospect_name: prospectName, company, prospect_role: role }),
      });
      window.localStorage.setItem(activeCallStorageKey, result.call.id);
      const fresh = stages.map(emptyDraft);
      draftsRef.current = fresh;
      needsSave.current = stages.map(() => false);
      setDrafts(fresh);
      setSaveStatuses(stages.map(() => "idle"));
      setCurrentStage(0);
      // The POST /api/calls response only returns a subset of CallRecord fields;
      // fill in safe null defaults for any that the server did not return.
      const newCall: CallRecord = Object.assign(
        {
          outcome: null,
          next_step_type: null,
          next_step_channel: null,
          next_step_when: null,
          next_step_detail: null,
          ended_at: null,
          dnc_words: null,
          prospect_role: null,
        } satisfies Partial<CallRecord>,
        result.call,
      ) as CallRecord;
      setActiveCall(newCall);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.code === "DNC_RESTRICTED") {
        setStartError(error.message);
        setStartDncCallId(error.details.find((d) => d.field === "call_id")?.message ?? null);
      } else {
        setStartError(
          error instanceof Error
            ? error.message
            : "The call could not be started. Your details remain in the form; retry when ready.",
        );
      }
    } finally {
      setLoading(false);
      startingRef.current = false;
    }
  };

  // ── Navigate between stages ───────────────────────────────────────────────

  const goToStage = async (index: number) => {
    if (!call || index < 0 || index > 7) return;
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    const saved = await persistStage(currentStage);
    if (!saved) return;
    if (index > call.last_stage - 1) {
      try {
        const result = await apiRequest<{ call: CallRecord }>(
          `/api/calls/${encodeURIComponent(call.id)}/progress`,
          { method: "PATCH", body: JSON.stringify({ stage: index + 1 }) },
        );
        setActiveCall({ ...call, ...result.call });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Progress was not saved. Retry before continuing.");
        return;
      }
    }
    setCurrentStage(index);
    setCloseOpen(false);
  };

  // ── Outcome button selection ───────────────────────────────────────────────

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

  // ── Save and close ─────────────────────────────────────────────────────────
  //
  // BUG FIX #2: the original code could get stuck in "Saving call…" forever
  // when a stage PUT fetch hung (no TCP response, no timeout). Fix:
  //   - api.ts now adds AbortSignal.timeout(12_000) to all mutating requests.
  //   - If closing itself times out or errors, setClosing(false) in finally
  //     re-enables the button immediately with a clear error message.
  //
  // BUG FIX #1 (persistence): localStorage is removed ONLY after the server
  // confirms the call is closed, so no data is lost on a failed close.

  const saveAndClose = async () => {
    if (!call || !closeOutcome) {
      setCloseError("Choose the outcome that best matches what happened.");
      return;
    }
    if (
      closeOutcome === "do_not_call" &&
      (draftsRef.current[5].outcome !== "asked_not_to_call" || !draftsRef.current[5].words.trim())
    ) {
      setCloseError(DNC_STAGE6_MESSAGE);
      return;
    }

    setClosing(true);
    setCloseError("");
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);

    // Flush any unsaved stage data before closing.
    for (let i = 0; i < draftsRef.current.length; i++) {
      const draft = draftsRef.current[i];
      const hasData = Boolean(draft.outcome || draft.words || draft.notes);
      if (hasData || needsSave.current[i]) {
        const saved = await persistStage(i);
        if (!saved) {
          setCloseError(
            "A stage could not be saved. Retry — the call is still open and your edits are here.",
          );
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
      // Server confirmed persistence. Only now clear the local draft key.
      try { window.localStorage.removeItem(activeCallStorageKey); } catch { /* storage blocked */ }
      // Update state so the "Call completed" summary is available in case
      // the router transition is delayed, then navigate to History.
      setActiveCall({ ...call, ...result.call });
      setCloseOpen(false);
      // Navigate to History after a brief tick so React can flush state before unmounting.
      setTimeout(() => { router.push("/history"); }, 50);
    } catch (error) {
      // BUG FIX #2: on timeout or network error, show a specific message and
      // re-enable the button so the user can retry (finally always runs).
      const isTimeout = error instanceof ApiError && error.code === "TIMEOUT";
      setCloseError(
        isTimeout
          ? "The request timed out. Your edits are safe — check your connection and retry."
          : error instanceof Error
          ? error.message
          : "The call was not closed. Your edits remain here; retry when the service is available.",
      );
    } finally {
      setClosing(false);
    }
  };

  // ── AI suggestion ─────────────────────────────────────────────────────────

  const suggestWhatToSay = async () => {
    if (!call || aiLoadingStage !== null) return;
    const stageIndex = currentStage;
    setAiLoadingStage(stageIndex);
    setAiError(null);
    setAiResult(null);
    try {
      await persistStage(stageIndex);
      const response = await apiRequest<{
        blocked?: boolean;
        message?: string;
        suggestion?: { text: string; model: string };
      }>(`/api/calls/${encodeURIComponent(call.id)}/assist`, {
        method: "POST",
        body: JSON.stringify({ stage: stageIndex + 1 }),
      });
      if (response.blocked) {
        setAiBlockedCallId(call.id);
      } else if (response.suggestion?.text) {
        setAiResult({ stage: stageIndex, text: response.suggestion.text, model: response.suggestion.model });
      } else {
        throw new Error("The AI suggestion was empty. Try again.");
      }
    } catch (error) {
      setAiError({
        stage: stageIndex,
        message:
          error instanceof ApiError && error.message
            ? error.message
            : "The AI suggestion is unavailable right now. Nothing else is affected.",
      });
    } finally {
      setAiLoadingStage(null);
    }
  };

  // ── Reset to start a new call ─────────────────────────────────────────────

  const startAnotherCall = () => {
    // Always clear the stored key so the mount effect does not re-load the
    // just-completed (or abandoned) call when the workspace is next visited.
    try { window.localStorage.removeItem(activeCallStorageKey); } catch { /* storage blocked */ }
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
    setStartDncCallId(null);
    setSaveError("");
    setLoadError("");
  };

  // ── Retry load from localStorage ─────────────────────────────────────────

  const retryLoad = () => {
    const id = window.localStorage.getItem(activeCallStorageKey);
    if (id) void loadCall(id);
    else startAnotherCall(); // key was cleared; go to the start form
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const currentDraft = drafts[currentStage];
  const hasCapturedThisStage = Boolean(
    currentDraft.outcome || currentDraft.words.trim() || currentDraft.notes.trim(),
  );
  const aiBlocked = Boolean(
    call &&
      (call.do_not_call ||
        aiBlockedCallId === call.id ||
        drafts.some((d) => d.outcome === "asked_not_to_call")),
  );
  const suggestion = suggestedOutcome(drafts);
  const dncBlocked =
    closeOutcome === "do_not_call" &&
    (drafts[5].outcome !== "asked_not_to_call" || !drafts[5].words.trim());

  // ─────────────────────────────────────────────────────────────────────────
  // Close panel
  // ─────────────────────────────────────────────────────────────────────────

  const closePanel = (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <p className="ws-eyebrow">Closing · stage reached {currentStage + 1} of 8</p>
        <h1 className="ws-panel-heading mt-1">End this call</h1>
        <p className="ws-body-muted mt-2">
          Choose what actually happened. A document, callback, or referral is a partial outcome — not a success.
        </p>
      </div>

      {suggestion && (
        <div className="ws-notice ws-notice--suggest">
          <strong>Suggested from what you recorded:</strong>{" "}
          {finalOutcomes.find((o) => o.key === suggestion.outcome)?.label}. {suggestion.reason}
        </div>
      )}

      <fieldset>
        <legend className="ws-label-heading mb-3">Final outcome</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {finalOutcomes.map((outcome) => {
            const selected = closeOutcome === outcome.key;
            const isRestricted = outcome.className === "restricted";
            return (
              <button
                key={outcome.key}
                aria-pressed={selected}
                type="button"
                onClick={() => { setCloseOutcome(outcome.key); setNextStep(emptyNextStep()); setCloseError(""); }}
                className={[
                  "ws-outcome-btn",
                  selected ? "ws-outcome-btn--selected" : "",
                  isRestricted ? "ws-outcome-btn--restricted" : "",
                ].filter(Boolean).join(" ")}
              >
                <span className="flex-1 text-left text-sm font-medium">{outcome.label}</span>
                {outcome.className === "partial" && <span className="ws-badge ws-badge--partial">Partial</span>}
                {isRestricted && <span className="ws-badge ws-badge--restricted">Restricted</span>}
              </button>
            );
          })}
        </div>
        {drafts[5].outcome !== "asked_not_to_call" && (
          <p className="mt-2 text-xs text-[var(--t-muted)]">
            Do not call requires the Stage 6 &ldquo;Asked not to be called again&rdquo; button and their exact words.
          </p>
        )}
      </fieldset>

      {/* Next-step fields */}
      {closeOutcome && ["next_step_set","document_requested","callback_requested","referred"].includes(closeOutcome) && (
        <fieldset className="ws-fieldset-box">
          <legend className="ws-label-heading mb-4">Agreed next step</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {closeOutcome === "next_step_set" && (<>
              <div>
                <label className="ws-label" htmlFor="ns-type">Type</label>
                <select id="ns-type" className="ws-input" value={nextStep.type} onChange={(e) => setNextStep({ ...nextStep, type: e.target.value })}>
                  <option value="">Choose…</option>
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
              <div>
                <label className="ws-label" htmlFor="ns-when">When</label>
                <input id="ns-when" className="ws-input" maxLength={4000} placeholder="Agreed date or time" value={nextStep.when} onChange={(e) => setNextStep({ ...nextStep, when: e.target.value })} />
              </div>
            </>)}
            {closeOutcome === "callback_requested" && (
              <div className="sm:col-span-2">
                <label className="ws-label" htmlFor="ns-callback">Callback time</label>
                <input id="ns-callback" className="ws-input" maxLength={4000} placeholder="Time they requested" value={nextStep.when} onChange={(e) => setNextStep({ ...nextStep, type: "call", when: e.target.value })} />
              </div>
            )}
            {closeOutcome === "document_requested" && (
              <div className="sm:col-span-2">
                <label className="ws-label" htmlFor="ns-channel">Send via</label>
                <input id="ns-channel" className="ws-input" maxLength={4000} placeholder="e.g. WhatsApp, email" value={nextStep.channel} onChange={(e) => setNextStep({ ...nextStep, type: "document", channel: e.target.value })} />
              </div>
            )}
            {closeOutcome === "referred" && (
              <div className="sm:col-span-2">
                <label className="ws-label" htmlFor="ns-referral">Who were you referred to?</label>
                <input id="ns-referral" className="ws-input" maxLength={4000} placeholder="Name or role" value={nextStep.detail} onChange={(e) => setNextStep({ ...nextStep, type: "referral", detail: e.target.value })} />
              </div>
            )}
          </div>
        </fieldset>
      )}

      {/* DNC details */}
      {closeOutcome === "do_not_call" && (
        <div className="ws-dnc-box">
          <p className="font-semibold text-red-800 mb-1">Restricted — no further calls</p>
          <p className="text-sm text-red-700 mb-3">
            Their exact words must be in the Stage 6 &ldquo;Their words&rdquo; field. No next step is allowed.
          </p>
          <blockquote className="ws-verbatim bg-white border border-red-200 text-red-900 mb-3">
            {drafts[5].words || <em className="text-red-400">No words recorded yet.</em>}
          </blockquote>
          {dncBlocked && (
            <p className="mb-3 text-sm font-medium text-red-800 bg-white rounded-lg p-3 border border-red-200" role="alert">
              {DNC_STAGE6_MESSAGE}
            </p>
          )}
          {dncBlocked && (
            <button type="button" className="ws-btn ws-btn--outline-danger ws-btn--sm" onClick={() => { setCloseOpen(false); void goToStage(5); }}>
              Go to Stage 6
            </button>
          )}
        </div>
      )}

      {/* Stage 5 words recap */}
      <div>
        <p className="ws-eyebrow mb-1">Stage 5 · Their need, in their words</p>
        <blockquote className="ws-verbatim">
          {drafts[4].words || <em className="text-[var(--t-muted)]">No words recorded at Stage 5.</em>}
        </blockquote>
      </div>

      {closeError && (
        <div className="ws-alert ws-alert--error" role="alert">
          <p>{closeError}</p>
          {saveError && (
            <button type="button" className="mt-2 ws-btn ws-btn--outline-danger ws-btn--sm"
              onClick={() => { const fi = saveStatuses.findIndex((s) => s === "error"); void persistStage(fi >= 0 ? fi : currentStage); }}>
              Retry stage save
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-4 border-t border-[var(--border)]">
        <button type="button" className="ws-btn ws-btn--ghost" onClick={() => setCloseOpen(false)}>
          ← Back to Stage {currentStage + 1}
        </button>
        <button
          type="button"
          className="ws-btn ws-btn--primary flex-1 sm:flex-none"
          disabled={closing || !closeOutcome || dncBlocked}
          onClick={() => void saveAndClose()}
        >
          {closing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              Saving call…
            </span>
          ) : "Save and end call"}
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Stage content
  // ─────────────────────────────────────────────────────────────────────────

  const mainContent = (
    <div>
      {/* Stage header */}
      <div className="ws-stage-header">
        <p className="ws-eyebrow">Stage {currentStage + 1} of {stages.length}</p>
        <h1 id="stage-heading" className="ws-stage-heading mt-1">{stages[currentStage].title}</h1>
        <p className="ws-body-muted mt-1 max-w-2xl">{stages[currentStage].guidance}</p>
      </div>

      <div className="ws-stage-body space-y-8">
        {/* Transcript examples */}
        <section aria-labelledby="ex-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 id="ex-heading" className="ws-section-heading">They may say</h2>
            <span className="text-xs text-[var(--t-muted)] uppercase tracking-wide">Verbatim from transcripts</span>
          </div>
          <ul className="space-y-2">
            {transcriptExamples.find((ex) => ex.stage === currentStage + 1)?.quotes.map((q) => (
              <li key={q.callId} className="ws-example-item">
                <p className="font-serif italic text-[var(--t-primary)] leading-relaxed">&ldquo;{q.text}&rdquo;</p>
                <p className="mt-1 text-xs text-[var(--t-muted)]">{q.callId} · {q.speaker} · logged: {q.datasetLogged}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Guidance prompts */}
        <section aria-labelledby="guidance-heading">
          <h2 id="guidance-heading" className="ws-section-heading mb-3">Guidance</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stages[currentStage].prompts.map((p) => (
              <li key={p} className="ws-prompt-item">{p}</li>
            ))}
          </ul>
        </section>

        {/* Outcome buttons */}
        <fieldset>
          <legend className="ws-label-heading mb-3">What happened?</legend>
          <div className="flex flex-wrap gap-2">
            {stages[currentStage].outcomes.map(([key, label]) => {
              const selected = currentDraft.outcome === key;
              const restricted = key === "asked_not_to_call";
              return (
                <button
                  key={key}
                  aria-pressed={selected}
                  type="button"
                  onClick={() => selectStageOutcome(currentStage, key)}
                  className={[
                    "ws-chip",
                    selected ? "ws-chip--selected" : "",
                    restricted ? "ws-chip--restricted" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Text fields */}
        <div className="space-y-5">
          <div>
            <label className="ws-label" htmlFor="prospect-words">
              {currentStage === 4 ? "What they said they need, in their words" : "Their words"}
            </label>
            <textarea
              id="prospect-words"
              className={`ws-textarea ws-textarea--verbatim ${currentStage === 4 ? "min-h-[8rem]" : ""}`}
              maxLength={4000}
              placeholder="Record only what the prospect actually said."
              value={currentDraft.words}
              onChange={(e) => setStageDraft(currentStage, { words: e.target.value })}
              onBlur={() => void persistStage(currentStage)}
            />
            {currentStage === 4 && !currentDraft.words.trim() && (
              <p className="mt-1.5 text-sm text-amber-700 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                Exact words not captured yet — you can continue without them.
              </p>
            )}
          </div>

          <div>
            <label className="ws-label" htmlFor="caller-notes">
              Your note <span className="font-normal text-[var(--t-muted)]">· caller interpretation or context</span>
            </label>
            <textarea
              id="caller-notes"
              className="ws-textarea ws-textarea--notes"
              maxLength={4000}
              placeholder="Keep your note separate from the prospect's words."
              value={currentDraft.notes}
              onChange={(e) => setStageDraft(currentStage, { notes: e.target.value })}
              onBlur={() => void persistStage(currentStage)}
            />
          </div>

          {/* AI suggestion section */}
          <section aria-labelledby="ai-heading" className="ws-ai-section">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 id="ai-heading" className="ws-section-heading">
                AI suggestion
                <span className="ml-2 font-normal text-xs text-[var(--t-muted)] normal-case tracking-normal">
                  · optional · Gemini · never edits your notes
                </span>
              </h2>
              <button
                type="button"
                className="ws-btn ws-btn--ghost ws-btn--sm"
                disabled={aiLoadingStage !== null || aiBlocked || !hasCapturedThisStage}
                aria-describedby="ai-desc"
                onClick={() => void suggestWhatToSay()}
              >
                {aiLoadingStage === currentStage ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Thinking…
                  </span>
                ) : "Suggest what to say"}
              </button>
            </div>
            <p id="ai-desc" className="text-xs text-[var(--t-muted)] mb-3">
              {aiBlocked
                ? "AI suggestions are off — a do-not-call request was recorded for this call."
                : !hasCapturedThisStage
                ? "Tap an outcome or add text at this stage first."
                : "Sends stage context to Gemini. Result shown below — never inserted automatically."}
            </p>
            {aiError && aiError.stage === currentStage && (
              <div className="ws-alert ws-alert--error" role="alert">
                <strong>AI error:</strong> {aiError.message}
              </div>
            )}
            {aiResult && aiResult.stage === currentStage && (
              <div className="ws-ai-result" role="status" aria-live="polite">
                <p className="ws-ai-label">AI · {aiResult.model} · not the prospect&apos;s words</p>
                <p className="text-sm text-[var(--t-primary)] whitespace-pre-wrap leading-relaxed">{aiResult.text}</p>
              </div>
            )}
          </section>

          {/* Save status */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--t-muted)]" aria-live="polite">
            <span className={saveStatuses[currentStage] === "error" ? "text-red-700 font-medium" : ""}>
              {saveStatuses[currentStage] === "saving" && "Saving…"}
              {saveStatuses[currentStage] === "saved" && "✓ Saved"}
              {saveStatuses[currentStage] === "pending" && "Unsaved changes…"}
              {saveStatuses[currentStage] === "error" && "Not saved — tap Retry"}
              {saveStatuses[currentStage] === "idle" && "No unsaved changes"}
            </span>
            {saveStatuses[currentStage] === "error" && (
              <button type="button" className="text-amber-700 underline hover:text-amber-800 font-medium"
                onClick={() => void persistStage(currentStage)}>
                Retry
              </button>
            )}
            {saveError && saveStatuses[currentStage] !== "error" && (
              <span className="text-red-700">{saveError}</span>
            )}
          </div>
        </div>

        {/* Stage navigation buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-[var(--border)]">
          <button type="button" className="ws-btn ws-btn--ghost" disabled={currentStage === 0}
            onClick={() => void goToStage(currentStage - 1)}>
            ← Back
          </button>
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <button type="button" className="ws-btn ws-btn--outline-danger"
              onClick={openClosePanel}>
              End call
            </button>
            {currentStage < stages.length - 1 && (
              <button type="button" className="ws-btn ws-btn--primary flex-1"
                onClick={() => void goToStage(currentStage + 1)}>
                Next: {stages[currentStage + 1].title} →
              </button>
            )}
            {currentStage === stages.length - 1 && (
              <button type="button" className="ws-btn ws-btn--primary flex-1"
                onClick={openClosePanel}>
                Review and finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render branches
  // ─────────────────────────────────────────────────────────────────────────

  // Load error (non-404) — key was preserved; offer retry or start fresh
  if (loadError && !call) {
    return (
      <div className="ws-center-screen">
        <div className="ws-card ws-card--centered p-8 max-w-lg w-full">
          <div className="ws-icon-circle ws-icon-circle--warn mb-4 mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          </div>
          <h1 className="ws-panel-heading text-center">Could not restore the call</h1>
          <p className="ws-body-muted text-center mt-2 mb-6" role="alert">{loadError}</p>
          <div className="flex flex-col gap-3">
            <button type="button" className="ws-btn ws-btn--primary w-full" onClick={retryLoad}>Retry loading</button>
            <button type="button" className="ws-btn ws-btn--ghost w-full" onClick={startAnotherCall}>Start a new call instead</button>
          </div>
        </div>
      </div>
    );
  }

  // Start-call form
  if (!call) {
    return (
      <div className="ws-center-screen">
        <div className="ws-card p-8 md:p-10 max-w-xl w-full">
          <h1 className="ws-panel-heading mb-1">Start a call</h1>
          <p className="ws-body-muted mb-8">
            Enter the prospect&apos;s details. The call record is created immediately when you press Start.
          </p>

          {loading && !loadError && (
            <div className="ws-notice ws-notice--info mb-6" role="status">
              <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Checking for a call in progress…
            </div>
          )}

          {!serverReady && (
            <div className="ws-notice ws-notice--warn mb-6" role="status">
              <div>
                <p className="font-semibold">Server warming up…</p>
                <p className="text-sm mt-0.5">The API is starting (cold start on free tier). This can take up to a minute — we&apos;ll retry automatically.</p>
                <div className="mt-2 h-1.5 w-full bg-amber-100 rounded-full overflow-hidden">
                  <div className={`h-full bg-amber-400 rounded-full ${reduceMotion ? "w-full" : "animate-pulse w-full"}`} />
                </div>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={startCall} noValidate>
            <div>
              <label className="ws-label" htmlFor="prospect-name">
                Prospect name <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input id="prospect-name" className="ws-input" autoComplete="name" maxLength={4000} required
                value={prospectName} onChange={(e) => setProspectName(e.target.value)} />
            </div>
            <div>
              <label className="ws-label" htmlFor="company">
                Company <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input id="company" className="ws-input" autoComplete="organization" maxLength={4000} required
                value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <label className="ws-label" htmlFor="prospect-role">
                Role <span className="font-normal text-[var(--t-muted)]">· optional</span>
              </label>
              <input id="prospect-role" className="ws-input" maxLength={4000}
                value={role} onChange={(e) => setRole(e.target.value)} />
            </div>

            {startError && (
              <div className="ws-alert ws-alert--error" role="alert">
                <p>{startError}</p>
                {startDncCallId && (
                  <p className="mt-2">
                    <Link href={`/history/${encodeURIComponent(startDncCallId)}`} className="font-medium underline">
                      View the earlier call →
                    </Link>
                  </p>
                )}
              </div>
            )}

            <button type="submit" className="ws-btn ws-btn--primary ws-btn--lg w-full"
              disabled={loading || !serverReady}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Starting…
                </span>
              ) : !serverReady ? "Server starting up…" : "Start call"}
            </button>
          </form>

          <p className="mt-5 text-xs text-[var(--t-muted)] text-center">
            Call details are saved to the database. If saving fails, the form stays filled.
          </p>

          <div className="mt-6 pt-5 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--t-muted)] text-center mb-3">Have a previous call?</p>
            <Link href="/history" className="ws-btn ws-btn--ghost w-full">
              View call history
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Completed / ended-early screen
  if (call.status !== "in_progress") {
    const finalOutcome = finalOutcomes.find((o) => o.key === call.outcome);
    const nextStepText = [call.next_step_type, call.next_step_when, call.next_step_channel, call.next_step_detail]
      .filter(Boolean).join(" · ");

    return (
      <div className="ws-center-screen py-12">
        <div className="ws-card p-8 max-w-2xl w-full">
          {/* Status */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`ws-icon-circle ${call.status === "completed" ? "ws-icon-circle--success" : "ws-icon-circle--info"}`}>
              {call.status === "completed"
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              }
            </div>
            <div>
              <h1 className="ws-panel-heading">
                {call.status === "completed" ? "Call completed" : "Call ended early"}
              </h1>
              <p className="ws-body-muted text-sm">Stage {call.last_stage}: {stages[call.last_stage - 1]?.title}</p>
            </div>
          </div>

          {/* Summary */}
          <dl className="ws-summary-grid mb-6">
            <div>
              <dt className="ws-eyebrow mb-0.5">Prospect</dt>
              <dd className="font-medium text-[var(--t-primary)]">{call.prospect_name}</dd>
            </div>
            <div>
              <dt className="ws-eyebrow mb-0.5">Company</dt>
              <dd className="font-medium text-[var(--t-primary)]">{call.company}</dd>
            </div>
            <div>
              <dt className="ws-eyebrow mb-0.5">Outcome</dt>
              <dd className={`font-medium ${call.do_not_call ? "text-red-700" : "text-[var(--t-primary)]"}`}>
                {finalOutcome?.label ?? "Not recorded"}
                {call.do_not_call && <span className="ml-2 ws-badge ws-badge--restricted">Restricted</span>}
              </dd>
            </div>
            <div>
              <dt className="ws-eyebrow mb-0.5">Next step</dt>
              <dd className="font-medium text-[var(--t-primary)]">{nextStepText || "None recorded"}</dd>
            </div>
          </dl>

          {/* Stage 5 words */}
          <div className="mb-6">
            <p className="ws-eyebrow mb-1">Stage 5 · Their exact words</p>
            <blockquote className="ws-verbatim">
              {drafts[4].words || <em className="text-[var(--t-muted)]">No words recorded.</em>}
            </blockquote>
          </div>

          {/* Persistence confirmation */}
          <div className="ws-notice ws-notice--success mb-6" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span>
              Saved to the database.{" "}
              <Link href="/history" className="font-semibold underline hover:opacity-80">View in History →</Link>
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="ws-btn ws-btn--primary" onClick={startAnotherCall}>
              Start another call
            </button>
            <Link href="/history" className="ws-btn ws-btn--ghost">
              Go to History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active call workspace ────────────────────────────────────────────────

  return (
    <div className="ws-root">
      {/* Call-specific sub-header (no logo — already in global nav) */}
      <div className="ws-call-bar">
        <div className="container flex items-center justify-between gap-4 h-full">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[var(--t-primary)] truncate">
              {call.prospect_name} · {call.company}
              {call.prospect_role ? ` · ${call.prospect_role}` : ""}
            </p>
            <p className="text-xs text-[var(--t-muted)]">Active call</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/history" className="ws-btn ws-btn--ghost ws-btn--sm hidden sm:inline-flex">History</Link>
            {call.do_not_call && (
              <span className="ws-badge ws-badge--restricted">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg>
                Do not call
              </span>
            )}
            <span className="ws-timer" aria-label={`Call duration ${formatDuration(call.started_at, now)}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {formatDuration(call.started_at, now)}
            </span>
          </div>
        </div>
      </div>

      {/* Tips banner */}
      {showTips && (
        <div className="ws-tips-bar">
          <div className="container flex items-center justify-between gap-3 py-2.5">
            <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Tap an outcome, add notes, then Next. Use &ldquo;Their words&rdquo; for verbatim quotes only.
            </p>
            <button type="button" className="text-xs text-amber-700 hover:text-amber-900 font-medium underline flex-shrink-0"
              aria-label="Dismiss tip" onClick={dismissTips}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="container ws-workspace-grid">
        {/* Sidebar */}
        <nav aria-label="Call stages" className="ws-sidebar">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--t-primary)]">Stages</h2>
            <span className="text-xs text-[var(--t-muted)]">{currentStage + 1}/{stages.length}</span>
          </div>
          <ol className="space-y-1">
            {stages.map((stage, index) => {
              const current = index === currentStage;
              const visited = index < call.last_stage;
              const done = visited && !current;
              const locked = !visited && index !== call.last_stage;
              return (
                <li key={stage.title}>
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    disabled={locked}
                    onClick={() => void goToStage(index)}
                    className={[
                      "ws-stage-btn",
                      current ? "ws-stage-btn--current" : "",
                      done ? "ws-stage-btn--done" : "",
                      locked ? "ws-stage-btn--locked" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <span className={[
                      "ws-stage-num",
                      current ? "ws-stage-num--current" : "",
                      done ? "ws-stage-num--done" : "",
                    ].filter(Boolean).join(" ")} aria-hidden="true">
                      {done ? "✓" : index + 1}
                    </span>
                    <span className="text-sm font-medium truncate">{stage.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Stage card */}
        <section className="ws-stage-card" aria-labelledby="stage-heading">
          {closeOpen ? closePanel : mainContent}
        </section>
      </div>
    </div>
  );
}

export default Workspace;
