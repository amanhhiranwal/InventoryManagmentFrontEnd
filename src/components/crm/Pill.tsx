"use client";

/**
 * Status and priority pills shared by the Leads, Opportunity and Sales Order
 * lists. Colours are keyed off the canonical status values so the same state
 * always renders the same way on every screen.
 */

const BASE =
  "inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap";

const NEUTRAL =
  "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
const BLUE = "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400";
const AMBER =
  "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400";
const GREEN =
  "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400";
const ROSE = "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400";
const INDIGO =
  "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400";

/** Canonical status -> pill colour, across all three entities. */
const STATUS_TONE: Record<string, string> = {
  // Lead
  NEW: NEUTRAL,
  CONTACTED: BLUE,
  QUALIFIED: GREEN,
  CONVERTED: INDIGO,
  LOST: ROSE,

  // Opportunity
  QUALIFICATION: GREEN,
  REQUIREMENT: BLUE,
  DEMO: BLUE,
  PROPOSAL: AMBER,
  NEGOTIATION: AMBER,
  WON: GREEN,

  // Sales order. DRAFT is shared with Quotation.
  DRAFT: NEUTRAL,
  CONFIRMED: BLUE,
  ON_HOLD: ROSE,
  RELEASED: INDIGO,
  COMPLETED: GREEN,
  CANCELLED: NEUTRAL,

  // Quotation
  SENT: AMBER,
  ACCEPTED: GREEN,
  REJECTED: ROSE,
  EXPIRED: NEUTRAL,
};

/** Display labels keyed off the same canonical values. */
const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Dead",

  QUALIFICATION: "Qualified",
  REQUIREMENT: "Requirement",
  DEMO: "Demo Scheduled",
  PROPOSAL: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Closed Won",

  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  ON_HOLD: "On Hold",
  RELEASED: "Released",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",

  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export function StatusPill({
  status,
  label,
}: {
  status?: string | null;
  /** Overrides the derived label when a page already has its own wording. */
  label?: string;
}) {
  const key = String(status || "").toUpperCase();

  return (
    <span className={`${BASE} ${STATUS_TONE[key] || NEUTRAL}`}>
      {label || STATUS_LABEL[key] || status || "—"}
    </span>
  );
}

const PRIORITY_TONE: Record<string, string> = {
  HIGH: ROSE,
  MEDIUM: BLUE,
  LOW: AMBER,
};

export function PriorityPill({ priority }: { priority?: string | null }) {
  const key = String(priority || "Medium").toUpperCase();

  const label = key.charAt(0) + key.slice(1).toLowerCase();

  return (
    <span
      className={`${BASE} border border-current/20 ${
        PRIORITY_TONE[key] || BLUE
      }`}
    >
      {label}
    </span>
  );
}
