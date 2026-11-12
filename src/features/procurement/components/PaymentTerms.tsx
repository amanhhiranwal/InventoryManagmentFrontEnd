"use client";

/* Payment terms as the purchase team agrees them with a vendor:
 *
 *   100% advance
 *   X% advance, the rest on delivery          (50 / 50 by default)
 *   X% advance, the rest after 15-90 days
 *   100% after 7-90 days
 *
 * and how it is paid: bank transfer or post-dated cheque. The schedule of
 * instalments these produce is worked out on the server when the PO is
 * saved; the preview here is only so the person can see what they chose. */

import type { ProcurementMeta } from "../api/procurement.api";
import { INPUT, LABEL, money } from "./shared";

export interface TermsValue {
  payment_term_type: string;
  advance_percent: string;
  credit_days: string;
  payment_mode: string;
}

export const EMPTY_TERMS: TermsValue = {
  payment_term_type: "",
  advance_percent: "50",
  credit_days: "",
  payment_mode: "BANK_TRANSFER",
};

const FALLBACK_TERMS = [
  { value: "ADVANCE_100", label: "100% advance" },
  { value: "ADVANCE_DELIVERY", label: "Advance, balance on delivery" },
  { value: "ADVANCE_CREDIT", label: "Advance, balance after credit days" },
  { value: "CREDIT_100", label: "100% after credit days" },
];
const FALLBACK_DAYS: Record<string, number[]> = {
  ADVANCE_CREDIT: [15, 30, 45, 60, 90],
  CREDIT_100: [7, 15, 21, 30, 45, 60, 90],
};
const FALLBACK_MODES = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "PDC", label: "Post-dated cheque" },
];

/** What the server is sent; empty fields are left out. */
export const termsPayload = (value: TermsValue) =>
  value.payment_term_type
    ? {
        payment_term_type: value.payment_term_type,
        advance_percent: value.advance_percent === "" ? null : Number(value.advance_percent),
        credit_days: value.credit_days === "" ? null : Number(value.credit_days),
        payment_mode: value.payment_mode || null,
      }
    : {};

/** Why the terms are not complete yet, or null when they are. */
export const termsProblem = (value: TermsValue): string | null => {
  const kind = value.payment_term_type;
  if (!kind) return "Choose the payment terms.";
  const advance = Number(value.advance_percent);
  if ((kind === "ADVANCE_DELIVERY" || kind === "ADVANCE_CREDIT") && !(advance > 0 && advance < 100))
    return "The advance must be between 1 and 99%.";
  if ((kind === "ADVANCE_CREDIT" || kind === "CREDIT_100") && !value.credit_days) return "Choose the credit days.";
  return null;
};

/** The instalments the terms produce, for a preview against ``total``. */
export const previewInstalments = (value: TermsValue, total: number) => {
  const advance = Number(value.advance_percent) || 0;
  const days = value.credit_days;
  const plan: [string, number][] =
    value.payment_term_type === "ADVANCE_100"
      ? [["Advance", 100]]
      : value.payment_term_type === "ADVANCE_DELIVERY"
        ? [["Advance", advance], ["On delivery", 100 - advance]]
        : value.payment_term_type === "ADVANCE_CREDIT"
          ? [["Advance", advance], [`After ${days || "?"} days from delivery`, 100 - advance]]
          : value.payment_term_type === "CREDIT_100"
            ? [[`After ${days || "?"} days from delivery`, 100]]
            : [];
  return plan.map(([label, pct]) => ({ label, pct, amount: (total * pct) / 100 }));
};

export default function PaymentTermsFields({
  value,
  onChange,
  meta,
  total,
  idPrefix = "terms",
}: {
  value: TermsValue;
  onChange: (value: TermsValue) => void;
  meta?: ProcurementMeta | null;
  /** The PO total, for the instalment preview. */
  total?: number;
  idPrefix?: string;
}) {
  const terms = meta?.payment_terms?.length ? meta.payment_terms : FALLBACK_TERMS;
  const dayOptions = meta?.credit_day_options || FALLBACK_DAYS;
  const modes = meta?.payment_modes?.length ? meta.payment_modes : FALLBACK_MODES;
  const kind = value.payment_term_type;
  const hasAdvance = kind === "ADVANCE_DELIVERY" || kind === "ADVANCE_CREDIT";
  const days = dayOptions[kind];
  const set = (patch: Partial<TermsValue>) => onChange({ ...value, ...patch });
  const preview = total != null ? previewInstalments(value, total) : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor={`${idPrefix}-type`}>Payment terms *</label>
          <select
            id={`${idPrefix}-type`}
            className={INPUT}
            value={kind}
            onChange={(e) => set({ payment_term_type: e.target.value, credit_days: "" })}
          >
            <option value="">Choose</option>
            {terms.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {hasAdvance && (
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-advance`}>Advance %</label>
            <input
              id={`${idPrefix}-advance`}
              type="number"
              min="1"
              max="99"
              className={INPUT}
              value={value.advance_percent}
              onChange={(e) => set({ advance_percent: e.target.value })}
            />
          </div>
        )}
        {days && (
          <div>
            <label className={LABEL} htmlFor={`${idPrefix}-days`}>Credit days (from delivery)</label>
            <select id={`${idPrefix}-days`} className={INPUT} value={value.credit_days} onChange={(e) => set({ credit_days: e.target.value })}>
              <option value="">Choose</option>
              {days.map((d) => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </div>
        )}
        <div className={hasAdvance || days ? "" : "sm:col-span-2"}>
          <label className={LABEL} htmlFor={`${idPrefix}-mode`}>Paid by</label>
          <select id={`${idPrefix}-mode`} className={INPUT} value={value.payment_mode} onChange={(e) => set({ payment_mode: e.target.value })}>
            {modes.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {preview.length > 0 && (
        <ul className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] dark:bg-[#0b2034]">
          {preview.map((p) => (
            <li key={p.label} className="flex justify-between gap-3 py-0.5">
              <span className="text-[#555555] dark:text-slate-300">{p.label} ({p.pct}%)</span>
              <span className="tabular-nums">{money(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
