'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CallSession, fetchCallHistory, setResumeCallId } from '@/lib/callframe';
import { stages } from '@/lib/stages';

function statusLabel(status: CallSession['displayStatus']) {
  return ({ in_progress: 'In progress', completed: 'Completed', ended_early: 'Ended early', abandoned: 'Abandoned' } as const)[status];
}
function durationLabel(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function HistoryList() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try { setCalls(await fetchCallHistory()); }
    catch (error: unknown) { setErrorMessage(error instanceof Error ? error.message : 'Could not load call history.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Keep state updates inside async callbacks; this also avoids set-state-in-effect lint errors.
    fetchCallHistory()
      .then((history) => { if (!cancelled) setCalls(history); })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Could not load call history.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const handleResume = (call: CallSession) => {
    if (call.status !== 'in_progress') return;
    setResumeCallId(call.id);
    router.push(`/workspace?resume=${encodeURIComponent(call.id)}`);
  };

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-500"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />Loading calls from the server…</div>;
  if (errorMessage) return <div className="mx-auto max-w-4xl px-4 py-12"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{errorMessage}</p><button onClick={loadHistory} className="mt-3 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800">Retry</button></div></div>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Callframe</p><h1 className="mt-1 text-3xl font-bold text-slate-950">Call history</h1><p className="mt-2 text-sm text-slate-600">Saved records loaded from the backend.</p></div><div className="flex gap-2"><button onClick={loadHistory} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh</button><Link href="/workspace?new=1" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Start a Call</Link></div></div>
      {calls.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm"><h2 className="text-lg font-semibold text-slate-900">No calls yet</h2><p className="mt-2 text-sm text-slate-600">Once you create a call, it will appear here after the server saves it.</p><Link href="/workspace?new=1" className="mt-5 inline-flex rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Start your first call</Link></div> :
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Prospect / Company</th><th className="p-4">Last stage</th><th className="p-4">Outcome</th><th className="p-4">Status</th><th className="p-4">Duration</th><th className="p-4">Started</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{calls.map((call) => <tr key={call.id} className="hover:bg-slate-50"><td className="p-4"><div className="font-semibold text-slate-900">{call.callerName || 'Unnamed prospect'}</div><div className="mt-1 text-xs text-slate-500">{call.company || 'No company'}</div>{call.doNotCall && <span className="mt-2 inline-block rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">Do not call</span>}</td><td className="p-4 text-slate-700">Stage {call.lastStage}: {stages[call.lastStage - 1]?.title ?? 'Unknown'}</td><td className="p-4 capitalize text-slate-700">{call.outcome?.replace(/_/g, ' ') || '—'}{call.followUpDate && <div className="mt-1 text-xs text-slate-500">{call.nextStepType}: {call.followUpDate}</div>}</td><td className="p-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${call.displayStatus === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : call.displayStatus === 'in_progress' ? 'border-blue-200 bg-blue-50 text-blue-800' : call.displayStatus === 'abandoned' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>{statusLabel(call.displayStatus)}</span></td><td className="p-4 font-mono tabular-nums text-slate-600">{durationLabel(call.timerSeconds)}</td><td className="p-4 text-slate-600">{call.startedAt ? new Date(call.startedAt).toLocaleString() : '—'}</td><td className="p-4 text-right"><div className="flex justify-end gap-2"><Link href={`/history/${call.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">View</Link>{call.status === 'in_progress' && <button onClick={() => handleResume(call)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">Resume</button>}</div></td></tr>)}</tbody></table></div>}
    </div>
  );
}
