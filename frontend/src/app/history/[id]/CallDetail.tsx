'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CallSession, fetchCallById, setActiveCallId } from '@/lib/callframe';

export default function CallDetail({ id }: { id: string }) {
  const router = useRouter();
  const [call, setCall] = useState<CallSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchCallById(id)
      .then(setCall)
      .catch((err: any) => {
        setErrorMessage(err.message || 'Failed to load call detail record.');
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleResume = () => {
    if (!call) return;
    setActiveCallId(call.id);
    router.push('/workspace');
  };

  const formatDuration = (secs: number) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading call record detail...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !call) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-xl text-center">
          <p className="text-red-400 mb-4">{errorMessage || 'Call record not found.'}</p>
          <Link
            href="/history"
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm inline-block"
          >
            ← Back to History
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <Link
          href="/history"
          className="text-xs text-slate-400 hover:text-white border border-slate-800 px-3 py-1.5 rounded-lg"
        >
          ← Back to Call History
        </Link>
        {call.status === 'active' && (
          <button
            onClick={handleResume}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Resume Call Session
          </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{call.callerName || 'Unnamed Caller'}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {call.company ? `${call.company} • ` : ''}
              {call.callerPhone || 'No phone provided'}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${call.status === 'completed'
                ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                : 'bg-amber-900/50 text-amber-300 border border-amber-700'
              }`}
          >
            {call.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800 text-sm">
          <div>
            <span className="text-xs text-slate-500 uppercase block font-semibold">Duration</span>
            <span className="font-mono text-emerald-400">{formatDuration(call.timerSeconds)}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase block font-semibold">Outcome</span>
            <span className="text-slate-200 capitalize">
              {call.outcome ? call.outcome.replace(/_/g, ' ') : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase block font-semibold">
              Stage Reached
            </span>
            <span className="text-slate-200">Stage {call.currentStage} of 8</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase block font-semibold">
              Follow-Up Date
            </span>
            <span className="text-slate-200">{call.followUpDate || 'None'}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Notes & Stage Summary</h2>
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap">
          {call.notes || 'No notes recorded for this call.'}
        </div>
      </div>
    </div>
  );
}