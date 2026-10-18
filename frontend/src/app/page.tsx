import Link from "next/link";

const stages = [
  { number: 1, title: "Opening", description: "Reach the right person, introduce yourself, and listen for contact issues." },
  { number: 2, title: "Purpose", description: "Explain why you're calling in clear sentences, then listen for questions." },
  { number: 3, title: "Permission", description: "Capture a clear yes, no, or callback request — silence is not consent." },
  { number: 4, title: "Their Business", description: "Understand the prospect's company and work before pitching." },
  { number: 5, title: "Their Need", description: "Capture the prospect's exact words about their goals or concerns." },
  { number: 6, title: "Objection", description: "Record hesitations or refusals. Do-not-call is a restriction, not an outcome." },
  { number: 7, title: "Next Step", description: "Record one concrete action with a specific time or channel." },
  { number: 8, title: "Close", description: "End respectfully. Confirm the outcome matches what was actually said." },
] as const;

const features = [
  {
    title: "Stage-by-Stage Guidance",
    description: "Each of the eight stages shows context, likely prospect responses from real transcripts, and clear action buttons.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1"></rect>
      </svg>
    ),
  },
  {
    title: "Exact Words Capture",
    description: "A dedicated field stores the prospect's verbatim statements separately from your notes and interpretations.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 17H20"></path>
        <path d="M6.5 17v-14a2.5 2.5 0 0 1 5 0v14"></path>
      </svg>
    ),
  },
  {
    title: "Objection & Outcome Tracking",
    description: "Record objections with dedicated buttons. Do-not-call requests are enforced as restrictions, not ordinary outcomes.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    ),
  },
  {
    title: "Structured Call Closure",
    description: "Close with a validated outcome and required next-step details. Callbacks, documents, and referrals are tracked distinctly.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
    ),
  },
  {
    title: "Call History & Resume",
    description: "Every call is saved with stage reached and outcome. In-progress calls can be resumed. History shows stage, outcome, and next steps.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
  },
  {
    title: "No Automatic Dialing",
    description: "Callframe is a companion screen — you make the call separately. No live transcription, no auto-recording, no CRM bloat.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
      </svg>
    ),
  },
] as const;

const beginnerSteps = [
  {
    step: "Prepare",
    title: "Gather prospect details",
    description: "Before you dial, have the prospect's name and company ready. Role is optional but helpful.",
  },
  {
    step: "Start",
    title: "Create the call record",
    description: "Click 'Start a Call', enter the details, and the timer begins. The workspace opens at Stage 1.",
  },
  {
    step: "Progress",
    title: "Move through stages",
    description: "Tap an outcome button, enter any prospect words or your notes, then click 'Next'. You can go back anytime.",
  },
  {
    step: "Capture",
    title: "Record exact words",
    description: "Use the 'Their words' field for verbatim prospect statements. Use 'Your note' for your interpretation — they stay separate.",
  },
  {
    step: "Handle",
    title: "Respond to objections",
    description: "Stage 6 has buttons for common objections. 'Asked not to be called again' triggers a restricted Do Not Call outcome.",
  },
  {
    step: "Close",
    title: "End with a next step",
    description: "At any stage, click 'End call'. Choose the outcome, fill required next-step details, and save. The record is complete.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden" aria-labelledby="hero-heading">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-ochre-50)_0%,_transparent_70%)]" />
        <div className="container relative py-20 md:py-32 lg:py-40">
          <div className="max-w-4xl mx-auto text-center">
            <p className="caption text-ochre-600 mb-6 fade-in">Browser-based call companion</p>
            <h1 id="hero-heading" className="heading-1 text-espresso-100 mb-6 fade-in" style={{ animationDelay: '100ms' }}>
              Every call. A clearer next step.
            </h1>
            <p className="body-lg text-espresso-500 mb-10 max-w-2xl mx-auto fade-in" style={{ animationDelay: '200ms' }}>
              Callframe helps you guide conversations, understand prospect needs, capture their actual words, handle objections, and leave every call with a concrete next step.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 fade-in" style={{ animationDelay: '300ms' }}>
              <Link href="/workspace" className="btn btn--primary btn--lg w-full sm:w-auto">
                Start a Call
              </Link>
              <Link href="/how-it-works" className="btn btn--secondary btn--lg w-full sm:w-auto">
                See How It Works
              </Link>
            </div>
          </div>

          <div className="mt-20 relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="hidden lg:block w-full max-w-5xl h-px bg-gradient-to-r from-transparent via-espresso-200 to-transparent" />
            </div>
            <div className="relative workflow-preview max-w-5xl mx-auto">
              {stages.map((stage, index) => (
                <div
                  key={stage.number}
                  className={`workflow-stage ${index === 0 ? "workflow-stage--active" : ""}`}
                  data-stage={stage.number.toString()}
                >
                  <div className="workflow-stage-number">{stage.number}</div>
                  <h3 className="workflow-stage-title">{stage.title}</h3>
                  <p className="workflow-stage-desc">{stage.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section section--alt" aria-labelledby="workflow-heading">
        <div className="container">
          <header className="text-center max-w-2xl mx-auto mb-16">
            <h2 id="workflow-heading" className="heading-2 text-espresso-100 mb-4">
              The Eight-Stage Workflow
            </h2>
            <p className="body-lg text-espresso-500">
              A structured sequence based on real call patterns. Each stage has a purpose, guidance, and outcome buttons.
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((stage) => (
              <article key={stage.number} className="card p-6 group">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-ochre-50 flex items-center justify-center group-hover:bg-ochre-100 transition-colors">
                    <span className="text-2xl font-display font-medium text-ochre-700">{stage.number}</span>
                  </div>
                  <div>
                    <h3 className="heading-4 text-espresso-100 mb-2">{stage.title}</h3>
                    <p className="body-sm text-espresso-500">{stage.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="features-heading">
        <div className="container">
          <header className="text-center max-w-2xl mx-auto mb-16">
            <h2 id="features-heading" className="heading-2 text-espresso-100 mb-4">
              Built for the Call, Not the CRM
            </h2>
            <p className="body-lg text-espresso-500">
              Focused tools that help you during the conversation — not after.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="card p-6 group">
                <div className="w-12 h-12 rounded-xl bg-ochre-50 flex items-center justify-center mb-4 group-hover:bg-ochre-100 transition-colors text-ochre-700">
                  {feature.icon}
                </div>
                <h3 className="heading-4 text-espresso-100 mb-2">{feature.title}</h3>
                <p className="body-sm text-espresso-500">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--dark" aria-labelledby="beginner-heading">
        <div className="container">
          <header className="text-center max-w-2xl mx-auto mb-16">
            <p className="caption text-ochre-400 mb-4">New to Callframe?</p>
            <h2 id="beginner-heading" className="heading-2 text-cream-50 mb-4">
              Get Started in Six Steps
            </h2>
            <p className="body-lg text-espresso-700">
              A quick guide for first-time users. No training required.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {beginnerSteps.map((step, index) => (
              <article key={step.step} className="card--dark p-6 relative">
                <span className="absolute -top-3 left-6 px-3 py-1 text-xs font-bold text-ochre-500 bg-espresso-50 rounded-full border border-espresso-300">
                  Step {index + 1}
                </span>
                <div className="pt-4">
                  <h3 className="heading-4 text-cream-50 mb-2">{step.title}</h3>
                  <p className="body-sm text-espresso-700">{step.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/workspace" className="btn btn--accent btn--lg inline-flex">
              Try It Now
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-heading">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="cta-heading" className="heading-2 text-espresso-100 mb-4">
              Ready to make your next call clearer?
            </h2>
            <p className="body-lg text-espresso-500 mb-8">
              Open the workspace, start a call, and see the difference structure makes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/workspace" className="btn btn--primary btn--lg w-full sm:w-auto">
                Start a Call
              </Link>
              <Link href="/how-it-works" className="btn btn--secondary btn--lg w-full sm:w-auto">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}