'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  CallSession,
  getActiveCallId,
  setActiveCallId,
  startNewCall,
  fetchCallById,
  saveStageProgress,
  endCallSession,
  saveCallDraft,
} from '@/lib/callframe';

const STAGES = [
  { id: 1, name: 'Opening', desc: 'Greeting, verify caller details & purpose' },
  { id: 2, name: 'Verification', desc: 'Account & identity check' },
  { id: 3, name: 'Discovery', desc: 'Identify core issue or requirements' },
  { id: 4, name: 'Assessment', desc: 'Evaluate options and business rules' },
  { id: 5, name: 'Resolution', desc: 'Propose action or execute solution' },
  { id: 6, name: 'Confirmation', desc: 'Verify customer understanding & satisfaction' },
  { id: 7, name: 'Next Steps', desc: 'Schedule follow-up or assign ticket' },
  { id: 8, name: 'Wrap Up', desc: 'Select call outcome and finalize notes' },
];

const OUTCOME_OPTIONS = [
  { id: 'resolved', label: 'Issue Resolved', requireFollowUp: false },
  { id: 'follow_up_required', label: 'Follow-Up Required', requireFollowUp: true },
  { id: 'escalated', label: 'Escalated to Tier 2', requireFollowUp: true },
  { id: 'do_not_call', label: 'Do Not Call (DNC)', requireFollowUp: false },
  { id: 'no_answer', label: 'No Answer / Dropped', requireFollowUp: false },
];

export default function WorkspacePage() {
  const router = useRouter();

  // Active Call State
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [stageInputs, setStageInputs] = useState<Record<string, any>>({});
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');

  // Initial Caller Form State (Before call start)
  const [callerName, setCallerName] = useState<string>('');
  const [callerPhone, setCallerPhone] = useState<string>('');
  const [callerEmail, setCallerEmail] = useState<string>('');
  const [company, setCompany] = useState<string>('');

  // UI / Status Indicators
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isEnding, setIsEnding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Timer Ref
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing active call on mount
  useEffect(() => {
    const existingId = getActiveCallId();
    if (existingId) {
      setIsLoading(true);
      fetchCallById(existingId)
        .then((call) => {
          if (call.status === 'active') {
            setActiveCall(call);
            setCurrentStage(call.currentStage || 1);
            setTimerSeconds(call.timerSeconds || 0);
            setNotes(call.notes || '');
            setSelectedOutcome(call.outcome || '');
            setFollowUpDate(call.followUpDate || '');
            setStageInputs(call.stageData?.[call.currentStage] || {});
          } else {
            // If already completed, wipe active reference
            setActiveCallId(null);
          }
        })
        .catch(() => {
          setErrorMessage('Could not restore previous active call session.');
          setActiveCallId(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, []);

  // Timer Tick Handling
  useEffect(() => {
    if (activeCall && activeCall.status === 'active') {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeCall]);

  // Format Timer Seconds (MM:SS)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 1. Start a Brand New Call
  const handleStartCallClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const newCall = await startNewCall({
        name: callerName,
        phone: callerPhone,
        email: callerEmail,
        company,
      });

      // Reset all Workspace values
      setActiveCall(newCall);
      setCurrentStage(1);
      setTimerSeconds(0);
      setNotes('');
      setStageInputs({});
      setSelectedOutcome('');
      setFollowUpDate('');
      setValidationErrors({});
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start a new call. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Validate Fields for Current Stage
  const validateStage = (): boolean => {
    const errors: Record<string, string> = {};

    if (currentStage === 1) {
      if (!activeCall?.callerName && !callerName) {
        errors.callerName = 'Caller name or subject is required.';
      }
    }

    if (currentStage === 8) {
      if (!selectedOutcome) {
        errors.outcome = 'You must select a call outcome before ending.';
      }
      const outcomeObj = OUTCOME_OPTIONS.find((o) => o.id === selectedOutcome);
      if (outcomeObj?.requireFollowUp && !followUpDate) {
        errors.followUpDate = 'Follow-up date is required for this outcome.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 3. Save & Proceed to Next Stage
  const handleNextStage = async () => {
    if (isSaving || !activeCall) return;
    if (!validateStage()) return;

    setIsSaving(true);
    setErrorMessage(null);

    const nextStageNum = Math.min(8, currentStage + 1);

    try {
      const updated = await saveStageProgress(activeCall.id, {
        stage: currentStage,
        stageData: stageInputs,
        notes,
        timerSeconds,
      });

      setActiveCall(updated);
      setCurrentStage(nextStageNum);
      setStageInputs(updated.stageData?.[nextStageNum] || {});
    } catch (err: any) {
      setErrorMessage('Saving failed. Please check your connection and retry.');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Return to Previous Stage
  const handlePreviousStage = () => {
    if (currentStage <= 1 || !activeCall) return;

    const prevStageNum = currentStage - 1;
    // Preserve local changes in draft cache
    saveCallDraft(activeCall.id, {
      ...activeCall,
      currentStage: prevStageNum,
      notes,
      timerSeconds,
    });

    setCurrentStage(prevStageNum);
    setStageInputs(activeCall.stageData?.[prevStageNum] || {});
  };

  // 5. End Call Action
  const handleEndCallClick = async () => {
    if (isEnding || !activeCall) return;

    // Direct to Stage 8 if not already there
    if (currentStage !== 8) {
      setCurrentStage(8);
      return;
    }

    if (!validateStage()) return;

    setIsEnding(true);
    setErrorMessage(null);

    try {
      await endCallSession(activeCall.id, {
        outcome: selectedOutcome,
        followUpDate,
        notes,
        timerSeconds,
        stageData: {
          ...activeCall.stageData,
          [currentStage]: stageInputs,
        },
      });

      // Clear local state and navigate to History
      setActiveCall(null);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      router.push('/history');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit call completion. Retrying allowed.');
    } finally {
      setIsEnding(false);
    }
  };

  // 6. Cancel / Close Workspace Safeguard
  const handleCancelWorkspace = () => {
    if (activeCall) {
      const confirmLeave = window.confirm(
        'Are you sure you want to exit? Your active call session will remain saved as draft.'
      );
      if (!confirmLeave) return;
    }
    router.push('/history');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading call session...</p>
        </div>
      </div>
    );
  }

  // Pre-Call Screen: Form to initiate call
  if (!activeCall) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-2">Start a New Call</h1>
          <p className="text-slate-400 text-sm mb-6">
            Enter caller details to initialize a brand new session.
          </p>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleStartCallClick} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Caller Name / Contact
              </label>
              <input
                type="text"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Company / Organization
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg"
            >
              {isLoading ? 'Creating Session...' : 'Start Call Session'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active Call Workspace
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header & Status Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-lg font-bold text-white">
              Active Call: {activeCall.callerName || 'Unknown Caller'}
            </h1>
            <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">
              ID: {activeCall.id.slice(0, 8)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeCall.company ? `${activeCall.company} • ` : ''}
            {activeCall.callerPhone || 'No phone provided'}
          </p>
        </div>

        {/* Timer Display */}
        <div className="flex items-center gap-6">
          <div className="bg-slate-950 border border-slate-800 px-4 py-1.5 rounded-lg text-center">
            <span className="text-xs uppercase font-semibold text-slate-500 block">Duration</span>
            <span className="text-xl font-mono font-bold text-emerald-400">
              {formatTime(timerSeconds)}
            </span>
          </div>

          <button
            onClick={handleCancelWorkspace}
            className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded border border-slate-800 hover:border-slate-700"
          >
            Exit Workspace
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Stage Progress Bar */}
        <aside className="w-72 bg-slate-900/50 border-r border-slate-800 p-4 overflow-y-auto">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Workflow Stages
          </h2>
          <div className="space-y-2">
            {STAGES.map((s) => {
              const isActive = s.id === currentStage;
              const isPassed = s.id < currentStage;

              return (
                <div
                  key={s.id}
                  onClick={() => s.id <= currentStage && setCurrentStage(s.id)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${isActive
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : isPassed
                        ? 'bg-slate-800/40 border-slate-800 text-slate-300'
                        : 'bg-slate-950/40 border-slate-900 text-slate-600'
                    }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>
                      {s.id}. {s.name}
                    </span>
                    {isPassed && <span className="text-emerald-400">✓</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center Panel: Active Stage Work Area */}
        <main className="flex-1 p-6 overflow-y-auto flex flex-col justify-between bg-slate-950">
          <div>
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-900/40 border border-red-500 rounded-lg text-red-200 text-sm flex justify-between items-center">
                <span>{errorMessage}</span>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-xs text-red-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Stage Title & Header */}
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Stage {currentStage} of 8
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">
                {STAGES[currentStage - 1].name}
              </h2>
              <p className="text-sm text-slate-400">{STAGES[currentStage - 1].desc}</p>
            </div>

            {/* Stage 8 Specific Outcome Options */}
            {currentStage === 8 ? (
              <div className="space-y-6 bg-slate-900 p-6 border border-slate-800 rounded-xl">
                <h3 className="text-sm font-semibold text-white">Select Call Outcome</h3>
                {validationErrors.outcome && (
                  <p className="text-xs text-red-400">{validationErrors.outcome}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOutcome(opt.id)}
                      className={`p-3.5 rounded-lg border text-left font-medium text-sm transition-all ${selectedOutcome === opt.id
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Follow-Up Date Input if Required */}
                {OUTCOME_OPTIONS.find((o) => o.id === selectedOutcome)?.requireFollowUp && (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Required Follow-Up Date
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    {validationErrors.followUpDate && (
                      <p className="text-xs text-red-400 mt-1">{validationErrors.followUpDate}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Standard Stage Form Inputs */
              <div className="space-y-4 bg-slate-900/60 p-6 border border-slate-800 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Stage Notes & Actions Taken
                  </label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Record key details, customer requests, or actions taken during this stage..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Control Bar */}
          <footer className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={handlePreviousStage}
              disabled={currentStage <= 1 || isSaving || isEnding}
              className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-sm font-medium transition-colors"
            >
              ← Previous Stage
            </button>

            <div className="flex items-center gap-3">
              {currentStage < 8 ? (
                <button
                  onClick={handleNextStage}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-lg"
                >
                  {isSaving ? 'Saving...' : 'Save & Continue →'}
                </button>
              ) : (
                <button
                  onClick={handleEndCallClick}
                  disabled={isEnding}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-8 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-lg flex items-center gap-2"
                >
                  {isEnding ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Saving & Ending Call...
                    </>
                  ) : (
                    'End Call & Complete'
                  )}
                </button>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}