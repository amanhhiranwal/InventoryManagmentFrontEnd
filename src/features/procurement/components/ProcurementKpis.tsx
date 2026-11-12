"use client";

/* The procurement KPIs, as the server works them out, in one row of eight
 * at desktop width (four across on a tablet, two on a phone). Each card
 * says what it measures and how many records it rests on; a figure with
 * nothing behind it shows a dash, never a zero that looks like a result. */

import { useCallback, useEffect, useState } from "react";

import { errorDetail, getProcurementAnalyticsApi, type ProcurementAnalytics } from "../api/procurement.api";

const PERIODS = [30, 90, 365] as const;

/** ₹ in lakh / crore, the way the business reads large sums. */
const compact = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

/** The row while the figures are on their way, so the layout does not jump. */
const LOADING = [
  "Open PRs", "Overdue", "Approval Cycle", "PR to PO",
  "PO Spend", "PO Approval", "Competitive", "Quotes per PR",
].map((label) => ({ label, value: "—", caption: "loading" }));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The figure, or a dash when there was nothing to measure it from. */
const or = <T,>(value: T | null, show: (v: T) => string) => (value === null ? "—" : show(value));

export default function ProcurementKpis({ refreshKey = 0 }: { refreshKey?: number }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(90);
  const [data, setData] = useState<ProcurementAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getProcurementAnalyticsApi(days));
    } catch (failure) {
      setData(null);
      setError(errorDetail(failure, "Could not load the procurement KPIs."));
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const d = data;

  const cards: { label: string; value: string | number; caption: string }[] = d
    ? [
        { label: "Open PRs", value: d.open_pipeline.count, caption: "approved, being sourced" },
        {
          label: "Overdue",
          value: d.overdue.count,
          caption: d.overdue.percent === null ? "no open PRs" : `${d.overdue.percent}% of open PRs`,
        },
        {
          label: "Approval Cycle",
          value: or(d.approval_cycle.days, (v) => `${v} d`),
          caption: `submit → approved, ${plural(d.approval_cycle.basis, "PR")}`,
        },
        {
          label: "PR to PO",
          value: or(d.sourcing_cycle.days, (v) => `${v} d`),
          caption: `approval → first PO, ${plural(d.sourcing_cycle.basis, "PR")}`,
        },
        { label: "PO Spend", value: compact(d.po_spend.value), caption: `${plural(d.po_spend.count, "PO")}, excl. cancelled` },
        {
          label: "PO Approval",
          value: or(d.po_approval_cycle.days, (v) => `${v} d`),
          caption: `avg submit → approved, ${plural(d.po_approval_cycle.basis, "PO")}`,
        },
        {
          label: "Competitive",
          value: or(d.competitive_rate.percent, (v) => `${v}%`),
          caption: `POs with 3+ vendors quoting, of ${d.competitive_rate.basis}`,
        },
        {
          label: "Quotes per PR",
          value: or(d.quotes_per_pr.average, (v) => v.toFixed(1)),
          caption: `avg vendors, ${plural(d.quotes_per_pr.basis, "PR")}`,
        },
      ]
    : [];

  return (
    <section aria-label="Procurement KPIs" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-[#777777] dark:text-slate-400">
          Open work is as of today; cycle times and spend cover the{" "}
          {days === 365 ? "last 12 months" : `last ${days} days`}.
        </p>
        <div role="group" aria-label="KPI period" className="flex rounded-lg bg-white p-0.5 dark:bg-[#071929]">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => setDays(p)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                days === p
                  ? "bg-[#233353] text-white"
                  : "text-[#777777] hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {p === 365 ? "12 months" : `${p} days`}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-white px-5 py-4 text-[13px] text-rose-600 dark:bg-[#071929] dark:text-rose-400">
          {error}{" "}
          <button type="button" onClick={load} className="font-medium underline">Try again</button>
        </p>
      ) : (
        /* Eight across from tablet width up. The cards are narrow there
           (about 95px on a laptop beside the sidebar), so the value scales
           with the viewport and the label and caption may wrap rather
           than push the row wider than the page. */
        <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-8">
          {(cards.length ? cards : LOADING).map((card) => (
            <div
              key={card.label}
              className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-[#17304a] dark:bg-[#071929]"
            >
              <dt className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{card.label}</dt>
              <dd className="mt-1.5 truncate text-[clamp(16px,1.6vw,22px)] font-semibold leading-tight tabular-nums text-[#233353] dark:text-white">
                {typeof card.value === "number" ? card.value.toLocaleString("en-IN") : card.value}
              </dd>
              <dd className="mt-1 text-[10px] leading-snug text-slate-400 dark:text-slate-500">{card.caption}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
