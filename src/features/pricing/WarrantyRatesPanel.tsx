"use client";

import { FiShield } from "react-icons/fi";

import {
  describeRate,
  type ProductWarrantyRates,
  type WarrantyTermOption,
} from "./warrantyTerms";

/**
 * What extending the cover costs, for one product.
 *
 * The lengths are a master - every document offers the same three - but
 * the price of them is not: five years on a panel and five years on a
 * camera are different undertakings, so the figure belongs on the product.
 *
 * Only a super admin may move those figures. The warehouse maintains
 * products - counts, codes, case sizes - and what cover costs is a
 * commercial decision that happens to live on the same record. Everyone
 * sees it; the people who hold Masters change it. The API enforces the
 * same rule, and this only keeps the screen honest about it.
 *
 * The standard term is included in the price and takes no rate. A term
 * left blank is not offered on this product, which is a different thing
 * from one offered at nothing.
 */
export default function WarrantyRatesPanel({
  terms,
  rates,
  onChange,
  editable,
}: {
  terms: WarrantyTermOption[];
  rates: ProductWarrantyRates;
  onChange: (name: string, patch: { rate?: string; mode?: string }) => void;
  editable: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-[#0d2336] dark:bg-[#071929]/40">
      <div className="mb-2 flex items-center gap-1.5">
        <FiShield className="text-slate-400" size={13} />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Warranty Rates
        </span>
      </div>

      {terms.length === 0 ? (
        <p className="text-[11px] text-slate-400">
          No warranty terms set up yet. Add them under Masters &rsaquo;
          Warranty Terms.
        </p>
      ) : (
        <div className="space-y-2">
          {terms.map((term) => (
            <div key={term.id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                {term.name}
                {term.is_default && (
                  <span className="ml-1.5 text-[10px] text-emerald-600">
                    standard
                  </span>
                )}
              </span>

              {term.is_default ? (
                <span className="text-[11px] text-slate-400">Included</span>
              ) : !editable ? (
                <span className="text-[11px] text-slate-500">
                  {describeRate(rates[term.name])}
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    aria-label={`${term.name} rate`}
                    value={rates[term.name]?.rate ?? ""}
                    onChange={(event) =>
                      onChange(term.name, { rate: event.target.value })
                    }
                    className="h-8 w-24 rounded-md border border-slate-200 bg-white px-2 text-right text-[11px] outline-none focus:border-[#233353] dark:border-[#0d2336] dark:bg-[#071929] dark:text-white"
                  />

                  <select
                    aria-label={`${term.name} rate unit`}
                    value={rates[term.name]?.mode || "PERCENT"}
                    onChange={(event) =>
                      onChange(term.name, { mode: event.target.value })
                    }
                    className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] outline-none focus:border-[#233353] dark:border-[#0d2336] dark:bg-[#071929] dark:text-white"
                  >
                    <option value="PERCENT">%</option>
                    <option value="AMOUNT">₹/unit</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Added to the selling price when the term is quoted on a proposal,
        order or invoice.{" "}
        {editable
          ? "Leave one blank to not offer it on this product."
          : "Set by a super admin, who holds Masters."}
      </p>
    </div>
  );
}
