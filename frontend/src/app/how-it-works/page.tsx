import Link from "next/link";

const stages = [
  {
    number: 1,
    title: "Opening",
    purpose: "Identify the right person and introduce the caller.",
    detail: [
      "Confirm you've reached the intended prospect.",
      "Introduce yourself and your organisation clearly.",
      "Listen for transfers, wrong numbers, or availability issues.",
    ],
    example: {
      speaker: "Prospect",
      text: "I am not in Fairline anymore. I left last year.",
      context: "Call T038 — the prospect has moved companies.",
    },
    outcomes: [
      "Reached the right person",
      "Assistant or switchboard",
      "Not available now",
      "Wrong number or left the company",
      "Bad line or language barrier",
    ],
  },
  {
    number: 2,
    title: "Purpose",
    purpose: "Explain why you're calling in clear, simple terms.",
    detail: [
      "State the reason for the call in one or two sentences.",
      "Avoid claims you cannot support.",
      "Listen for questions about the purpose or how you got their number.",
    ],
    example: {
      speaker: "Prospect",
      text: "Sorry, I didn't get you. You are calling from where?",
      context: "Call T014 — the prospect asks for clarification.",
    },
    outcomes: [
      "Heard the purpose",
      "Asked what we do",
      "Asked where we got the number",
      "Said it sounds like a sales call",
    ],
  },
  {
    number: 3,
    title: "Permission",
    purpose: "Establish whether the prospect can talk now — silence is not consent.",
    detail: [
      "Ask explicitly if they're willing and available to continue.",
      "Listen for a clear yes, no, or callback request.",
      "If they ask for another time, record the callback request.",
    ],
    example: {
      speaker: "Prospect",
      text: "Can you call me in an hour?",
      context: "Call T005 — the prospect requests a callback.",
    },
    outcomes: [
      "Agreed to talk now",
      "Asked for a callback",
      "Wants it sent first",
      "Did not answer clearly",
      "Declined to talk",
    ],
  },
  {
    number: 4,
    title: "Their Business",
    purpose: "Understand the prospect's company and work before pitching.",
    detail: [
      "Invite them to describe their company or work.",
      "Listen for the terms they use and what they emphasise.",
      "Check your understanding rather than filling in gaps.",
    ],
    example: {
      speaker: "Prospect",
      text: "We cater more to the steel industry: steel, cement, hydro power, wind.",
      context: "Call T090 — the prospect describes their business focus.",
    },
    outcomes: [
      "Described their business",
      "One line, then waited",
      "Corrected what we assumed",
      "Asked about us first",
    ],
  },
  {
    number: 5,
    title: "Their Need, in Their Words",
    purpose: "Capture the prospect's exact statement — keep your interpretation separate.",
    detail: [
      "Listen for the goal, concern, or priority they actually name.",
      "Do not paraphrase in the prospect-words field.",
      "If they don't identify a need, record that without inference.",
    ],
    example: {
      speaker: "Prospect",
      text: "Nowadays my customers are more and more into sustainability.",
      context: "Call T093 — the prospect states a goal in their own words.",
    },
    outcomes: [
      "Named a goal or problem",
      "Says all is fine",
      "Asked what we can do for them",
      "Unclear or no answer",
    ],
  },
  {
    number: 6,
    title: "Objection",
    purpose: "Record the reason for hesitation or refusal — respect the boundary.",
    detail: [
      "Listen for the specific concern before responding.",
      "Acknowledge a refusal without pressure.",
      "A do-not-call request is a restriction, not a sales outcome.",
    ],
    example: {
      speaker: "Prospect",
      text: "I am not the right person to give you the data, because my CFO takes care of all those things.",
      context: "Call T024 — the prospect refers to another person.",
    },
    outcomes: [
      "Already has a team or consultant",
      "Not the right person",
      "Not relevant or no need",
      "Wants it in writing",
      "Said no",
      "Asked not to be called again (restricted)",
    ],
  },
  {
    number: 7,
    title: "Next Step",
    purpose: "Record one concrete action with a specific time or channel.",
    detail: [
      "Confirm what the prospect explicitly agreed to.",
      "Capture a specific time, channel, or person where applicable.",
      "If nothing was agreed, record that rather than implying a commitment.",
    ],
    example: {
      speaker: "Prospect",
      text: "Give me a call sometime on Tuesday morning.",
      context: "Call T060 — the prospect names a specific time.",
    },
    outcomes: [
      "Agreed to receive a document",
      "Named a time to talk",
      "Agreed to a meeting",
      "Referred us to someone",
      "Nothing agreed",
    ],
  },
  {
    number: 8,
    title: "Close",
    purpose: "End respectfully — ensure the outcome matches what was actually said.",
    detail: [
      "Confirm the agreed action, if there is one.",
      "Keep a callback, document request, or referral distinct from a success.",
      "The Stage 5 words remain the prospect's exact statement.",
    ],
    example: {
      speaker: "Prospect",
      text: "Let me understand first whether I'll be able to manage your requirement or not.",
      context: "Call T099 — the prospect expresses uncertainty.",
    },
    outcomes: [
      "Closed with something agreed",
      "Closed after a no",
      "Line dropped or they hung up",
    ],
  },
] as const;

const permissionOutcomes = [
  {
    outcome: "Agreed to talk now",
    description: "The prospect explicitly says yes and engages in the conversation. This is the only outcome that allows you to proceed naturally to the next stages.",
  },
  {
    outcome: "Asked for a callback",
    description: "The prospect wants you to call back at a specific time. Record the time they requested. This ends the current call with a 'Callback requested' outcome.",
  },
  {
    outcome: "Wants it sent first",
    description: "The prospect asks for information (document, WhatsApp, email) before committing to a conversation. This ends the call with a 'Document requested' outcome — not a success.",
  },
  {
    outcome: "Did not answer clearly",
    description: "The prospect gives an ambiguous response, keeps talking without committing, or deflects. This is not permission. You may try once more to clarify, but do not treat silence or ambiguity as a yes.",
  },
  {
    outcome: "Declined to talk",
    description: "The prospect explicitly says no, says they're not interested, or otherwise refuses. This ends the call with a 'Declined' outcome. Respect the refusal.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <section className="section section--dark" aria-labelledby="how-it-works-heading">
        <div className="container">
          <header className="max-w-3xl mx-auto text-center mb-16">
            <p className="caption text-ochre-400 mb-4">How It Works</p>
            <h1 id="how-it-works-heading" className="heading-1 text-cream-50 mb-6">
              Eight stages. One clear path.
            </h1>
            <p className="body-lg text-espresso-700">
              Callframe guides you through every call with a structured sequence based on real conversation patterns.
              Each stage has a clear purpose, likely prospect responses, and outcome buttons that map to real outcomes.
            </p>
          </header>

          <div className="space-y-12 md:space-y-16">
            {stages.map((stage) => (
              <article
                key={stage.number}
                className="grid gap-6 md:grid-cols-[1fr_2fr] lg:grid-cols-[1fr_3fr] items-start"
              >
                <div className="text-center md:text-right lg:pr-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-ochre-500 text-cream-50 font-display font-medium text-3xl md:text-4xl mb-4 flex-shrink-0 mx-auto md:mx-0 md:ml-auto">
                    {stage.number}
                  </div>
                  <h2 className="heading-3 text-cream-50 mb-2">{stage.title}</h2>
                  <p className="body text-espresso-700"><strong>Purpose:</strong> {stage.purpose}</p>
                </div>

                <div className="space-y-4">
                  <div className="card p-6">
                    <h3 className="heading-4 text-espresso-100 mb-3">What to do</h3>
                    <ul className="space-y-2">
                      {stage.detail.map((item, index) => (
                        <li key={index} className="body-sm text-espresso-500 flex items-start gap-2">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="card p-6">
                    <h3 className="heading-4 text-espresso-100 mb-3">Example from transcripts</h3>
                    <blockquote className="font-display italic text-espresso-100 mb-2">&ldquo;{stage.example.text}&rdquo;</blockquote>
                    <p className="caption text-espresso-500">{stage.example.context}</p>
                  </div>

                  <div className="card p-6">
                    <h3 className="heading-4 text-espresso-100 mb-3">Possible outcomes</h3>
                    <div className="flex flex-wrap gap-2">
                      {stage.outcomes.map((outcome, index) => (
                        <span key={index} className="badge badge--partial">{outcome}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className="mt-20 pt-16 border-t border-espresso-300" aria-labelledby="permission-heading">
            <header className="max-w-3xl mx-auto text-center mb-12">
              <h2 id="permission-heading" className="heading-2 text-cream-50 mb-4">
                Understanding Permission Stage Outcomes
              </h2>
              <p className="body-lg text-espresso-700">
                Stage 3 (Permission) is critical &mdash; it determines whether the conversation continues.
                Only an explicit &ldquo;yes&rdquo; allows you to proceed. Everything else ends or pauses the call.
              </p>
            </header>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {permissionOutcomes.map((item, index) => (
                <article key={item.outcome} className="card--dark p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-ochre-500 flex items-center justify-center text-cream-50 font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="heading-4 text-cream-50 mb-2">{item.outcome}</h3>
                      <p className="body-sm text-espresso-700">{item.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 p-6 rounded-xl bg-espresso-100 border border-espresso-300">
              <h3 className="heading-4 text-cream-50 mb-3">⚠ Do Not Call Requests</h3>
              <p className="body text-espresso-700 mb-3">
                If a prospect explicitly asks not to be called again, select &ldquo;Asked not to be called again&rdquo; at Stage 6.
                This triggers a restricted outcome that:
              </p>
              <ul className="space-y-2 text-espresso-700">
                <li className="flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Requires the prospect&apos;s exact words to be recorded</li>
                <li className="flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Blocks any next step from being added</li>
                <li className="flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Prevents future calls to the same name and company</li>
                <li className="flex items-start gap-2"><span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-ochre-500 mt-1.5" />Disables AI assistance for that call</li>
              </ul>
              <p className="mt-3 body-sm text-espresso-500">
                An ordinary refusal (&ldquo;not interested&rdquo;, &ldquo;we have a team&rdquo;) is <strong>never</strong> automatically upgraded to do-not-call.
              </p>
            </div>
          </section>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-heading">
        <div className="container text-center">
          <h2 id="cta-heading" className="heading-2 text-espresso-100 mb-4">
            Ready to try it?
          </h2>
          <p className="body-lg text-espresso-500 mb-8 max-w-2xl mx-auto">
            Open the workspace and start a call. The structure will guide you through each stage.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/workspace" className="btn btn--primary btn--lg">
              Start a Call
            </Link>
            <Link href="/help" className="btn btn--secondary btn--lg">
              Read the Help Guide
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}