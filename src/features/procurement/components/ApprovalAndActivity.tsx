"use client";

/* The approval banner and the activity history for procurement records,
 * laid out like the sales order's (ApprovalPanel and its Activity History
 * card), so a requisition or a purchase order reads like the rest of the
 * product. The banner shows where the approval has got to and, for the
 * person whose turn it is, the decision buttons; the history lists what
 * happened, newest first, with "+ Log Activity" for a note with remarks. */

import { ReactNode, useState } from "react";
import { FiAlertTriangle, FiCalendar, FiCheck, FiCheckCircle, FiClock, FiCornerUpLeft, FiX, FiXCircle } from "react-icons/fi";

import { formatDate, formatDateTime } from "@/lib/datetime";

import type { ActivityRow, ApprovalStepRow } from "../api/procurement.api";
import { humanize, money } from "./shared";

export type BannerState = "PENDING" | "APPROVED" | "REJECTED" | "RETURNED";

const TONE: Record<BannerState, string> = {
  PENDING: "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20",
  APPROVED: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",
  REJECTED: "border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20",
  RETURNED: "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20",
};

const HEADING: Record<BannerState, string> = {
  PENDING: "Approval Required",
  APPROVED: "Approved",
  REJECTED: "Not Approved",
  RETURNED: "Sent Back for Changes",
};

const ICON: Record<BannerState, ReactNode> = {
  PENDING: <FiAlertTriangle size={14} className="shrink-0 text-amber-500" />,
  APPROVED: <FiCheckCircle size={15} className="shrink-0 text-emerald-600" />,
  REJECTED: <FiXCircle size={15} className="shrink-0 text-rose-500" />,
  RETURNED: <FiCornerUpLeft size={15} className="shrink-0 text-amber-600" />,
};

/** The approval of a requisition or PO, in the sales order's banner format.
 *  Shows the latest round; earlier rounds' refusals are listed under it. */
export function ApprovalBanner({
  state,
  steps,
  requestedBy,
  requestedAt,
  reason,
  actions,
}: {
  state: BannerState;
  steps: ApprovalStepRow[];
  requestedBy?: string | null;
  requestedAt?: string | null;
  /** One sentence on why it goes where it goes. */
  reason: string;
  /** The decision buttons, for the person whose turn it is. */
  actions?: ReactNode;
}) {
  const round = Math.max(0, ...steps.map((s) => s.round));
  const current = steps.filter((s) => s.round === round).sort((a, b) => a.level - b.level);
  const refusals = steps.filter((s) => s.decision === "REJECTED" || s.decision === "RETURNED");

  return (
    <div className={`rounded-xl border p-4 ${TONE[state]}`}>
      <div className="flex items-center gap-2">
        {ICON[state]}
        <p className="text-[13px] font-semibold text-slate-800 dark:text-white">{HEADING[state]}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[240px] flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Requested by</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[8px] dark:bg-[#17304a]">
                {(requestedBy || "U").charAt(0).toUpperCase()}
              </span>
              {requestedBy || "—"}
            </span>
            {requestedAt && <span>on {formatDateTime(requestedAt)}</span>}
          </p>
          <p className="mt-1.5 max-w-[620px] text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{reason}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {refusals.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/60 bg-white/60 p-3 dark:border-white/10 dark:bg-[#0b2034]/60">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Previous decisions to note</p>
          {refusals.map((step) => (
            <div key={step.id} className="mt-2 flex gap-2">
              {step.decision === "REJECTED" ? (
                <FiX size={11} className="mt-0.5 shrink-0 text-rose-500" />
              ) : (
                <FiCornerUpLeft size={11} className="mt-0.5 shrink-0 text-amber-600" />
              )}
              <div>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  {step.decision === "REJECTED" ? "Rejected" : "Sent back"} by {step.decided_by_name || step.step_label}
                  {step.decided_at ? `, ${formatDateTime(step.decided_at)}` : ""}
                </p>
                {step.remarks && (
                  <p className="mt-0.5 text-[11px] italic leading-relaxed text-slate-500 dark:text-slate-400">
                    &ldquo;{step.remarks}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {current.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {current.map((step) => {
            const chip =
              step.decision === "APPROVED"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : step.decision === "REJECTED" || step.decision === "RETURNED"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                  : step.decision === "PENDING"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                    : "bg-white/70 text-slate-400 dark:bg-[#0b2034]";
            return (
              <span
                key={step.id}
                title={step.remarks || undefined}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${chip}`}
              >
                {step.decision === "APPROVED" ? (
                  <FiCheck size={9} />
                ) : step.decision === "REJECTED" || step.decision === "RETURNED" ? (
                  <FiX size={9} />
                ) : step.decision === "PENDING" ? (
                  <FiClock size={9} />
                ) : null}
                {step.step_label}
                <span className="font-normal opacity-70">· {step.decided_by_name || step.approver_label}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A readable line for an entry the system wrote without remarks. */
function describe(row: ActivityRow): string | null {
  if (row.remarks) return row.remarks;
  const v = (row.new_value || {}) as Record<string, unknown>;
  if (typeof v.next === "string") return `Waiting on the ${v.next}.`;
  if (Array.isArray(v.chain)) return `Goes to ${(v.chain as string[]).join(", then ")}.`;
  if (typeof v.po === "string")
    return `${v.po}${v.vendor ? ` to ${v.vendor}` : ""}${typeof v.total === "number" ? ` for ${money(v.total)}` : ""}.`;
  if (typeof v.reference === "string" && Array.isArray(v.vendors)) return `${v.reference}: ${(v.vendors as string[]).join(", ")}.`;
  if (typeof v.assigned_to === "string") return `Assigned to ${v.assigned_to}.`;
  if (typeof v.instalment === "string") return `${v.instalment}: ${humanize(String(v.status || ""))}${typeof v.amount === "number" ? `, ${money(v.amount)}` : ""}.`;
  if (typeof v.procurement_status === "string") return `Now ${humanize(v.procurement_status)}.`;
  if (typeof v.status === "string") return `Now ${humanize(v.status)}.`;
  return null;
}

const ACTIVITY_TYPES = ["Note", "Call", "Email", "Meeting", "Follow-up", "Site Visit"];

/** The activity history card, with + Log Activity. */
export function ActivityHistory({
  rows,
  onLog,
}: {
  rows?: ActivityRow[];
  /** Saves a hand-logged entry; resolves true when it was saved. Omit to hide the button. */
  onLog?: (activity: string, remarks: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState("Note");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!onLog || !remarks.trim()) return;
    setSaving(true);
    try {
      if (await onLog(activity, remarks.trim())) {
        setRemarks("");
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 dark:border dark:border-[#17304a] dark:bg-[#071929]">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-[#f3f3f3] pb-3 dark:border-[#17304a]">
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-[#474747] dark:text-white">
          <FiClock size={15} /> Activity History
        </h2>
        {onLog && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-[11px] font-medium text-slate-500 hover:text-[#233353] dark:hover:text-white"
          >
            {open ? "Cancel" : "+ Log Activity"}
          </button>
        )}
      </div>

      {open && onLog && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#17304a] dark:bg-[#0b2034]"
        >
          <label className="block text-[11px] text-slate-500" htmlFor="log-activity-type">Activity</label>
          <select
            id="log-activity-type"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="block text-[11px] text-slate-500" htmlFor="log-activity-remarks">Remarks *</label>
          <textarea
            id="log-activity-remarks"
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="What happened - who you spoke to, what was agreed"
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !remarks.trim()}
              className="h-8 rounded-lg bg-[#273756] px-3 text-[12px] font-semibold text-white hover:bg-[#18243a] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Activity"}
            </button>
          </div>
        </form>
      )}

      {!rows?.length ? (
        <p className="py-3 text-[12px] text-slate-400">No activity recorded yet.</p>
      ) : (
        <ol className="relative ml-1 max-h-[560px] overflow-y-auto border-l border-slate-200 pl-4 pr-1 dark:border-[#17304a]">
          {rows.map((row, index) => {
            const text = describe(row);
            return (
              <li key={row.id} className="relative mb-4 last:mb-0">
                <span
                  className={`absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#071929] ${
                    index === 0 ? "bg-[#233353]" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#17304a] dark:bg-[#0b1d2e]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-bold text-slate-800 dark:text-white">{row.action}</p>
                    <span className="shrink-0 text-[10px] text-slate-400">{row.created_at ? formatDate(row.created_at) : ""}</span>
                  </div>
                  {text && <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{text}</p>}
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                    <FiCalendar size={9} />
                    {row.created_at ? formatDateTime(row.created_at) : "—"}
                    {row.actor_name ? ` • ${row.actor_name}` : ""}
                    {row.entity_type === "purchase_order" && (
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:bg-[#0b2034]">PO</span>
                    )}
                    {row.entity_type === "quotation" && (
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:bg-[#0b2034]">Quotation</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
