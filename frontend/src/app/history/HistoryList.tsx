"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DncBadge, OutcomeChip, StatusBadge } from "@/components/history/Badges";
import { ApiError, apiFetch } from "@/lib/api";
import {
  displayStatus,
  formatDateTime,
  lastStageText,
  nextStepSummary,
  type CallSummary,
} from "@/lib/callframe";

const PAGE_SIZE = 50;
const ACTIVE_CALL_KEY = "callframe.activeCallId";

type ListResponse = { calls: CallSummary[]; limit: number; offset: number; total: number };
type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; calls: CallSummary[]; total: number; moreError?: string; loadingMore?: boolean };

export default function HistoryList() {
  const router = useRouter();
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<ListResponse>(`/api/calls?limit=${PAGE_SIZE}&offset=0`, { signal: controller.signal })
      .then((data) => setState({ kind: "ready", calls: data.calls, total: data.total }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "The history could not be loaded. Please retry.",
        });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  };

  const loadMore = async () => {
    if (state.kind !== "ready" || state.loadingMore) return;
    const { calls, total } = state;
    setState({ kind: "ready", calls, total, loadingMore: true });
    try {
      const data = await apiFetch<ListResponse>(`/api/calls?limit=${PAGE_SIZE}&offset=${calls.length}`);
      const known = new Set(calls.map((call) => call.id));
      setState({
        kind: "ready",
        calls: [...calls, ...data.calls.filter((call) => !known.has(call.id))],
        total: data.total,
      });
    } catch (error) {
      setState({
        kind: "ready",
        calls,
        total,
        moreError: error instanceof ApiError ? error.message : "More calls could not be loaded.",
      });
    }
  };

  const resume = (id: string) => {
    try {
      window.localStorage.setItem(ACTIVE_CALL_KEY, id);
    } catch {
      // Storage blocked: the workspace will simply start from its form.
    }
    router.push("/workspace");
  };

  return (
    <div className="bg-cream-50 min-h-[calc(100vh-8rem)]">
      <div className="container py-8 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="heading-2 text-espresso-100 mb-2">Call history</h1>
            <p className="body text-espresso-500">Every saved call, newest first.</p>
          </div>
          <Link href="/workspace" className="btn btn--primary btn--sm">
            Start a call
          </Link>
        </div>

        {state.kind === "loading" && <ListSkeleton />}

        {state.kind === "error" && (
          <div className="card p-6 md:p-8" role="alert">
            <h2 className="heading-4 text-espresso-100 mb-2">The history could not be loaded</h2>
            <p className="body text-espresso-500 mb-4">{state.message}</p>
            <button type="button" className="btn btn--primary btn--sm" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {state.kind === "ready" && state.calls.length === 0 && (
          <div className="card p-8 md:p-12 text-center">
            <h2 className="heading-3 text-espresso-100 mb-2">No calls yet</h2>
            <p className="body text-espresso-500 mb-6">Calls you save will appear here.</p>
            <Link href="/workspace" className="btn btn--primary">
              Start call
            </Link>
          </div>
        )}

        {state.kind === "ready" && state.calls.length > 0 && (
          <>
            <ul className="grid gap-4" aria-label="Saved calls">
              {state.calls.map((call) => {
                const status = displayStatus(call);
                const next = nextStepSummary(call);
                return (
                  <li key={call.id} className="card p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="heading-4 text-espresso-100">
                          <Link href={`/history/${call.id}`} className="hover:underline">
                            {call.prospect_name} · {call.company}
                          </Link>
                        </h2>
                        <p className="body-sm text-espresso-500">
                          {formatDateTime(call.started_at)}
                          {call.prospect_role ? ` · ${call.prospect_role}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {call.do_not_call && <DncBadge />}
                        <StatusBadge status={status} />
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-3 body-sm">
                      <div>
                        <dt className="caption text-espresso-500">Last stage</dt>
                        <dd className="text-espresso-100">{lastStageText(call.last_stage)}</dd>
                      </div>
                      <div>
                        <dt className="caption text-espresso-500">Outcome</dt>
                        <dd className="mt-1">
                          <OutcomeChip outcome={call.outcome} />
                        </dd>
                      </div>
                      <div>
                        <dt className="caption text-espresso-500">Next step</dt>
                        <dd className="text-espresso-100">{next ?? <span className="text-espresso-500">None agreed</span>}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link href={`/history/${call.id}`} className="btn btn--secondary btn--sm">
                        View details
                      </Link>
                      {call.status === "in_progress" && (
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => resume(call.id)}>
                          Resume
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <p className="body-sm text-espresso-500" aria-live="polite">
                Showing {state.calls.length} of {state.total}
              </p>
              {state.calls.length < state.total && (
                <button type="button" className="btn btn--secondary btn--sm" disabled={state.loadingMore} onClick={() => void loadMore()}>
                  {state.loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
              {state.moreError && (
                <p className="body-sm text-red-800" role="alert">
                  {state.moreError}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-4" role="status">
      {[0, 1, 2].map((item) => (
        <div key={item} className="card p-6 animate-pulse" aria-hidden="true">
          <div className="h-5 w-1/2 rounded bg-cream-400 mb-3" />
          <div className="h-4 w-1/3 rounded bg-cream-400 mb-6" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-4 rounded bg-cream-400" />
            <div className="h-4 rounded bg-cream-400" />
            <div className="h-4 rounded bg-cream-400" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading call history…</span>
    </div>
  );
}
