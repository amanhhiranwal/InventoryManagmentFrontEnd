"use client";

/**
 * The business coordinator's advance box: what arrived, read against the
 * payment terms as it is typed. Styled as the sales order page's own form
 * fields, where it sits.
 */

import { numericText, parseAmount } from "@/components/crm/AmountInput";
import { money } from "@/features/fulfilment/api/fulfilment.api";

export interface AdvanceVerdict {
  amount: number;
  shortBy: number;
  over: boolean;
  /** Why it cannot be accepted yet, or null. */
  blocked: string | null;
}

/** Whether the typed advance can be accepted, against the order's terms. */
export function advanceVerdict(
  typed: string,
  expected: number,
  grandTotal: number,
  hasInvoice: boolean,
): AdvanceVerdict {
  const amount = parseAmount(typed);
  const shortBy = Math.max(0, expected - amount);
  const over = amount > grandTotal + 0.5;

  return {
    amount,
    shortBy,
    over,
    blocked: !hasInvoice
      ? "Generate the proforma invoice from the sales order first."
      : amount <= 0
        ? "Enter the advance received to accept it."
        : over
          ? "The advance cannot be more than the order is worth."
          : null,
  };
}

export default function AdvanceEntry({
  id,
  typed,
  onType,
  expected,
  grandTotal,
}: {
  id: string;
  typed: string;
  onType: (value: string) => void;
  expected: number;
  grandTotal: number;
}) {
  const amount = parseAmount(typed);
  const shortBy = Math.max(0, expected - amount);
  const over = amount > grandTotal + 0.5;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-400"
      >
        Advance received (₹)
      </label>

      <input
        id={id}
        inputMode="decimal"
        value={typed}
        onChange={(event) => onType(numericText(event.target.value))}
        placeholder={String(Math.round(expected))}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      />

      <p
        className={`mt-1.5 text-[10px] ${
          amount <= 0
            ? "text-slate-400"
            : over
              ? "text-rose-600 dark:text-rose-400"
              : shortBy > 0.5
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
        }`}
      >
        {amount <= 0
          ? `The terms ask for ${money(expected)}.`
          : over
            ? "That is more than the order is worth."
            : shortBy > 0.5
              ? `${money(shortBy)} short of the terms. Balance after it: ${money(grandTotal - amount)}.`
              : `Meets the terms. Balance after it: ${money(grandTotal - amount)}.`}
      </p>
    </div>
  );
}
