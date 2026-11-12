"use client";

/* The top of every procurement detail page: where you came from, what the
 * record is, its status, what you can do, and the few figures people open
 * it to see. Plus the track that shows how far a requisition has got. */

import Link from "next/link";
import { ReactNode } from "react";
import { FiArrowLeft, FiCheck } from "react-icons/fi";

import type { Requisition } from "../api/procurement.api";

export function DetailHeader({
  back,
  title,
  status,
  subtitle,
  actions,
  facts = [],
}: {
  back: { href: string; label: string };
  title: string;
  status?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Three to five key figures, shown in a row under the title. */
  facts?: { label: string; value: ReactNode }[];
}) {
  return (
    <header className="rounded-xl bg-white p-5 dark:border dark:border-[#17304a] dark:bg-[#071929]">
      <Link href={back.href} className="inline-flex items-center gap-1 text-[12px] text-[#777777] hover:text-[#233353] dark:hover:text-white">
        <FiArrowLeft size={12} /> {back.label}
      </Link>

      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-semibold text-slate-900 dark:text-white">{title}</h1>
            {status}
          </div>
          {subtitle && <p className="mt-0.5 text-[13px] text-[#555555] dark:text-slate-300">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>}
      </div>

      {facts.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#f3f3f3] pt-4 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-x-10 dark:border-[#17304a]">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[11px] text-[#777777] dark:text-slate-400">{fact.label}</dt>
              <dd className="mt-0.5 break-words text-[14px] font-medium text-[#141414] dark:text-slate-100">{fact.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}

const STAGES = ["Raised", "Approval", "With procurement", "Quotations", "PO approval", "PO raised"] as const;

const PROCUREMENT_STAGE: Record<string, number> = {
  AWAITING_PROCUREMENT: 2,
  ASSIGNED: 2,
  IN_PROGRESS: 2,
  ON_HOLD: 2,
  QUOTATION_COLLECTION: 3,
  QUOTATIONS_RECEIVED: 3,
  COMPARISON_IN_PROGRESS: 3,
  PO_APPROVAL_PENDING: 4,
  PO_GENERATED: 5,
  COMPLETED: 5,
};

/** Where the requisition is, and whether it has stopped there. */
function position(pr: Requisition): { stage: number; done: boolean; stopped?: string } {
  if (pr.status === "DRAFT") return { stage: 0, done: false };
  if (pr.status === "PENDING_APPROVAL") return { stage: 1, done: false };
  if (pr.status === "RETURNED") return { stage: 1, done: false, stopped: "Sent back for changes" };
  if (pr.status === "REJECTED") return { stage: 1, done: false, stopped: "Rejected" };
  if (pr.status === "CANCELLED") return { stage: pr.submitted_at ? 1 : 0, done: false, stopped: "Cancelled" };

  const p = pr.procurement_status || "AWAITING_PROCUREMENT";
  if (p === "CANCELLED") return { stage: 2, done: false, stopped: "Procurement cancelled" };
  const stage = PROCUREMENT_STAGE[p] ?? 2;
  return {
    stage,
    done: p === "PO_GENERATED" || p === "COMPLETED",
    stopped: p === "ON_HOLD" ? "On hold" : undefined,
  };
}

/** A requisition's progress from raised to purchase order. */
export function ProcurementTrack({ pr }: { pr: Requisition }) {
  const { stage, done, stopped } = position(pr);

  return (
    <section aria-label="Progress" className="rounded-xl bg-white px-5 py-4 dark:border dark:border-[#17304a] dark:bg-[#071929]">
      {/* Phone: the current step in words over a segmented bar. */}
      <div className="md:hidden">
        <p className="text-[13px] text-[#141414] dark:text-slate-200">
          Step {stage + 1} of {STAGES.length}: <span className="font-semibold">{STAGES[stage]}</span>
          {stopped && <span className="ml-1 font-semibold text-rose-600">({stopped})</span>}
        </p>
        <div className="mt-2 grid grid-cols-6 gap-1" aria-hidden>
          {STAGES.map((label, i) => (
            <span
              key={label}
              className={`h-1.5 rounded-full ${
                i < stage || (done && i === stage) ? "bg-[#233353] dark:bg-sky-400" : i === stage ? (stopped ? "bg-rose-500" : "bg-[#233353]/40") : "bg-slate-200 dark:bg-[#17304a]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Tablet up: every stage, with the one it is at marked. */}
      <ol className="hidden grid-cols-6 md:grid">
        {STAGES.map((label, i) => {
          const passed = i < stage || (done && i === stage);
          const current = i === stage && !done;
          return (
            <li key={label} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${i <= stage ? "bg-[#233353] dark:bg-sky-400" : "bg-slate-200 dark:bg-[#17304a]"}`}
                />
              )}
              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  passed
                    ? "bg-[#233353] text-white dark:bg-sky-500"
                    : current
                      ? stopped
                        ? "border-2 border-rose-500 bg-white text-rose-600 dark:bg-[#071929]"
                        : "border-2 border-[#233353] bg-white text-[#233353] dark:border-sky-400 dark:bg-[#071929] dark:text-sky-300"
                      : "border border-slate-300 bg-white text-slate-400 dark:border-[#17304a] dark:bg-[#071929]"
                }`}
              >
                {passed ? <FiCheck size={12} /> : i + 1}
              </span>
              <span className={`mt-1.5 px-1 text-[11px] leading-tight ${current ? "font-semibold text-[#141414] dark:text-white" : "text-[#777777] dark:text-slate-400"}`}>
                {label}
              </span>
              {current && stopped && <span className="text-[10px] font-semibold text-rose-600">{stopped}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
