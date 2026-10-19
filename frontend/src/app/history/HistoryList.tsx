'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CallSession, fetchCallHistory, setActiveCallId } from '@/lib/callframe';

export default function HistoryList() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchCallHistory();
      setCalls(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load call history records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const formatDuration = (secs: number) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleResumeCall = (callId: string) => {
    setActiveCallId(callId);
    router.push('/workspace');
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
        <p>Fetching call history database...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-8 bg-red-900/30 border border-red-500 rounded-xl text-center text-red-200">
        <p className="mb-4">{errorMessage}</p>
        <button
          onClick={loadHistory}
          className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Retry Load
        </button>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl">
        <p className="text-slate-400 mb-4">No completed or historical calls found.</p>
        <Link
          href="/workspace"
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors inline-block"
        >
          Start Your First Call
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Call Logs & Records ({calls.length})</h2>
        <button
          onClick={loadHistory}
          className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-md"
        >
          Refresh List
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4">Caller / Subject</th>
              <th className="p-4">Status</th>
              <th className="p-4">Outcome</th>
              <th className="p-4">Duration</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {calls.map((call) => (
              <tr key={call.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="p-4 font-medium text-white">
                  <div>{call.callerName || 'Unnamed Caller'}</div>
                  <div className="text-xs text-slate-500">{call.callerPhone || 'No phone'}</div>
                </td>

                <td className="p-4">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${call.status === 'completed'
                        ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                        : 'bg-amber-900/50 text-amber-300 border border-amber-700'
                      }`}
                  >
                    {call.status}
                  </span>
                </td>

                <td className="p-4 text-slate-300 capitalize">
                  {call.outcome ? call.outcome.replace(/_/g, ' ') : 'N/A'}
                </td>

                <td className="p-4 font-mono text-slate-400">
                  {formatDuration(call.timerSeconds)}
                </td>

                <td className="p-4 text-xs text-slate-500">
                  {new Date(call.createdAt || Date.now()).toLocaleDateString()}
                </td>

                <td className="p-4 text-right space-x-2">
                  <Link
                    href={`/history/${call.id}`}
                    className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg"
                  >
                    View Details
                  </Link>
                  {call.status === 'active' && (
                    <button
                      onClick={() => handleResumeCall(call.id)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Resume
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}