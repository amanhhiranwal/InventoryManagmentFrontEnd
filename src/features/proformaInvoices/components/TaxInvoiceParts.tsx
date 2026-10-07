"use client";

/**
 * The parts of a proforma invoice that a GST document is required to carry.
 *
 * Set in the design's own language - rounded panels, the navy table head,
 * slate labels above dark values - rather than the ruled grid of a printed
 * accounting form. The reference invoice decides *what* appears here; the
 * design decides how it looks. Keeping the two separable is what lets the
 * document carry a GSTIN, a place of supply and an HSN-wise tax table
 * without turning into a different-looking page.
 *
 * None of these compute anything. The tax is worked out on the server and
 * arrives on the invoice; a document that does its own arithmetic is a
 * document that can disagree with what was actually charged, and the one
 * place that must never happen is the page the customer pays against.
 */

import type {
  ProformaInvoiceModel,
  TaxSummary,
} from "@/features/proformaInvoices/api/proformaInvoices.api";
import { amountInWords } from "@/features/quotations/amountInWords";

const money = (value?: number | null) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** The panel the design uses for everything that is not a table. */
const PANEL = "rounded-xl bg-slate-100 px-4 pb-4 pt-3";

const PANEL_TITLE =
  "mb-3 border-b border-slate-200 pb-2 text-[12px] font-medium text-slate-600";

/* =========================================================
   THE PARTIES
========================================================= */

/**
 * A party on the document: who they are, where, and their GST identity.
 *
 * The registration and the state are not decoration. The seller's state
 * code against the buyer's is what decides whether the sale is taxed as
 * CGST and SGST or as a single IGST line, so the pair is printed where a
 * reader can check the split for themselves.
 */
export function PartyBlock({
  title,
  name,
  lines,
  gstin,
  stateName,
  stateCode,
}: {
  title: string;
  name?: string | null;
  lines: string[];
  gstin?: string | null;
  stateName?: string | null;
  stateCode?: string | null;
}) {
  return (
    <div className={PANEL}>
      <p className={PANEL_TITLE}>{title}</p>

      <p className="text-[13px] font-bold text-slate-800">{name || "-"}</p>

      {lines.filter(Boolean).map((line, index) => (
        <p key={`${line}-${index}`} className="text-[11px] leading-[16px] text-slate-600">
          {line}
        </p>
      ))}

      {/* Left off rather than printed empty: a blank registration on a tax
          document reads as a claim that the party has none. */}
      {gstin && (
        <p className="mt-2 text-[11px] text-slate-700">
          <span className="text-slate-500">GSTIN/UIN:</span>{" "}
          <span className="font-medium">{gstin}</span>
        </p>
      )}

      {(stateName || stateCode) && (
        <p className="text-[11px] text-slate-700">
          <span className="text-slate-500">State:</span>{" "}
          <span className="font-medium">
            {stateName || "-"}
            {stateCode ? ` (${stateCode})` : ""}
          </span>
        </p>
      )}
    </div>
  );
}

/** A label above its value, as the design sets a read-only field. */
export function HeaderCell({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-[11px] font-semibold leading-[16px] text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}

/**
 * The document's own references, in one panel beside the parties.
 *
 * Terms of payment sit here rather than among the notes at the foot,
 * because they are what the customer is being asked to act on.
 */
export function ReferencePanel({
  invoice,
  orderNumber,
  reference,
  issueDate,
  dueDate,
}: {
  invoice: ProformaInvoiceModel;
  orderNumber?: string | null;
  reference: string;
  issueDate: string;
  dueDate?: string;
}) {
  return (
    <div className={PANEL}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <HeaderCell label="Voucher No." value={`#${reference}`} />
        <HeaderCell label="Dated" value={issueDate} />

        <HeaderCell
          label="Buyer's Ref. / Order No."
          value={orderNumber ? `#${orderNumber}` : "-"}
        />
        <HeaderCell label="Other References" value={invoice.sales_order?.po_number} />

        <HeaderCell label="Dispatched through" value={null} />
        <HeaderCell label="Destination" value={invoice.shipping_address?.city} />

        <HeaderCell label="Place of Supply" value={invoice.place_of_supply} />
        <HeaderCell label="Valid Until" value={dueDate} />

        {/* The split only, not the sentence. The terms themselves are set
            out in full with the other conditions at the foot of the
            document, and printing them in both places left one page
            stating the same agreement two ways. */}
        <HeaderCell
          label="Mode / Terms of Payment"
          value={`${invoice.advance_percent ?? 30}% advance`}
          className="col-span-2"
        />
      </div>
    </div>
  );
}

/* =========================================================
   THE GOODS
========================================================= */

/**
 * The goods, in the design's table: navy head, rounded top, ruled rows.
 *
 * The columns are the reference invoice's - Sl No., Description, HSN/SAC,
 * GST Rate, Quantity, per, Rate, Amount - because a GST document has to
 * show the code the goods were classified under and the rate that follows
 * from it. Only the setting is the design's.
 */
export function GoodsTable({
  invoice,
  summary,
}: {
  invoice: ProformaInvoiceModel;
  summary?: TaxSummary | null;
}) {
  const items = invoice.items || [];

  /* The rate a line was taxed at, taken from the server's HSN summary so
     the column cannot disagree with the tax charged below it. */
  const rateFor = (hsn?: string | null, fallback?: number | null) => {
    const row = summary?.rows.find((candidate) => candidate.hsn === (hsn || "-"));
    return row ? row.rate : Number(fallback || 0);
  };

  const th = "px-3 py-3 text-[11px] font-normal text-white";
  const td = "px-3 py-3 text-[11px] text-slate-700";

  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item.qty || item.quantity_case || 0),
    0,
  );

  const goodsTotal = items.reduce((sum, item) => {
    const quantity = Number(item.qty || item.quantity_case || 0);
    const rate = Number(item.rate || item.price || 0);
    const discount = Number(item.discount || 0);

    return sum + quantity * rate * (1 - discount / 100);
  }, 0);

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-[#233353] [&>th:first-child]:rounded-tl-xl [&>th:last-child]:rounded-tr-xl">
          <th className={`${th} w-[42px] text-center`}>Sl</th>
          <th className={`${th} text-left`}>Description of Goods</th>
          <th className={`${th} w-[82px] text-center`}>HSN/SAC</th>
          <th className={`${th} w-[56px] text-center`}>GST</th>
          <th className={`${th} w-[56px] text-right`}>Qty</th>
          <th className={`${th} w-[46px] text-center`}>per</th>
          <th className={`${th} w-[92px] text-right`}>Rate</th>
          <th className={`${th} w-[104px] text-right`}>Amount</th>
        </tr>
      </thead>

      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
              No goods on this invoice.
            </td>
          </tr>
        ) : (
          items.map((item, index) => {
            const quantity = Number(item.qty || 0);
            const rate = Number(item.rate || item.price || 0);
            const discount = Number(item.discount || 0);
            const amount = quantity * rate * (1 - discount / 100);

            return (
              <tr
                key={`${item.sku || item.product || index}-${index}`}
                className="border-b border-slate-100 last:border-slate-300"
              >
                <td className={`${td} text-center`}>{index + 1}</td>

                <td className="px-3 py-3">
                  <p className="text-[11px] font-bold text-slate-800">
                    {item.product || item.description || item.item || "-"}
                  </p>
                  {item.model && (
                    <p className="text-[10px] text-slate-500">{item.model}</p>
                  )}
                  {/* The specification, as the reference sets it: under the
                      name, smaller and in italic. It is what distinguishes
                      two panels of the same size from each other. */}
                  {item.description && item.description !== item.product && (
                    <p className="text-[9px] italic leading-[13px] text-slate-500">
                      {item.description}
                    </p>
                  )}
                  {item.sku && (
                    <p className="text-[9px] text-slate-400">SKU: {item.sku}</p>
                  )}
                  {/* The cover sold with the line. It is part of what the
                      customer is paying for, so it belongs on the document
                      they are given rather than only on the form. */}
                  {item.warranty_term && (
                    <p className="text-[9px] text-slate-500">
                      Warranty: {item.warranty_term}
                      {Number(item.warranty_uplift || 0) > 0 &&
                        ` (+₹${Math.round(
                          Number(item.warranty_uplift),
                        ).toLocaleString("en-IN")})`}
                    </p>
                  )}
                  {discount > 0 && (
                    <p className="text-[9px] italic text-slate-500">
                      less {discount}% on the line
                    </p>
                  )}
                </td>

                {/* Shown as absent rather than guessed. A code on a tax
                    document is a classification the seller answers for. */}
                <td className={`${td} text-center`}>{item.hsn || "-"}</td>

                <td className={`${td} text-center`}>
                  {rateFor(item.hsn, item.tax_rate)}%
                </td>
                <td className={`${td} text-right`}>{quantity}</td>
                <td className={`${td} text-center text-slate-400`}>Nos</td>
                <td className={`${td} text-right`}>{money(rate)}</td>
                <td className={`${td} text-right font-semibold text-slate-900`}>
                  {money(amount)}
                </td>
              </tr>
            );
          })
        )}

        {/* The quantity totalled, as the reference invoice ends its table.
            It is what a storeman counts against when the goods arrive, and
            it is the only column where a sum of the rows means anything -
            rates and codes do not add up. */}
        {items.length > 0 && (
          <tr className="font-bold text-slate-900">
            <td className={td} />
            <td className={`${td} text-right`}>Total</td>
            <td className={td} />
            <td className={td} />
            <td className={`${td} text-right`}>{totalQuantity}</td>
            <td className={`${td} text-center font-normal text-slate-400`}>Nos</td>
            <td className={td} />
            <td className={`${td} text-right`}>{money(goodsTotal)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* =========================================================
   THE TOTALS, AND THE TAX INSIDE THEM
========================================================= */

/**
 * What the goods come to, and the tax on them.
 *
 * Every deduction and charge is listed rather than folded into one
 * subtotal, and the tax appears as the CGST/SGST pair or the single IGST
 * line that the two state codes call for - never both, and never a flat
 * "GST" that hides which was charged.
 */
export function InvoiceTotals({
  invoice,
  summary,
}: {
  invoice: ProformaInvoiceModel;
  summary?: TaxSummary | null;
}) {
  const taxable = summary ? summary.taxable_total : invoice.taxable_amount;

  const adjustments: [string, number, boolean][] = [
    ["Less: Discount", invoice.discount_amount, true],
    ["Less: ORC", invoice.orc_amount, true],
    ["Add: Freight & Forwarding", invoice.freight_charges, false],
    ["Add: Installation & Commissioning", invoice.installation_lumpsum, false],
  ];

  return (
    <div className="pi-keep mt-5 flex justify-end">
      <div className="w-full max-w-[430px] px-3">
        <Row label="Subtotal" value={money(invoice.total_amount)} />

        {adjustments
          .filter(([, value]) => Number(value || 0) !== 0)
          .map(([label, value, negative]) => (
            <Row
              key={label}
              label={label}
              value={`${negative ? "-" : "+"}${money(value)}`}
              tone={negative ? "rose" : undefined}
            />
          ))}

        <Divider />

        <Row label="Taxable Value" value={money(taxable)} />

        {summary ? (
          summary.interstate ? (
            <Row
              label={`IGST @ ${summary.rows[0]?.igst_rate ?? invoice.gst_percent}%`}
              value={money(summary.igst_total)}
            />
          ) : (
            <>
              <Row
                label={`CGST @ ${summary.rows[0]?.cgst_rate ?? 0}%`}
                value={money(summary.cgst_total)}
              />
              <Row
                label={`SGST/UTGST @ ${summary.rows[0]?.sgst_rate ?? 0}%`}
                value={money(summary.sgst_total)}
              />
            </>
          )
        ) : (
          <Row
            label={`GST (${Number((invoice.gst_percent || 0).toFixed(2))}%)`}
            value={money(invoice.gst_amount)}
          />
        )}

        <Divider />

        <Row label="Total Payable" value={`₹ ${money(invoice.grand_total)}`} strong />

        {Number(invoice.amount_paid || 0) > 0 && (
          <>
            <Divider />
            <Row
              label="Advance Received"
              value={`-${money(invoice.amount_paid)}`}
              tone="rose"
            />
            <Row label="Balance Due" value={`₹ ${money(invoice.balance_due)}`} strong />
          </>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="my-2 ml-auto w-[62%] border-t border-slate-200" />;
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "rose";
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-4 py-1.5">
      <span className="text-right text-[12px] text-slate-500">{label}:</span>

      <span
        className={`w-[130px] shrink-0 text-right font-semibold ${
          strong ? "text-[13px]" : "text-[12px]"
        } ${tone === "rose" ? "text-rose-500" : "text-slate-900"}`}
      >
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   THE HSN-WISE SUMMARY
========================================================= */

/**
 * The tax, shown rather than stated.
 *
 * A GST document does not simply give a figure: it shows the taxable
 * value and the tax under each code, so a reader can check the arithmetic
 * instead of taking the total on trust. That is the whole purpose of this
 * table, and why it survives into a design that has no other grid.
 */
export function HsnTaxSummary({ summary }: { summary: TaxSummary }) {
  const interstate = summary.interstate;

  const th = "px-3 py-2 text-[10px] font-normal text-white";
  const td = "px-3 py-2 text-[10px] text-slate-700";

  return (
    <div className="pi-keep">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#233353] [&>th:first-child]:rounded-tl-xl [&>th:last-child]:rounded-tr-xl">
            <th className={`${th} text-left`}>HSN/SAC</th>
            <th className={`${th} text-right`}>Taxable Value</th>

            {interstate ? (
              <>
                <th className={`${th} text-center`}>IGST Rate</th>
                <th className={`${th} text-right`}>IGST Amount</th>
              </>
            ) : (
              <>
                <th className={`${th} text-center`}>CGST Rate</th>
                <th className={`${th} text-right`}>CGST Amount</th>
                <th className={`${th} text-center`}>SGST Rate</th>
                <th className={`${th} text-right`}>SGST Amount</th>
              </>
            )}

            <th className={`${th} text-right`}>Total Tax</th>
          </tr>
        </thead>

        <tbody>
          {summary.rows.map((row) => (
            <tr key={row.hsn} className="border-b border-slate-100">
              <td className={`${td} font-medium text-slate-800`}>{row.hsn}</td>
              <td className={`${td} text-right`}>{money(row.taxable)}</td>

              {interstate ? (
                <>
                  <td className={`${td} text-center`}>{row.igst_rate}%</td>
                  <td className={`${td} text-right`}>{money(row.igst_amount)}</td>
                </>
              ) : (
                <>
                  <td className={`${td} text-center`}>{row.cgst_rate}%</td>
                  <td className={`${td} text-right`}>{money(row.cgst_amount)}</td>
                  <td className={`${td} text-center`}>{row.sgst_rate}%</td>
                  <td className={`${td} text-right`}>{money(row.sgst_amount)}</td>
                </>
              )}

              <td className={`${td} text-right font-semibold text-slate-900`}>
                {money(row.total_tax)}
              </td>
            </tr>
          ))}

          <tr className="border-t border-slate-300">
            <td className={`${td} font-bold text-slate-800`}>Total</td>
            <td className={`${td} text-right font-bold text-slate-900`}>
              {money(summary.taxable_total)}
            </td>

            {interstate ? (
              <>
                <td className={td} />
                <td className={`${td} text-right font-bold text-slate-900`}>
                  {money(summary.igst_total)}
                </td>
              </>
            ) : (
              <>
                <td className={td} />
                <td className={`${td} text-right font-bold text-slate-900`}>
                  {money(summary.cgst_total)}
                </td>
                <td className={td} />
                <td className={`${td} text-right font-bold text-slate-900`}>
                  {money(summary.sgst_total)}
                </td>
              </>
            )}

            <td className={`${td} text-right font-bold text-slate-900`}>
              {money(summary.tax_total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   THE FIGURES IN WORDS
========================================================= */

/**
 * The two figures a GST document states in words as well as digits.
 *
 * Digits can be altered with a pen; words cannot, which is why both appear
 * and why both are built from the same numbers.
 */
export function AmountsInWords({ invoice }: { invoice: ProformaInvoiceModel }) {
  const tax = invoice.tax_summary?.tax_total ?? invoice.gst_amount;

  return (
    <div className="pi-keep grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2">
      <div className={PANEL}>
        <p className={PANEL_TITLE}>Amount Chargeable (in words)</p>
        <p className="text-[12px] font-bold text-slate-800">
          {amountInWords(invoice.grand_total)}
        </p>
      </div>

      <div className={PANEL}>
        <p className={PANEL_TITLE}>Tax Amount (in words)</p>
        <p className="text-[12px] font-bold text-slate-800">{amountInWords(tax)}</p>
      </div>
    </div>
  );
}
