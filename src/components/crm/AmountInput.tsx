"use client";

import { useEffect, useState } from "react";

/**
 * Numeric field used by the Quotation and Sales Order summaries.
 *
 * Uses a text input rather than type="number" so the browser's spinner
 * arrows never appear, and accepts an optional unit toggle so a figure can
 * be entered either as a flat rupee amount or as a percentage of the base
 * it applies to.
 */

export type AmountMode = "AMOUNT" | "PERCENT";

/** Parses whatever the user typed into a non-negative number. */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");

  /* Keep only the first decimal point so "1.2.3" cannot become NaN. */
  const normalised =
    parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;

  const value = Number(normalised);

  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Resolves an entered figure against the base it is a percentage of. */
export function resolveAmount(
  value: number,
  mode: AmountMode,
  base: number,
): number {
  if (mode === "PERCENT") return (base * (value || 0)) / 100;

  return value || 0;
}

export default function AmountInput({
  value,
  mode,
  onChange,
  onModeChange,
  base,
  width = "w-28",
  ariaLabel,
  autoFocus,
  onDone,
}: {
  value: number;
  /** Omit to render a plain amount field with no unit toggle. */
  mode?: AmountMode;
  onChange: (value: number) => void;
  onModeChange?: (mode: AmountMode) => void;
  /** Amount the percentage applies to, used only for the hint. */
  base?: number;
  width?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  /**
   * Fired once focus leaves the whole control, so a caller showing this in
   * place of a value can put the value back. Moving between the number and
   * its unit selector does not count as leaving.
   */
  onDone?: () => void;
}) {
  /* Held as text while focused so a half-typed "12." is not clobbered. */
  const [draft, setDraft] = useState(String(value ?? 0));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value ?? 0));
  }, [value, editing]);

  const showToggle = !!mode && !!onModeChange;

  return (
    <div
      onBlur={(event) => {
        /* Only finish when focus has left the control entirely - tabbing
           from the number to its unit selector must not close it. */
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          onDone?.();
        }
      }}
      className={`flex h-8 ${width} items-center overflow-hidden rounded-md border border-slate-200 bg-white transition focus-within:border-[#233353] dark:border-[#17304a] dark:bg-[#071929]`}
    >
      {!showToggle && (
        <span className="pl-2 text-[11px] text-slate-400">₹</span>
      )}

      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.currentTarget.blur();
          }
        }}
        value={draft}
        onFocus={(event) => {
          setEditing(true);
          event.target.select();
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseAmount(event.target.value));
        }}
        onBlur={() => {
          setEditing(false);
          setDraft(String(parseAmount(draft)));
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-[11px] text-slate-800 outline-none dark:text-white"
      />

      {showToggle && (
        <select
          aria-label={`${ariaLabel || "Amount"} unit`}
          value={mode}
          /* Enter closes from here too, not only from the number field. */
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          onChange={(event) => onModeChange(event.target.value as AmountMode)}
          title={
            mode === "PERCENT" && base
              ? `Percentage of ₹${Number(base).toLocaleString("en-IN")}`
              : undefined
          }
          className="h-full cursor-pointer border-l border-slate-200 bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-600 outline-none dark:border-[#17304a] dark:bg-[#0b2034] dark:text-slate-300"
        >
          <option value="AMOUNT">₹</option>
          <option value="PERCENT">%</option>
        </select>
      )}
    </div>
  );
}
