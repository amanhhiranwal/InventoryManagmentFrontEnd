"use client";

import { ReactNode } from "react";

/**
 * Field look from the design, applied to every input, select, textarea and
 * field label inside a form card: 39px white fields with a light grey border,
 * 13px text and regular grey labels. Inputs inside tables (product lines) and
 * anything marked .field-compact keep their own sizing.
 */
export const FORM_FIELDS = [
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not(td_*):not(.field-compact)]:h-[39px]",
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not(td_*):not(.field-compact)]:rounded-lg",
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not(td_*):not(.field-compact)]:border-[#d1d1d1]",
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not(td_*):not(.field-compact)]:text-[13px]",
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not(td_*):not(.field-compact)]:text-[#141414]",
  "dark:[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not(td_*):not(.field-compact)]:border-[#17304a]",
  "dark:[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not(td_*):not(.field-compact)]:text-white",
  "[&_select:not(td_*):not(.field-compact)]:h-[39px]",
  "[&_select:not(td_*):not(.field-compact)]:rounded-lg",
  "[&_select:not(td_*):not(.field-compact)]:border-[#d1d1d1]",
  "[&_select:not(td_*):not(.field-compact)]:text-[13px]",
  "[&_select:not(td_*):not(.field-compact)]:text-[#141414]",
  "dark:[&_select:not(td_*):not(.field-compact)]:border-[#17304a]",
  "dark:[&_select:not(td_*):not(.field-compact)]:text-white",
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not(td_*):not(.field-compact)]:placeholder:text-[#a9a9a9]",
  "[&_textarea:not(td_*):not(.field-compact)]:rounded-lg",
  "[&_textarea:not(td_*):not(.field-compact)]:border-[#d1d1d1]",
  "[&_textarea:not(td_*):not(.field-compact)]:bg-[#f3f3f3]",
  "[&_textarea:not(td_*):not(.field-compact)]:text-[13px]",
  "[&_textarea:not(td_*):not(.field-compact)]:text-[#141414]",
  "[&_textarea:not(td_*):not(.field-compact)]:placeholder:text-[#a9a9a9]",
  "dark:[&_textarea:not(td_*):not(.field-compact)]:border-[#17304a]",
  "dark:[&_textarea:not(td_*):not(.field-compact)]:bg-[#071929]",
  "dark:[&_textarea:not(td_*):not(.field-compact)]:text-white",
  "[&_label:not(:has(input)):not(:has(select)):not(:has(textarea)):not(td_*)]:text-[12px]",
  "[&_label:not(:has(input)):not(:has(select)):not(:has(textarea)):not(td_*)]:font-normal",
  "[&_label:not(:has(input)):not(:has(select)):not(:has(textarea)):not(td_*)]:text-[#777777]",
  "dark:[&_label:not(:has(input)):not(:has(select)):not(:has(textarea)):not(td_*)]:text-slate-400",
].join(" ");

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
      className={`rounded-xl bg-white px-5 py-5 dark:border dark:border-[#17304a] dark:bg-[#071929] ${FORM_FIELDS} ${className}`}
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
