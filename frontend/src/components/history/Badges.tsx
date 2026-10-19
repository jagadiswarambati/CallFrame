import { STATUS_LABELS, outcomeInfo, type DisplayStatus } from "@/lib/callframe";

export function DncBadge() {
  return (
    <span className="badge badge--restricted">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4"></line>
      </svg>
      Do not call
    </span>
  );
}

export function OutcomeChip({ outcome }: { outcome: string | null }) {
  const info = outcomeInfo(outcome);
  if (!info) return <span className="badge badge--partial">No outcome yet</span>;
  return <span className={`badge badge--${info.tone}`}>{info.label}</span>;
}

const statusClass: Record<DisplayStatus, string> = {
  completed: "badge--success",
  ended_early: "badge--partial",
  abandoned: "badge--negative",
  in_progress: "badge--partial",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`badge ${statusClass[status]}`}>{STATUS_LABELS[status]}</span>;
}
