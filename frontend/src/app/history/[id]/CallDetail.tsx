"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DncBadge, OutcomeChip, StatusBadge } from "@/components/history/Badges";
import { ApiError, apiFetch } from "@/lib/api";
import {
  NEED_STAGE,
  buttonLabel,
  displayStatus,
  formatDateTime,
  groupByStage,
  lastStageText,
  nextStepSummary,
  stageTitle,
  type AiSuggestionRow,
  type CallSummary,
  type StageResultRow,
} from "@/lib/callframe";

const ACTIVE_CALL_KEY = "callframe.activeCallId";

type DetailResponse = { call: CallSummary; stage_results: StageResultRow[]; ai_suggestions: AiSuggestionRow[] };
type DetailState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DetailResponse };

export default function CallDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<DetailResponse>(`/api/calls/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((data) => setState({ kind: "ready", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) {
          setState({ kind: "not_found" });
          return;
        }
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "The call could not be loaded. Please retry.",
        });
      });
    return () => controller.abort();
  }, [id, attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  };

  const resume = () => {
    try {
      window.localStorage.setItem(ACTIVE_CALL_KEY, id);
    } catch {
      // Storage blocked: the workspace will simply start from its form.
    }
    router.push("/workspace");
  };

  return (
    <div className="bg-cream-50 min-h-[calc(100vh-8rem)]">
      <div className="container py-8 md:py-12 max-w-4xl">
        <Link href="/history" className="body-sm text-ochre-700 hover:underline">
          ← Back to history
        </Link>

        {state.kind === "loading" && <DetailSkeleton />}

        {state.kind === "not_found" && (
          <div className="card p-8 mt-6 text-center" role="alert">
            <h1 className="heading-3 text-espresso-100 mb-2">Call not found</h1>
            <p className="body text-espresso-500 mb-6">This call does not exist, or the link is wrong.</p>
            <Link href="/history" className="btn btn--primary">
              Back to history
            </Link>
          </div>
        )}

        {state.kind === "error" && (
          <div className="card p-6 md:p-8 mt-6" role="alert">
            <h1 className="heading-4 text-espresso-100 mb-2">The call could not be loaded</h1>
            <p className="body text-espresso-500 mb-4">{state.message}</p>
            <button type="button" className="btn btn--primary btn--sm" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {state.kind === "ready" && <Ready data={state.data} onResume={resume} />}
      </div>
    </div>
  );
}

function Ready({ data, onResume }: { data: DetailResponse; onResume: () => void }) {
  const { call, stage_results: results, ai_suggestions: suggestions } = data;
  const status = displayStatus(call);
  const timeline = useMemo(() => groupByStage(results), [results]);
  const next = nextStepSummary(call);

  return (
    <div className="mt-6 grid gap-8">
      <header className="card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="heading-2 text-espresso-100">{call.prospect_name}</h1>
            <p className="body text-espresso-500">
              {call.company}
              {call.prospect_role ? ` · ${call.prospect_role}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {call.do_not_call && <DncBadge />}
            <StatusBadge status={status} />
          </div>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3 body-sm">
          <div>
            <dt className="caption text-espresso-500">Started</dt>
            <dd className="text-espresso-100">{formatDateTime(call.started_at)}</dd>
          </div>
          <div>
            <dt className="caption text-espresso-500">Ended</dt>
            <dd className="text-espresso-100">{call.ended_at ? formatDateTime(call.ended_at) : "Not ended"}</dd>
          </div>
          <div>
            <dt className="caption text-espresso-500">Last stage</dt>
            <dd className="text-espresso-100">{lastStageText(call.last_stage)}</dd>
          </div>
        </dl>
        {call.status === "in_progress" && (
          <div className="mt-5">
            <button type="button" className="btn btn--primary btn--sm" onClick={onResume}>
              Resume this call
            </button>
          </div>
        )}
      </header>

      <section className="card p-6 md:p-8" aria-labelledby="result-heading">
        <h2 id="result-heading" className="heading-4 text-espresso-100 mb-4">
          Outcome and next step
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 body-sm">
          <div>
            <dt className="caption text-espresso-500 mb-1">Outcome</dt>
            <dd>
              <OutcomeChip outcome={call.outcome} />
            </dd>
          </div>
          <div>
            <dt className="caption text-espresso-500 mb-1">Next step</dt>
            <dd className="text-espresso-100">{next ?? <span className="text-espresso-500">None agreed</span>}</dd>
          </div>
        </dl>
        {call.do_not_call && (
          <div className="mt-5 rounded-lg border border-espresso-300 bg-cream-200 p-4">
            <p className="caption text-espresso-100 font-semibold mb-1">Do-not-call request, in their words</p>
            <p className="font-display text-espresso-100 whitespace-pre-wrap">
              {call.dnc_words?.trim() ? call.dnc_words : "No words were recorded."}
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="heading-3 text-espresso-100 mb-4">
          Stage by stage
        </h2>
        <ol className="grid gap-4">
          {timeline.map(({ stage, latest, earlier }) => {
            const isNeed = stage === NEED_STAGE;
            const label = buttonLabel(stage, latest?.outcome_key ?? null);
            return (
              <li key={stage} className="card p-5 md:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="heading-4 text-espresso-100">
                    {stage}. {stageTitle(stage)}
                  </h3>
                  {latest && <span className="caption text-espresso-500">Saved {formatDateTime(latest.created_at)}</span>}
                </div>

                {!latest ? (
                  <p className="body-sm text-espresso-500 mt-2">Nothing recorded at this stage.</p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    <p className="body-sm">
                      <span className="caption text-espresso-500 mr-2">Button</span>
                      {label ? <span className="text-espresso-100">{label}</span> : <span className="text-espresso-500">None tapped</span>}
                    </p>
                    <WordsBlock words={latest.prospect_words} highlight={isNeed} heading={isNeed ? "What they said they need, in their words" : "Their words"} />
                    <NoteBlock note={latest.notes} />
                  </div>
                )}

                {earlier.length > 0 && (
                  <details className="mt-4 rounded-lg bg-cream-100 p-3">
                    <summary className="cursor-pointer body-sm font-semibold text-espresso-100">
                      Earlier versions ({earlier.length})
                    </summary>
                    <ul className="mt-3 grid gap-3">
                      {earlier.map((row) => (
                        <li key={row.id} className="rounded-lg border border-espresso-200 bg-white p-3">
                          <p className="caption text-espresso-500 mb-2">
                            Version {row.revision} · {formatDateTime(row.created_at)}
                          </p>
                          <p className="body-sm mb-2">
                            <span className="caption text-espresso-500 mr-2">Button</span>
                            {buttonLabel(stage, row.outcome_key) ?? <span className="text-espresso-500">None tapped</span>}
                          </p>
                          <WordsBlock words={row.prospect_words} heading="Their words" compact />
                          <NoteBlock note={row.notes} compact />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="ai-heading">
        <h2 id="ai-heading" className="heading-3 text-espresso-100 mb-1">
          AI suggestions
        </h2>
        <p className="body-sm text-espresso-500 mb-4">Shown separately. They were never added to the prospect&apos;s words or your notes.</p>
        {suggestions.length === 0 ? (
          <p className="body-sm text-espresso-500">No AI suggestion was used on this call.</p>
        ) : (
          <ul className="grid gap-3">
            {suggestions.map((item) => (
              <li key={item.id} className="rounded-lg border border-dashed border-ochre-500 bg-ochre-50 p-4">
                <p className="caption text-ochre-700 font-semibold mb-2">
                  AI suggestion, not the prospect&apos;s words
                  <span className="ml-2 font-normal text-espresso-500">
                    · Stage {item.stage} · {item.model} · {formatDateTime(item.created_at)}
                  </span>
                </p>
                <p className="body text-espresso-100 whitespace-pre-wrap">{item.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function WordsBlock({ words, heading, highlight = false, compact = false }: { words: string; heading: string; highlight?: boolean; compact?: boolean }) {
  if (!words.trim()) {
    if (compact) return null;
    return highlight ? (
      <p className="rounded-lg border-2 border-dashed border-ochre-500 bg-ochre-50 p-3 body-sm text-ochre-800">
        Exact words were not captured at this stage.
      </p>
    ) : (
      <p className="body-sm text-espresso-500">No words captured.</p>
    );
  }
  return (
    <div className={highlight ? "rounded-lg border-2 border-ochre-500 bg-ochre-50 p-4" : "rounded-lg bg-cream-100 p-3"}>
      <p className={`caption mb-1 ${highlight ? "text-ochre-800 font-semibold" : "text-espresso-500"}`}>{heading}</p>
      <p className={`font-display text-espresso-100 whitespace-pre-wrap ${highlight ? "text-lg" : ""}`}>{words}</p>
    </div>
  );
}

function NoteBlock({ note, compact = false }: { note: string; compact?: boolean }) {
  if (!note.trim()) return null;
  return (
    <div className={compact ? "mt-2" : ""}>
      <p className="caption text-espresso-500 mb-1">Caller&apos;s note</p>
      <p className="body-sm text-espresso-100 whitespace-pre-wrap">{note}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-6 grid gap-4" role="status">
      {[0, 1, 2].map((item) => (
        <div key={item} className="card p-6 animate-pulse" aria-hidden="true">
          <div className="h-6 w-1/3 rounded bg-cream-400 mb-4" />
          <div className="h-4 w-2/3 rounded bg-cream-400 mb-2" />
          <div className="h-4 w-1/2 rounded bg-cream-400" />
        </div>
      ))}
      <span className="sr-only">Loading call…</span>
    </div>
  );
}
