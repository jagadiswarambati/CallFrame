import Link from "next/link";

const features = [
  {
    category: "Core Workflow",
    items: [
      {
        title: "Eight-Stage Guided Workflow",
        description: "Opening → Purpose → Permission → Their Business → Their Need → Objection → Next Step → Close. Each stage has a clear purpose, guidance, and outcome buttons.",
        status: "implemented",
      },
      {
        title: "Stage Navigation",
        description: "Visual progress indicator in the sidebar. Click any visited stage to jump back. Future stages disabled until reached. Mobile-friendly stepper.",
        status: "implemented",
      },
      {
        title: "Transcript Examples",
        description: "Three verbatim prospect quotes per stage from real call transcripts, with call ID, speaker, and logged outcome for traceability.",
        status: "implemented",
      },
      {
        title: "Guidance Prompts",
        description: "Contextual tips for each stage: what to say, what to listen for, and how to handle common situations.",
        status: "implemented",
      },
    ],
  },
  {
    category: "Capture & Recording",
    items: [
      {
        title: "Dual-Field Capture",
        description: "Separate 'Their words' (serif, for verbatim prospect statements) and 'Your note' (sans, for caller interpretation) at every stage.",
        status: "implemented",
      },
      {
        title: "Stage 5 Emphasis",
        description: "Larger 'Their words' field labelled 'What they said they need, in their words' — the primary capture point for prospect needs.",
        status: "implemented",
      },
      {
        title: "Auto-Save with Status",
        description: "Debounced saves (700ms) on blur or navigation. Live status: Saving…, Saved, Not saved (with Retry), or No unsaved changes.",
        status: "implemented",
      },
      {
        title: "4,000 Character Limits",
        description: "All text fields enforce 4,000 character maximum at UI, API, and database levels.",
        status: "implemented",
      },
      {
        title: "Revision History",
        description: "Every stage edit creates a new revision (call_id, stage, revision). Previous revisions are preserved.",
        status: "implemented",
      },
    ],
  },
  {
    category: "Outcomes & Compliance",
    items: [
      {
        title: "Structured Outcome Selection",
        description: "Stage-specific outcome chips (5–6 per stage). Single-choice, re-tap to clear. Restricted Do Not Call button at Stage 6 with warning icon.",
        status: "implemented",
      },
      {
        title: "Do Not Call Enforcement",
        description: "Selecting 'Asked not to be called again' at Stage 6 requires exact words, blocks next steps, prevents future calls to same name/company, disables AI.",
        status: "implemented",
      },
      {
        title: "Validated Call Closure",
        description: "Close panel shows suggested outcome based on recorded data. Requires next-step details (time, channel, person) per outcome type. Early ending at any stage supported.",
        status: "implemented",
      },
      {
        title: "Outcome Categories",
        description: "Success (Call/meeting agreed), Partial (Document, Callback, Referral), Negative (Declined, Wrong contact, No contact), Restricted (Do not call). Clear visual distinction.",
        status: "implemented",
      },
      {
        title: "No False Successes",
        description: "Document requests, callbacks, and referrals are explicitly labelled 'Partial' — never counted as success.",
        status: "implemented",
      },
    ],
  },
  {
    category: "History & Resume",
    items: [
      {
        title: "In-Progress Resume",
        description: "Call ID stored in localStorage. On return, workspace restores the call with all stage data, last stage, and timer.",
        status: "implemented",
      },
      {
        title: "Call Summary",
        description: "After closing: outcome, stage reached, next step, Stage 5 words displayed. 'Start another call' button.",
        status: "implemented",
      },
      {
        title: "History API",
        description: "GET /api/calls returns paginated list with prospect, company, stage, outcome, status, next step. Used by the History page.",
        status: "implemented",
      },
      {
        title: "Detail API",
        description: "GET /api/calls/:id returns full call with all stage revisions (latest per stage) for detail views.",
        status: "implemented",
      },
    ],
  },
  {
    category: "AI Assistance (Optional)",
    items: [
      {
        title: "On-Demand Suggestions",
        description: "Click 'Suggest what to say' at any stage. Sends the current stage context (outcome, words, notes) to Gemini. Returns one short spoken line of at most 40 words.",
        status: "implemented",
      },
      {
        title: "Safety Controls",
        description: "Prospect words are passed as delimited data, not free instructions. Hard block on Do Not Call calls. Rate-limited. Suggestion is clearly labelled 'AI suggestion, not the prospect's words'.",
        status: "implemented",
      },
      {
        title: "No Auto-Insertion",
        description: "AI text never writes to prospect words or caller notes. Results are stored separately in the ai_suggestions table and shown in call history.",
        status: "implemented",
      },
    ],
  },
  {
    category: "Technical & UX",
    items: [
      {
        title: "Cold-Start Handling",
        description: "Detects sleeping backend (free tier). Shows warming banner with progress, polls /health every 3s, enables Start when ready.",
        status: "implemented",
      },
      {
        title: "Reduced Motion Support",
        description: "Respects prefers-reduced-motion. Disables pulse animations and slide transitions.",
        status: "implemented",
      },
      {
        title: "Keyboard Accessible",
        description: "Focus-visible outlines, logical tab order, arrow keys in chip groups, Enter/Space to select.",
        status: "implemented",
      },
      {
        title: "Responsive Design",
        description: "Desktop: sidebar + workspace. Mobile: collapsible stepper, stacked actions, touch-friendly targets (44×44px minimum).",
        status: "implemented",
      },
      {
        title: "Error Handling",
        description: "Validation errors with field-level messages. Network errors show Retry. Server errors don't lose local draft data.",
        status: "implemented",
      },
      {
        title: "Multi-Language Ready",
        description: "Text fields accept any Unicode script (no English-only assumptions). Serif font for prospect words supports diverse scripts.",
        status: "implemented",
      },
    ],
  },
] satisfies Array<{
  category: string;
  items: ReadonlyArray<{
    title: string;
    description: string;
    status: "implemented" | "planned";
  }>;
}>;

const notImplemented = [
  "Live transcription or audio recording",
  "Automatic dialing or click-to-call",
  "CRM integration (Salesforce, HubSpot, etc.)",
  "Team workspaces or multi-user accounts",
  "Scheduled follow-ups or reminders",
  "Reporting dashboard or analytics",
  "Email/WhatsApp automation",
  "Call recording playback",
  "Speaker diarization",
  "Sentiment analysis",
  "Automatic outcome detection",
  "Lead scoring",
] as const;

export default function FeaturesPage() {
  return (
    <>
      <section className="section section--dark" aria-labelledby="features-heading">
        <div className="container">
          <header className="max-w-3xl mx-auto text-center mb-16">
            <h1 id="features-heading" className="heading-1 text-cream-50 mb-6">
              Features
            </h1>
            <p className="body-lg text-espresso-700">
              Everything Callframe does today, what&apos;s planned, and what it explicitly does not do.
            </p>
          </header>

          <div className="space-y-16 max-w-5xl mx-auto">
            {features.map((group) => (
              <section key={group.category} className="space-y-6">
                <header className="pb-4 border-b border-espresso-300">
                  <h2 className="heading-2 text-cream-50">{group.category}</h2>
                </header>
                <div className="grid gap-6 md:grid-cols-2">
                  {group.items.map((feature) => {
                    const isPlanned = (feature.status as string) === "planned";
                    return (
                      <article
                        key={feature.title}
                        className={`card--dark p-6 relative ${isPlanned ? "opacity-70" : ""}`}
                      >
                        {isPlanned && (
                          <span className="absolute -top-2 right-2 badge badge--partial text-xs">Planned</span>
                        )}
                        <h3 className="heading-4 text-cream-50 mb-2">{feature.title}</h3>
                        <p className="body text-espresso-700">{feature.description}</p>
                        <div className="mt-4 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${!isPlanned ? "bg-green-500" : "bg-ochre-500"}`} />
                          <span className="caption text-espresso-500 capitalize">{feature.status}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="pt-8 border-t border-espresso-300" aria-labelledby="not-implemented-heading">
              <header className="mb-8">
                <h2 id="not-implemented-heading" className="heading-2 text-cream-50 mb-2">
                  What Callframe Does Not Do
                </h2>
                <p className="body text-espresso-700">
                  These capabilities are intentionally not included. Callframe is a focused call companion, not a CRM or automation platform.
                </p>
              </header>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {notImplemented.map((item) => (
                  <div
                    key={item}
                    className="p-4 rounded-lg bg-espresso-100 border border-espresso-300 text-espresso-100 body-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-heading">
        <div className="container text-center">
          <h2 id="cta-heading" className="heading-2 text-espresso-100 mb-4">
            See it in action
          </h2>
          <p className="body-lg text-espresso-500 mb-8">
            The best way to understand Callframe is to use it.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/workspace" className="btn btn--primary btn--lg">
              Start a Call
            </Link>
            <Link href="/how-it-works" className="btn btn--secondary btn--lg">
              See the Workflow
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}