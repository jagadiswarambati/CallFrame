'use client';

import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { finalOutcomes, stages, type OutcomeKey } from '@/lib/stages';
import {
  CallSession,
  StageDraft,
  endCallSession,
  fetchCallById,
  getActiveCallId,
  getCallDraft,
  getResumeCallId,
  saveCallDraft,
  saveStageProgress,
  setActiveCallId,
  setResumeCallId,
  startNewCall,
} from '@/lib/callframe';

export const activeCallStorageKey = 'callframe.activeCallId';

const EMPTY_DRAFT: StageDraft = { outcomeKey: null, prospectWords: '', notes: '' };
type NextStep = { type: string; channel: string; when: string; detail: string };
const EMPTY_NEXT_STEP: NextStep = { type: '', channel: '', when: '', detail: '' };

function suggestedOutcome(drafts: Record<number, StageDraft>): OutcomeKey | null {
  const key = (stage: number) => drafts[stage]?.outcomeKey;
  if (key(6) === 'asked_not_to_call') return 'do_not_call';
  if (key(7) === 'meeting_agreed' || key(7) === 'time_named') return 'next_step_set';
  if (key(7) === 'doc_agreed') return 'document_requested';
  if (key(7) === 'referred') return 'referred';
  if (key(3) === 'asked_callback') return 'callback_requested';
  if (key(3) === 'send_first' || key(6) === 'wants_writing') return 'document_requested';
  if (key(3) === 'declined_to_talk' || ['declined', 'not_relevant', 'has_provider'].includes(key(6) ?? '')) return 'declined';
  if (key(6) === 'not_right_person') return key(7) === 'referred' ? 'referred' : 'declined';
  if (key(1) === 'wrong_or_left') return 'wrong_contact';
  if (['line_or_language', 'not_available'].includes(key(1) ?? '')) return 'no_contact';
  return null;
}

function durationLabel(seconds: number) {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return hrs === '00' ? `${mins}:${secs}` : `${hrs}:${mins}:${secs}`;
}

function statusIsActive(call: CallSession) { return call.status === 'in_progress'; }

export default function WorkspacePage() {
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [drafts, setDrafts] = useState<Record<number, StageDraft>>({});
  const [prospectName, setProspectName] = useState('');
  const [company, setCompany] = useState('');
  const [prospectRole, setProspectRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [closeOutcome, setCloseOutcome] = useState<OutcomeKey | ''>('');
  const [nextStep, setNextStep] = useState<NextStep>(EMPTY_NEXT_STEP);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestionError, setShowSuggestionError] = useState('');
  const didLoadRef = useRef(false);

  const currentDraft = drafts[currentStage] ?? EMPTY_DRAFT;
  const savedCurrentDraft = activeCall?.stageData[currentStage];
  const hasUnsavedChanges = !savedCurrentDraft || savedCurrentDraft.outcomeKey !== currentDraft.outcomeKey || savedCurrentDraft.prospectWords !== currentDraft.prospectWords || savedCurrentDraft.notes !== currentDraft.notes;
  const highestStage = Math.max(currentStage, activeCall?.lastStage ?? 1);
  const activeStage = stages[currentStage - 1];
  const hasSavedDncSignal = Boolean(activeCall?.doNotCall || activeCall?.stageHistory.some((entry) => entry.outcomeKey === 'asked_not_to_call') || Object.values(drafts).some((entry) => entry.outcomeKey === 'asked_not_to_call')); 
  const durationFromServer = useCallback((call: CallSession) => {
    const start = new Date(call.startedAt).getTime();
    return Number.isFinite(start) ? Math.max(0, Math.floor((Date.now() - start) / 1000)) : call.timerSeconds;
  }, []);

  const applyCall = useCallback((serverCall: CallSession) => {
    const localDraft = getCallDraft(serverCall.id);
    const call = localDraft?.stageData
      ? { ...serverCall, stageData: { ...serverCall.stageData, ...localDraft.stageData } }
      : serverCall;
    setActiveCall(call);
    setCurrentStage(Math.min(8, Math.max(1, localDraft?.currentStage ?? call.lastStage ?? 1)));
    setDrafts(call.stageData ?? {});
    setTimerSeconds(call.timerSeconds ?? 0);
    setProspectName(call.callerName ?? '');
    setCompany(call.company ?? '');
    setProspectRole(call.callerRole ?? '');
  }, []);

  // A call is restored only on a normal refresh or by an explicit Resume action.
  // Start-call links include ?new=1 and can never silently reopen the prior session.
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const startFresh = params.get('new') === '1';
    const requestedResume = params.get('resume') || getResumeCallId();
    const id = requestedResume || (!startFresh ? getActiveCallId() : null);

    if (startFresh) {
      setActiveCallId(null);
      setResumeCallId(null);
      return;
    }
    if (!id) return;

    setIsLoading(true);
    fetchCallById(id)
      .then((call) => {
        if (!statusIsActive(call)) {
          setActiveCallId(null);
          setResumeCallId(null);
          if (requestedResume) setErrorMessage('This call is already closed and cannot be resumed. Open it from History to view its details.');
          return;
        }
        setActiveCallId(call.id);
        setResumeCallId(null);
        applyCall(call);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not load the call. Please retry.';
        setErrorMessage(message);
        // Do not clear the stored active ID on transient network errors.
      })
      .finally(() => setIsLoading(false));
  }, [applyCall]);

  useEffect(() => {
    if (!activeCall || !statusIsActive(activeCall)) return;
    const tick = () => setTimerSeconds(durationFromServer(activeCall));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [activeCall, durationFromServer]);

  const updateDraft = (patch: Partial<StageDraft>) => {
    const nextDrafts = {
      ...drafts,
      [currentStage]: { ...EMPTY_DRAFT, ...(drafts[currentStage] ?? {}), ...patch },
    };
    setDrafts(nextDrafts);
    if (activeCall) saveCallDraft(activeCall.id, { ...activeCall, currentStage, stageData: nextDrafts, timerSeconds });
  };

  const handleStartCall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    setFieldErrors({});
    try {
      const call = await startNewCall({ name: prospectName, company, role: prospectRole });
      applyCall(call);
      setCurrentStage(1);
      setDrafts({});
      setTimerSeconds(0);
      setCloseOutcome('');
      setNextStep(EMPTY_NEXT_STEP);
      setIsCloseOpen(false);
      router.replace('/workspace');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not start the call. Your form entries are preserved.');
      setFieldErrors(error && typeof error === 'object' && 'details' in error
        ? Object.fromEntries(((error as { details?: Array<{field: string; message: string}> }).details ?? []).map((detail) => [detail.field, detail.message]))
        : {});
    } finally {
      setIsLoading(false);
    }
  };

  const persistStage = async (stage: number) => {
    if (!activeCall) throw new Error('There is no active call to save.');
    const draft = drafts[stage] ?? EMPTY_DRAFT;
    const updated = await saveStageProgress(activeCall.id, {
      stage,
      outcomeKey: draft.outcomeKey,
      prospectWords: draft.prospectWords,
      notes: draft.notes,
    });
    setActiveCall(updated);
    setDrafts((previous) => ({ ...previous, [stage]: { ...draft, revision: updated.stageData[stage]?.revision, createdAt: updated.stageData[stage]?.createdAt } }));
    return updated;
  };

  const handleChooseStageOutcome = async (outcomeKey: string) => {
    if (!activeCall || isSaving || isEnding || isSuggesting || isCloseOpen) return;
    const nextDraft = { ...EMPTY_DRAFT, ...(drafts[currentStage] ?? {}), outcomeKey };
    const nextDrafts = { ...drafts, [currentStage]: nextDraft };
    setDrafts(nextDrafts);
    saveCallDraft(activeCall.id, { ...activeCall, currentStage, stageData: nextDrafts, timerSeconds });
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = await saveStageProgress(activeCall.id, {
        stage: currentStage,
        outcomeKey,
        prospectWords: nextDraft.prospectWords,
        notes: nextDraft.notes,
      });
      setActiveCall(updated);
      const savedDrafts = { ...nextDrafts, [currentStage]: { ...nextDraft, revision: updated.stageData[currentStage]?.revision, createdAt: updated.stageData[currentStage]?.createdAt } };
      setDrafts(savedDrafts);
      saveCallDraft(activeCall.id, { ...updated, currentStage, stageData: savedDrafts, timerSeconds });
      if (outcomeKey === 'asked_not_to_call') {
        if (nextDraft.prospectWords.trim()) {
          setCloseOutcome('do_not_call');
          setNextStep(EMPTY_NEXT_STEP);
          setIsCloseOpen(true);
        } else {
          setErrorMessage('The Stage 6 selection is saved. Now record the prospect’s exact words before closing with Do Not Call.');
        }
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'That outcome could not be saved. It remains in the local draft; retry before moving on.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveContinue = async () => {
    if (!activeCall || isSaving || isEnding || isSuggesting || isCloseOpen) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = await persistStage(currentStage);
      if (currentStage < 8) {
        const nextStage = currentStage + 1;
        setCurrentStage(nextStage);
        saveCallDraft(activeCall.id, { ...updated, currentStage: nextStage, stageData: { ...updated.stageData, ...drafts }, timerSeconds });
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Stage could not be saved. You have not been moved to the next stage.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectStage = async (stageNumber: number) => {
    if (!activeCall || stageNumber === currentStage || stageNumber < 1 || stageNumber > highestStage || isSaving || isEnding || isSuggesting || isCloseOpen) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = await persistStage(currentStage);
      setCurrentStage(stageNumber);
      saveCallDraft(activeCall.id, { ...updated, currentStage: stageNumber, stageData: { ...updated.stageData, ...drafts }, timerSeconds });
      setAiSuggestion('');
      setShowSuggestionError('');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Save failed. You stayed on the current stage so your changes are not silently discarded.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenClosePanel = () => {
    if (!activeCall || isSaving || isEnding || isSuggesting) return;
    setErrorMessage(null);
    const suggestion = suggestedOutcome(drafts);
    setCloseOutcome((current) => current || suggestion || '');
    if (suggestion === 'do_not_call') setNextStep(EMPTY_NEXT_STEP);
    setIsCloseOpen(true);
  };

  const chooseCloseOutcome = (outcome: OutcomeKey) => {
    setCloseOutcome(outcome);
    setFieldErrors({});
    setNextStep((previous) => {
      if (outcome === 'do_not_call' || ['declined', 'wrong_contact', 'no_contact'].includes(outcome)) return EMPTY_NEXT_STEP;
      if (outcome === 'document_requested') return { ...EMPTY_NEXT_STEP, type: 'document', channel: previous.channel };
      if (outcome === 'callback_requested') return { ...EMPTY_NEXT_STEP, type: 'call', when: previous.when };
      if (outcome === 'next_step_set') return { ...EMPTY_NEXT_STEP, type: previous.type === 'meeting' ? 'meeting' : 'call', when: previous.when };
      if (outcome === 'referred') return { ...EMPTY_NEXT_STEP, type: 'referral', detail: previous.detail };
      return previous;
    });
  };

  const handleSaveAndEnd = async () => {
    if (!activeCall || isEnding || isSaving || isSuggesting) return;
    const errors: Record<string, string> = {};
    if (!closeOutcome) errors.outcome = 'Select the outcome that matches what was actually agreed.';
    if (closeOutcome === 'next_step_set' && (!['call', 'meeting'].includes(nextStep.type) || !nextStep.when.trim())) errors['next_step.when'] = 'Enter the agreed call or meeting time.';
    if (closeOutcome === 'document_requested' && (!nextStep.channel.trim())) errors['next_step.channel'] = 'Enter the channel for sending the document.';
    if (closeOutcome === 'callback_requested' && !nextStep.when.trim()) errors['next_step.when'] = 'Enter the callback time.';
    if (closeOutcome === 'referred' && !nextStep.detail.trim()) errors['next_step.detail'] = 'Enter the name or details of the person they referred you to.';
    if (closeOutcome === 'do_not_call') {
      const dnc = drafts[6] ?? EMPTY_DRAFT;
      if (dnc.outcomeKey !== 'asked_not_to_call' || !dnc.prospectWords.trim()) {
        errors.dnc_words = 'Record the Stage 6 “asked not to be called again” button and their exact words before ending with Do Not Call.';
      }
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setErrorMessage(errors.dnc_words ? errors.dnc_words : 'Check the highlighted fields before ending the call.');
      if (errors.dnc_words) { setIsCloseOpen(false); setCurrentStage(6); }
      return;
    }

    setIsEnding(true);
    setErrorMessage(null);
    setFieldErrors({});
    try {
      // Flush every touched stage and the current stage first. A failed flush blocks closure.
      const stageNumbers = new Set<number>([currentStage]);
      for (const [key, value] of Object.entries(drafts)) {
        if (value.outcomeKey || value.prospectWords.trim() || value.notes.trim()) stageNumbers.add(Number(key));
      }
      for (const stage of [...stageNumbers].sort((a, b) => a - b)) await persistStage(stage);
      await endCallSession(activeCall.id, {
        outcome: closeOutcome as OutcomeKey,
        endedStage: currentStage,
        nextStep: {
          type: nextStep.type || undefined,
          channel: nextStep.channel || undefined,
          when: nextStep.when || undefined,
          detail: nextStep.detail || undefined,
        },
      });
      setActiveCall(null);
      setActiveCallId(null);
      setResumeCallId(null);
      setIsCloseOpen(false);
      router.push('/history');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The call could not be saved and ended. Your work is preserved; retry when ready.');
    } finally {
      setIsEnding(false);
    }
  };

  const handleExit = () => {
    if (activeCall && !window.confirm('Leave the workspace? The call will remain in progress and can be resumed from History.')) return;
    router.push('/history');
  };

  const handleSuggest = async () => {
    if (!activeCall || isSuggesting || hasSavedDncSignal) return;
    setIsSuggesting(true);
    setShowSuggestionError('');
    try {
      await persistStage(currentStage);
      const { apiFetch, ASSIST_TIMEOUT_MS } = await import('@/lib/api');
      const response = await apiFetch<{ suggestion?: string | { text?: string }; result?: { suggestion?: string | { text?: string } } }>(`/api/calls/${encodeURIComponent(activeCall.id)}/assist`, {
        method: 'POST',
        body: JSON.stringify({ stage: currentStage }),
        signal: AbortSignal.timeout(ASSIST_TIMEOUT_MS),
      });
      const suggestionPayload = response.suggestion ?? response.result?.suggestion;
      const suggestionText = typeof suggestionPayload === 'string' ? suggestionPayload : suggestionPayload?.text;
      setAiSuggestion(suggestionText ?? '');
      if (!suggestionText) setShowSuggestionError('The server did not return a suggestion.');
    } catch (error: unknown) {
      setShowSuggestionError(error instanceof Error ? error.message : 'Could not fetch a suggestion.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const stageOutcomeOptions = activeStage.outcomes;

  if (isLoading && !activeCall) {
    return <div className="min-h-[60vh] flex items-center justify-center text-slate-500"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /><p>Loading call session…</p></div></div>;
  }

  if (!activeCall) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Callframe workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Start a new call</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Create a new persisted call record. Existing calls can only be resumed from History.</p>
          {errorMessage && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</div>}
          <form onSubmit={handleStartCall} className="mt-7 space-y-5">
            <div>
              <label htmlFor="prospect-name" className="mb-1.5 block text-sm font-medium text-slate-800">Prospect name *</label>
              <input id="prospect-name" autoComplete="name" value={prospectName} onChange={(event) => setProspectName(event.target.value)} required maxLength={200} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Name of the person you are calling" />
              {fieldErrors.prospect_name && <p className="mt-1 text-xs text-red-700">{fieldErrors.prospect_name}</p>}
            </div>
            <div>
              <label htmlFor="prospect-company" className="mb-1.5 block text-sm font-medium text-slate-800">Company *</label>
              <input id="prospect-company" value={company} onChange={(event) => setCompany(event.target.value)} required maxLength={200} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Company name" />
              {fieldErrors.company && <p className="mt-1 text-xs text-red-700">{fieldErrors.company}</p>}
            </div>
            <div>
              <label htmlFor="prospect-role" className="mb-1.5 block text-sm font-medium text-slate-800">Role (optional)</label>
              <input id="prospect-role" value={prospectRole} onChange={(event) => setProspectRole(event.target.value)} maxLength={200} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="For example, Operations Manager" />
            </div>
            <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
              {isLoading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Creating call…</> : 'Start a Call'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" /></span>
            <h1 className="text-lg font-bold text-slate-950">{activeCall.callerName}</h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">{activeCall.id.slice(0, 8)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{activeCall.company}{activeCall.callerRole ? ` · ${activeCall.callerRole}` : ''}</p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Duration</span>
            <span className="font-mono text-xl font-semibold tabular-nums text-emerald-700">{durationLabel(timerSeconds)}</span>
          </div>
          <button type="button" onClick={handleExit} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Exit workspace</button>
        </div>
      </header>

      {errorMessage && <div role="alert" className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{errorMessage}</span><button type="button" aria-label="Dismiss error" onClick={() => setErrorMessage(null)} className="font-bold">×</button></div>}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[275px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-2 pb-3 pt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Call stages</h2>
          <nav aria-label="Call stages" className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {stages.map((stage, index) => {
              const stageNumber = index + 1;
              const unlocked = stageNumber <= highestStage;
              const chosen = stageNumber === currentStage;
              const saved = Boolean(activeCall.stageData[stageNumber]);
              return <button type="button" key={stage.title} onClick={() => { if (unlocked) void handleSelectStage(stageNumber); }} disabled={!unlocked || isSaving || isEnding || isSuggesting} aria-current={chosen ? 'step' : undefined} className={`rounded-lg border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${chosen ? 'border-blue-600 bg-blue-50 text-blue-950' : saved ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100' : 'border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50'}`}>
                <span className="flex items-center justify-between gap-2 text-sm font-semibold"><span>{stageNumber}. {stage.title}</span>{saved && <span aria-label="Saved" className="text-emerald-700">✓</span>}</span>
                <span className="mt-1 hidden text-xs leading-5 text-slate-500 lg:block">{stage.guidance}</span>
              </button>;
            })}
          </nav>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">Progress is saved to the call record before moving to the next stage.</p>
        </aside>

        <main className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {!isCloseOpen ? <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Stage {currentStage} of 8</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{activeStage.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{activeStage.guidance}</p></div>
              <button type="button" onClick={handleOpenClosePanel} disabled={isEnding || isSaving || isSuggesting} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">End Call…</button>
            </div>

            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-900">What to do at this stage</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">{activeStage.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>
            </div>

            <fieldset className="mb-5">
              <legend className="mb-3 text-sm font-semibold text-slate-900">What happened? <span className="font-normal text-slate-500">Choose one</span></legend>
              <div className="flex flex-wrap gap-2">
                {stageOutcomeOptions.map(([key, label]) => <button type="button" key={key} aria-pressed={currentDraft.outcomeKey === key} disabled={isSaving || isEnding || isSuggesting || (hasSavedDncSignal && key !== 'asked_not_to_call')} onClick={() => { void handleChooseStageOutcome(key); }} className={`rounded-full border px-3.5 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ${currentDraft.outcomeKey === key ? (key === 'asked_not_to_call' ? 'border-rose-700 bg-rose-700 text-white' : 'border-blue-700 bg-blue-700 text-white') : key === 'asked_not_to_call' ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50'}`}>{label}</button>)}
              </div>
            </fieldset>

            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <label htmlFor="prospect-words" className="mb-2 block text-sm font-semibold text-slate-900">Their words <span className="font-normal text-slate-500">(exact words, not a summary)</span></label>
                <textarea id="prospect-words" value={currentDraft.prospectWords} maxLength={4000} onChange={(event) => updateDraft({ prospectWords: event.target.value })} rows={5} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 font-serif text-base leading-6 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder={currentStage === 5 ? 'Capture exactly what they said about their need or goal…' : 'Write the prospect’s exact words here when useful…'} />
                <p className="mt-1 text-right text-xs text-slate-400">{currentDraft.prospectWords.length}/4000</p>
              </div>
              <div>
                <label htmlFor="caller-notes" className="mb-2 block text-sm font-semibold text-slate-900">Your note <span className="font-normal text-slate-500">(your interpretation or action)</span></label>
                <textarea id="caller-notes" value={currentDraft.notes} maxLength={4000} onChange={(event) => updateDraft({ notes: event.target.value })} rows={5} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Your observations, context, and agreed actions…" />
                <p className="mt-1 text-right text-xs text-slate-400">{currentDraft.notes.length}/4000</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">AI speaking suggestion</h3><p className="mt-1 text-xs text-slate-500">Suggestions are kept separate from prospect words and your notes.</p></div><button type="button" onClick={handleSuggest} disabled={isSuggesting || hasSavedDncSignal} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">{isSuggesting ? 'Generating…' : 'Suggest what to say'}</button></div>
              {showSuggestionError && (
                <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p role="alert">{showSuggestionError}</p>
                  <button
                    type="button"
                    onClick={handleSuggest}
                    disabled={isSuggesting || hasSavedDncSignal}
                    className="shrink-0 font-semibold underline hover:text-red-950"
                  >
                    Retry
                  </button>
                </div>
              )}
              {aiSuggestion && <div className="mt-3 rounded-lg border border-violet-200 bg-white p-3 text-sm leading-6 text-slate-800"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-violet-700">AI suggestion · not prospect words</p>{aiSuggestion}</div>}
            </div>

            <footer className="mt-7 flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
              <button type="button" onClick={() => { void handleSelectStage(currentStage - 1); }} disabled={currentStage <= 1 || isSaving || isEnding || isSuggesting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">← Previous Stage</button>
              <div className="flex flex-wrap gap-3 sm:justify-end"><span aria-live="polite" className="self-center text-xs text-slate-500">{isSaving ? 'Saving stage…' : hasUnsavedChanges ? 'Unsaved changes (draft kept locally)' : `Saved revision ${savedCurrentDraft?.revision ?? ''}`}</span><button type="button" onClick={handleSaveContinue} disabled={isSaving || isEnding || isSuggesting} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{isSaving ? 'Saving…' : currentStage === 8 ? 'Save Stage 8' : 'Save & Continue →'}</button></div>
            </footer>
          </> : <section aria-labelledby="close-heading">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-rose-700">Close call</p><h2 id="close-heading" className="mt-1 text-2xl font-bold text-slate-950">End this call</h2><p className="mt-2 text-sm text-slate-600">Ending at Stage {currentStage}. The server preserves the highest stage reached.</p></div><button type="button" onClick={() => setIsCloseOpen(false)} disabled={isEnding} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to call</button></div>
            {errorMessage && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</div>}
            {fieldErrors.dnc_words && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{fieldErrors.dnc_words} <button type="button" onClick={() => { setCurrentStage(6); setIsCloseOpen(false); }} className="ml-1 font-semibold underline">Go to Stage 6</button></div>}
            {suggestedOutcome(drafts) && <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><strong>Suggested outcome:</strong> {finalOutcomes.find((outcome) => outcome.key === suggestedOutcome(drafts))?.label}. This is based on the recorded stage selections; confirm or change it.</div>}
            <fieldset><legend className="mb-3 text-sm font-semibold text-slate-900">Final outcome *</legend><div className="grid gap-2 sm:grid-cols-2">
              {finalOutcomes.map((outcome) => <button type="button" key={outcome.key} aria-pressed={closeOutcome === outcome.key} onClick={() => chooseCloseOutcome(outcome.key)} className={`rounded-lg border p-3 text-left text-sm font-medium ${closeOutcome === outcome.key ? outcome.key === 'do_not_call' ? 'border-rose-700 bg-rose-700 text-white' : 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}>{outcome.label}{outcome.key === 'do_not_call' && <span className="mt-1 block text-xs font-normal">Requires the Stage 6 restriction button and exact words.</span>}</button>)}
            </div>{fieldErrors.outcome && <p className="mt-2 text-sm text-red-700">{fieldErrors.outcome}</p>}</fieldset>

            {closeOutcome && !['declined', 'wrong_contact', 'no_contact', 'do_not_call'].includes(closeOutcome) && <div className="mt-5 rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-900">Next-step details</h3>
              {(closeOutcome === 'next_step_set') && <div className="mt-3"><label htmlFor="step-type" className="mb-1 block text-sm font-medium text-slate-700">Agreed next step</label><select id="step-type" value={nextStep.type} onChange={(event) => setNextStep((value) => ({ ...value, type: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="call">Call</option><option value="meeting">Meeting</option></select></div>}
              <div className="mt-3">{(closeOutcome === 'next_step_set' || closeOutcome === 'callback_requested') && <><label htmlFor="step-when" className="mb-1 block text-sm font-medium text-slate-700">{closeOutcome === 'callback_requested' ? 'Callback time *' : 'Agreed time *'}</label><input id="step-when" value={nextStep.when} onChange={(event) => setNextStep((value) => ({ ...value, when: event.target.value }))} maxLength={200} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" placeholder="e.g. Thursday at 10:30 AM" />{fieldErrors['next_step.when'] && <p className="mt-1 text-xs text-red-700">{fieldErrors['next_step.when']}</p>}</>}
                {closeOutcome === 'document_requested' && <><label htmlFor="step-channel" className="mb-1 block text-sm font-medium text-slate-700">Document delivery channel *</label><input id="step-channel" value={nextStep.channel} onChange={(event) => setNextStep((value) => ({ ...value, channel: event.target.value }))} maxLength={200} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" placeholder="Email, WhatsApp, etc." />{fieldErrors['next_step.channel'] && <p className="mt-1 text-xs text-red-700">{fieldErrors['next_step.channel']}</p>}</>}
                {closeOutcome === 'referred' && <><label htmlFor="step-detail" className="mb-1 block text-sm font-medium text-slate-700">Who were you referred to? *</label><input id="step-detail" value={nextStep.detail} onChange={(event) => setNextStep((value) => ({ ...value, detail: event.target.value }))} maxLength={2000} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" placeholder="Name, role, or contact details" />{fieldErrors['next_step.detail'] && <p className="mt-1 text-xs text-red-700">{fieldErrors['next_step.detail']}</p>}</>}
              </div>
            </div>}

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 5 · Their words</p><p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-6 text-slate-800">{drafts[5]?.prospectWords?.trim() ? drafts[5].prospectWords : 'No prospect words recorded at Stage 5.'}</p></div>
            {fieldErrors.dnc_words && <p className="mt-3 text-sm text-rose-700">{fieldErrors.dnc_words}</p>}
            <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center"><button type="button" onClick={() => setIsCloseOpen(false)} disabled={isEnding} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={handleSaveAndEnd} disabled={isEnding || isSaving || isSuggesting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60">{isEnding ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Saving & ending…</> : 'Save and end call'}</button></div>
          </section>}
        </main>
      </div>
    </div>
  );
}
