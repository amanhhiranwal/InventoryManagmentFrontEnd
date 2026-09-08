"use client";

import { ReactNode } from "react";

/**
 * KPI card used at the top of the Leads, Opportunity and Sales Order pages.
 *
 * The three pages previously each had their own version of this card with
 * different type scales, navy values and pill colours; this is the single
 * shared implementation.
 */
export default function StatCard({
  label,
  value,
  change,
  positive = true,
  caption = "vs last month",
}: {
  label: string;
  /** Pre-formatted string (e.g. "₹4.82 Cr") or a raw number. */
  value: ReactNode;
  /** Percentage text such as "12.4%". Omit to hide the pill. */
  change?: string;
  positive?: boolean;
  caption?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>

        {change && (
          <span
            className={`
              inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1
              text-[10px] font-bold
              ${
                positive
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-500 dark:bg-rose-950/30 dark:text-rose-400"
              }
            `}
          >
            {positive ? "↗" : "↘"} {change}
          </span>
        )}
      </div>

      <p className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-[#233353] dark:text-white">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>

      {caption && (
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          {caption}
        </p>
      )}
    </div>
  );
}
