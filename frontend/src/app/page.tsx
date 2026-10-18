"use client";

import { useEffect, useState } from "react";

const stages = [
  {
    title: "Opening",
    guidance: "Confirm who you have reached and make a clear, courteous start.",
    prompts: [
      "Introduce yourself and your organisation.",
      "Check that this is a suitable person to speak with.",
      "If someone else answers, ask how best to reach the right person.",
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
    guidance: "Give a brief, accurate reason for calling and answer questions plainly.",
    prompts: [
      "Say why you are calling in one sentence.",
      "Keep the explanation specific and easy to follow.",
      "If asked, explain how you got in touch without guessing.",
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
    guidance: "Check whether they have time and are willing to continue.",
    prompts: [
      "Ask whether now is a convenient time.",
      "If they are busy, offer to reconnect at a time they choose.",
      "Treat an unclear answer as unclear, not as agreement.",
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
    guidance: "Invite them to describe their business in their own terms.",
    prompts: [
      "Ask an open question about their work.",
      "Listen for the words they use to describe it.",
      "Let them correct or clarify anything you misunderstood.",
    ],
    outcomes: [
      ["shared_business", "Described their business"],
      ["one_line_waiting", "One line, then waited"],
      ["corrected_us", "Corrected an assumption"],
      ["asked_us_first", "Asked about us first"],
    ],
  },
  {
    title: "Their need in their words",
    guidance: "Capture what matters to them in their exact words.",
    prompts: [
      "Ask what they would most like to improve or resolve.",
      "Use their wording rather than translating it into a conclusion.",
      "If there is no clear answer, record that without filling in gaps.",
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
    guidance: "Understand their concern, respect a refusal, and do not push.",
    prompts: [
      "Listen fully before responding.",
      "Acknowledge the concern without making unsupported claims.",
      "A request not to be called again is a restriction, not an ordinary objection.",
    ],
    outcomes: [
      ["has_provider", "Already has a team or consultant"],
      ["not_right_person", "Not the right person"],
      ["not_relevant", "Not relevant or no need"],
      ["wants_writing", "Wants it in writing"],
      ["declined", "Said no"],
      ["asked_not_to_call", "Do not call again"],
    ],
  },
  {
    title: "Next step",
    guidance: "Agree only to a next step the prospect actually accepted.",
    prompts: [
      "Confirm what, if anything, they would like to happen next.",
      "Repeat the agreed channel or timing to check it is accurate.",
      "If nothing was agreed, record that plainly.",
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
    guidance: "End respectfully and reflect what was agreed, or not agreed.",
    prompts: [
      "Thank them for their time.",
      "Briefly confirm any agreed next step.",
      "Do not treat a polite goodbye as an agreement.",
    ],
    outcomes: [
      ["closed_with_agreement", "Closed with something agreed"],
      ["closed_after_no", "Closed after a no"],
      ["line_dropped", "Line dropped or they hung up"],
    ],
  },
] as const;

type StageDraft = {
  outcome: string | null;
  words: string;
  notes: string;
};

const emptyDraft = (): StageDraft => ({ outcome: null, words: "", notes: "" });

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export default function Home() {
  const [currentStage, setCurrentStage] = useState(0);
  const [furthestStage, setFurthestStage] = useState(0);
  const [drafts, setDrafts] = useState<StageDraft[]>(
    () => stages.map(() => emptyDraft()),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    const updateElapsed = () =>
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const stage = stages[currentStage];
  const draft = drafts[currentStage];
  const updateDraft = (patch: Partial<StageDraft>) => {
    setDrafts((previous) =>
      previous.map((item, index) =>
        index === currentStage ? { ...item, ...patch } : item,
      ),
    );
  };

  const moveToStage = (index: number) => {
    setCurrentStage(index);
    setFurthestStage((furthest) => Math.max(furthest, index));
    setConfirmEnd(false);
  };

  if (ended) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f5f8] px-5 py-12 text-[#16202c]">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2a5bd7]">
            Callframe · demo
          </p>
          <h1 className="mt-5 text-2xl font-semibold">Demo call ended</h1>
          <p className="mt-3 leading-7 text-slate-600">
            This was an in-browser demonstration. No call record or notes were
            saved.
          </p>
          <button
            className="mt-7 min-h-11 rounded-lg bg-[#2a5bd7] px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7]"
            onClick={() => {
              setCurrentStage(0);
              setFurthestStage(0);
              setDrafts(stages.map(() => emptyDraft()));
              setElapsedSeconds(0);
              setEnded(false);
            }}
            type="button"
          >
            Start another demo
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f8] pb-28 text-[#16202c] lg:pb-10">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-xl bg-[#2a5bd7] text-lg font-bold text-white"
            >
              C
            </div>
            <div>
              <p className="font-semibold tracking-tight">Callframe</p>
              <p className="text-xs text-slate-500">Live call workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              Illustrative demo · not saved
            </span>
            <span
              aria-label={`Call duration ${formatDuration(elapsedSeconds)}`}
              className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm tabular-nums"
            >
              {formatDuration(elapsedSeconds)}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8 sm:py-8">
        <section
          aria-label="Illustrative prospect"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Example prospect · replace before a real call
            </p>
            <p className="mt-1 font-semibold">Sample prospect</p>
          </div>
          <p className="text-sm text-slate-600">Example company · Role not set</p>
        </section>

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
              {stages.map((item, index) => {
                const current = index === currentStage;
                const visited = index < furthestStage;
                return (
                  <li key={item.title}>
                    <button
                      aria-current={current ? "step" : undefined}
                      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7] lg:justify-start lg:px-3 ${
                        current
                          ? "bg-[#2a5bd7] font-semibold text-white"
                          : visited
                            ? "bg-blue-50 font-medium text-blue-900 hover:bg-blue-100"
                            : "text-slate-600 hover:bg-slate-100"
                      }`}
                      disabled={index > furthestStage}
                      onClick={() => moveToStage(index)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                          current
                            ? "bg-white/20"
                            : visited
                              ? "bg-blue-100"
                              : "bg-slate-100"
                        }`}
                      >
                        {visited ? "✓" : index + 1}
                      </span>
                      <span className="hidden truncate lg:inline">{item.title}</span>
                      <span className="sr-only lg:hidden">{item.title}</span>
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
            <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
              <p className="text-sm font-semibold text-[#2a5bd7]">
                Stage {currentStage + 1} of {stages.length}
              </p>
              <h1
                className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
                id="stage-heading"
              >
                {stage.title}
              </h1>
              <p className="mt-2 max-w-2xl leading-7 text-slate-600">
                {stage.guidance}
              </p>
            </div>

            <div className="space-y-7 px-5 py-6 sm:px-8 sm:py-7">
              <section aria-labelledby="talking-points-heading">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    className="text-sm font-semibold"
                    id="talking-points-heading"
                  >
                    Suggested talking points
                  </h2>
                  <span className="text-xs text-slate-500">
                    Illustrative prompts · not transcript quotes
                  </span>
                </div>
                <ul className="mt-3 grid gap-2 md:grid-cols-3">
                  {stage.prompts.map((prompt) => (
                    <li
                      className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                      key={prompt}
                    >
                      {prompt}
                    </li>
                  ))}
                </ul>
              </section>

              <fieldset>
                <legend className="text-sm font-semibold">What happened?</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stage.outcomes.map(([key, label]) => {
                    const selected = draft.outcome === key;
                    const restricted = key === "asked_not_to_call";
                    return (
                      <button
                        aria-pressed={selected}
                        className={`min-h-11 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7] ${
                          restricted
                            ? selected
                              ? "border-red-700 bg-red-700 text-white"
                              : "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                            : selected
                              ? "border-[#2a5bd7] bg-blue-50 text-blue-900 ring-1 ring-[#2a5bd7]"
                              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                        }`}
                        key={key}
                        onClick={() =>
                          updateDraft({
                            outcome: selected ? null : key,
                          })
                        }
                        type="button"
                      >
                        {restricted ? "⚠ " : ""}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-5">
                <div>
                  <label
                    className="block text-sm font-semibold"
                    htmlFor="prospect-words"
                  >
                    Their words
                    {currentStage === 4 && (
                      <span className="ml-2 font-normal text-slate-500">
                        · What they said they need, in their words
                      </span>
                    )}
                  </label>
                  <textarea
                    className="mt-2 min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 font-serif text-base leading-7 text-slate-800 placeholder:font-sans placeholder:text-sm placeholder:text-slate-400 focus:border-[#2a5bd7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                    id="prospect-words"
                    maxLength={4000}
                    onChange={(event) =>
                      updateDraft({ words: event.target.value })
                    }
                    placeholder="Record only what the prospect actually said."
                    value={draft.words}
                  />
                  {currentStage === 4 && !draft.words.trim() && (
                    <p className="mt-2 text-sm text-amber-800">
                      Their words have not been captured yet. You can continue
                      without them.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold"
                    htmlFor="caller-notes"
                  >
                    Your note
                    <span className="ml-2 font-normal text-slate-500">
                      · Private caller context
                    </span>
                  </label>
                  <textarea
                    className="mt-2 min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 placeholder:text-slate-400 focus:border-[#2a5bd7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                    id="caller-notes"
                    maxLength={4000}
                    onChange={(event) =>
                      updateDraft({ notes: event.target.value })
                    }
                    placeholder="Add a note for yourself; keep it separate from their words."
                    value={draft.notes}
                  />
                </div>
                <p aria-live="polite" className="text-xs text-slate-500">
                  Draft stays in this page only · not saved to a call record
                </p>
              </div>

              {confirmEnd ? (
                <section
                  aria-labelledby="end-confirm-heading"
                  className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5"
                >
                  <h2 className="font-semibold" id="end-confirm-heading">
                    End this demo call?
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-amber-950">
                    You are on stage {currentStage + 1}, {stage.title}. This
                    demonstration does not save a call record.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="min-h-11 rounded-lg bg-[#16202c] px-4 font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                      onClick={() => setEnded(true)}
                      type="button"
                    >
                      End demo call
                    </button>
                    <button
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7]"
                      onClick={() => setConfirmEnd(false)}
                      type="button"
                    >
                      Return to call
                    </button>
                  </div>
                </section>
              ) : (
                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7] disabled:cursor-not-allowed disabled:text-slate-300"
                    disabled={currentStage === 0}
                    onClick={() => moveToStage(currentStage - 1)}
                    type="button"
                  >
                    Back
                  </button>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      onClick={() => setConfirmEnd(true)}
                      type="button"
                    >
                      End call
                    </button>
                    {currentStage < stages.length - 1 && (
                      <button
                        className="min-h-11 rounded-lg bg-[#2a5bd7] px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5bd7]"
                        onClick={() => moveToStage(currentStage + 1)}
                        type="button"
                      >
                        Next: {stages[currentStage + 1].title}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
