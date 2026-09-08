"use client";

import { ReactNode } from "react";

/**
 * One white panel per column on the New Lead / New Opportunity /
 * New Sales Order pages. Sections live inside a single card and are separated
 * by the rule under each section heading, rather than each section being its
 * own card.
 */
export function FormCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white px-6 py-5 dark:border-[#17304a] dark:bg-[#071929] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Section heading + fields inside a FormCard. The heading rule stops short of
 * the right edge, matching the design.
 */
export function FormSectionBlock({
  icon,
  title,
  children,
  first = false,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  /** Skips the top spacing for the first section in a card. */
  first?: boolean;
}) {
  return (
    <section className={first ? "" : "mt-8"}>
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-[#17304a]">
        <span className="text-slate-400">{icon}</span>

        <h3 className="text-[15px] font-semibold text-slate-800 dark:text-white">
          {title}
        </h3>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Billing / Shipping pair with the "Same as Billing" toggle, used by all three
 * create forms.
 */
export function BillingShippingHeader({
  sameAsBilling,
  onToggle,
}: {
  sameAsBilling: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        Billing Address
      </p>

      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          Shipping Address
        </p>

        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={sameAsBilling}
            onChange={(event) => onToggle(event.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-[#233353]"
          />
          Same as Billing
        </label>
      </div>
    </div>
  );
}
