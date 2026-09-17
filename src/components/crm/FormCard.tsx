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
      className={`rounded-xl bg-white px-5 py-5 dark:border dark:border-[#17304a] dark:bg-[#071929] ${className}`}
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
  action,
  children,
  first = false,
}: {
  icon: ReactNode;
  title: string;
  /** Control shown at the right of the heading row, e.g. Add Product. Keeps
      it on the same line as the title instead of costing a row of its own. */
  action?: ReactNode;
  children: ReactNode;
  /** Skips the top spacing for the first section in a card. */
  first?: boolean;
}) {
  return (
    <section className={first ? "" : "mt-8"}>
      <div className="flex items-center justify-between gap-3 border-b border-[#f3f3f3] pb-3 dark:border-[#17304a]">
        <div className="flex items-center gap-2.5">
          <span className="text-[18px] text-[#474747] dark:text-slate-400">{icon}</span>

          <h3 className="text-[15px] font-medium text-[#474747] dark:text-white">
            {title}
          </h3>
        </div>

        {action}
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
