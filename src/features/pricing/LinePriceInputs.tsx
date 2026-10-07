"use client";

import { useEffect, useState } from "react";

import { parseAmount } from "@/components/crm/AmountInput";

import {
  discountAmountFor,
  discountPercentFor,
  percentForDiscountAmount,
  sellingPriceFor,
} from "./lineMath";

/**
 * The two fields that say the same thing from opposite ends: what the
 * line sells at, and how far that is off the price list.
 *
 * Both write the discount as a percentage, because that is what the
 * approval bands are written in. Each holds its own text while it is
 * being typed so a half-finished "17." is not rounded away under the
 * cursor, and goes back to following the stored figure once focus leaves.
 */

/* A rupee figure is six or seven characters. Letting the field fill its
   column made "82,000" look like it was waiting for a paragraph, which is
   the same reason the percentage fields beside it are fixed at w-14. */
const FIELD =
  "h-8 w-24 rounded-md border border-slate-200 bg-white px-2 text-right text-[11px] text-slate-800 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

export function LineSellingPriceInput({
  unitPrice,
  discount,
  onChange,
  ariaLabel,
  disabled,
}: {
  unitPrice: number;
  discount: number;
  /** Receives the discount the typed selling price works out to. */
  onChange: (discount: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const settled = sellingPriceFor(unitPrice, discount);

  const [draft, setDraft] = useState(String(settled));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(settled));
  }, [settled, editing]);

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      value={draft}
      onFocus={(event) => {
        setEditing(true);
        event.target.select();
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(discountPercentFor(unitPrice, parseAmount(event.target.value)));
      }}
      onBlur={() => setEditing(false)}
      className={`${FIELD} disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-[#0b2034]`}
    />
  );
}

export function LineDiscountInput({
  unitPrice,
  discount,
  onChange,
  ariaLabel,
  disabled,
}: {
  unitPrice: number;
  discount: number;
  onChange: (discount: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  /* Which way the person is saying it. The stored figure is a percentage
     either way; this only decides what the box shows and how it reads
     what is typed into it. */
  const [mode, setMode] = useState<"PERCENT" | "AMOUNT">("PERCENT");

  const settled =
    mode === "PERCENT" ? discount : discountAmountFor(unitPrice, discount);

  const [draft, setDraft] = useState(String(settled));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(settled));
  }, [settled, editing]);

  return (
    <div className="flex h-8 w-24 items-center overflow-hidden rounded-md border border-slate-200 bg-white transition focus-within:border-[#233353] dark:border-[#17304a] dark:bg-[#071929]">
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        value={draft}
        onFocus={(event) => {
          setEditing(true);
          event.target.select();
        }}
        onChange={(event) => {
          const typed = parseAmount(event.target.value);
          setDraft(event.target.value);

          onChange(
            mode === "PERCENT"
              ? typed
              : percentForDiscountAmount(unitPrice, typed),
          );
        }}
        onBlur={() => setEditing(false)}
        className="field-compact h-full min-w-0 flex-1 bg-transparent px-2 text-right text-[11px] text-slate-800 outline-none disabled:cursor-not-allowed dark:text-white"
      />

      <select
        aria-label={`${ariaLabel || "Discount"} unit`}
        value={mode}
        disabled={disabled}
        onChange={(event) => setMode(event.target.value as "PERCENT" | "AMOUNT")}
        className="field-compact h-full cursor-pointer border-l border-slate-200 bg-slate-50 px-1 text-[11px] font-semibold text-slate-600 outline-none dark:border-[#17304a] dark:bg-[#0b2034] dark:text-slate-300"
      >
        <option value="PERCENT">%</option>
        <option value="AMOUNT">₹</option>
      </select>
    </div>
  );
}
