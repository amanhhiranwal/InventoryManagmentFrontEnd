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
  compact = false,
}: {
  label: string;
  /** Pre-formatted string (e.g. "₹4.82 Cr") or a raw number. */
  value: ReactNode;
  /** Percentage text such as "12.4%". Omit to hide the pill. */
  change?: string;
  positive?: boolean;
  caption?: string;
  /** Narrow card for a six-across row (Quotation): smaller type, and the
      pill sits flush against the card's right edge as in the design. */
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white dark:border-[#17304a] dark:bg-[#071929] ${
        compact ? "py-4 pl-4" : "p-5"
      }`}
    >
      <div
        className={`flex items-start justify-between ${
          compact ? "gap-1" : "gap-2"
        }`}
      >
        <p
          className={`whitespace-nowrap text-slate-500 dark:text-slate-400 ${
            compact ? "text-[11px]" : "text-xs"
          }`}
        >
          {label}
        </p>

        {change && (
          <span
            className={`
              inline-flex shrink-0 items-center gap-0.5 font-bold
              ${
                compact
                  ? "rounded-l-md px-1 py-0.5 text-[9px]"
                  : "gap-1 rounded-md px-1.5 py-1 text-[10px]"
              }
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

      <p
        className={`font-semibold leading-tight tracking-tight text-[#233353] dark:text-white ${
          compact ? "mt-2 pr-4 text-[22px]" : "mt-2 text-[28px]"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>

      {caption && (
        <p
          className={`mt-1 text-[10px] ${
            change
              ? positive
                ? "text-emerald-500"
                : "text-rose-500"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
