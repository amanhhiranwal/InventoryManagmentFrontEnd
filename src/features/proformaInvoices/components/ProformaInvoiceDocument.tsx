"use client";

/**
 * The proforma invoice as the customer sees it.
 *
 * Set out exactly as the business's printed Tax Invoice is: one ruled box
 * holding the seller and the two parties on the left, the voucher grid on
 * the right, the goods with their tax lines, the HSN-wise summary, and the
 * bank details beside the terms and the declaration. One A4 page.
 *
 * One component serves the Preview and the PDF: Download PDF prints a copy of
 * exactly this, and the Preview shows it on an A4-width sheet with the PDF's
 * margins. The emailed copy is drawn by proforma_invoice_pdf_service.py to
 * the same layout. Its layout is fixed rather than responsive, because the
 * printed page is narrower than the screen breakpoints.
 */

import { ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type {
  CompanyProfile,
  ProformaInvoiceModel,
} from "@/features/proformaInvoices/api/proformaInvoices.api";
import { amountInWords } from "@/features/quotations/amountInWords";

const money = (value?: number | null) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** "2.0 Nos", as the printed form counts. */
const quantity = (value: number) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** The printed form says INR where the app's helper says Rupees. */
const inWords = (value?: number | null) => amountInWords(value).replace(/^Rupees /, "INR ");

/** 17-Oct-26, the printed form's date. */
function shortDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = date.toLocaleString("en-GB", { month: "short" });
  return `${String(date.getDate()).padStart(2, "0")}-${month}-${String(date.getFullYear()).slice(-2)}`;
}

/** An address as the printed form sets it: one line per line. */
function addressLines(address?: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  pin?: string | null;
  country?: string | null;
}): string[] {
  if (!address) return [];

  return [
    address.street,
    [[address.city, address.state].filter(Boolean).join(", "), address.pin]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean) as string[];
}

/** The ruled goods grid: Sl No. | Description | HSN/SAC | Quantity | Rate | per | Amount. */
const GOODS_COLUMNS = "7mm 1fr 21mm 21mm 21mm 11mm 30mm";

const LINE = "border-black";

/* =========================================================
   THE PARTS OF THE FORM
========================================================= */

function Party({
  title,
  name,
  lines,
  contact,
  gstin,
  stateName,
  stateCode,
  email,
  className = "",
}: {
  title?: string;
  name?: string | null;
  lines: string[];
  contact?: string;
  gstin?: string | null;
  stateName?: string | null;
  stateCode?: string | null;
  email?: string | null;
  className?: string;
}) {
  return (
    <div className={`px-1.5 py-1 ${className}`}>
      {title && <p className="text-[10px]">{title}</p>}
      <p className="text-[11.5px] font-bold">{name || "-"}</p>
      {lines.map((line, index) => (
        <p key={`${line}-${index}`} className="text-[11px] leading-[15px]">
          {line}
        </p>
      ))}
      {contact && <p className="text-[11px] leading-[15px]">{contact}</p>}
      {gstin && <p className="text-[11px] leading-[15px]">GSTIN/UIN&nbsp;&nbsp;: {gstin}</p>}
      {(stateName || stateCode) && (
        <p className="text-[11px] leading-[15px]">
          State Name&nbsp;&nbsp;: {stateName || "-"}
          {stateCode ? `, Code : ${stateCode}` : ""}
        </p>
      )}
      {email && <p className="text-[11px] leading-[15px]">E-Mail : {email}</p>}
    </div>
  );
}

/** One box of the voucher grid: its label, and the value bold beneath. */
function Cell({
  label,
  value,
  className = "",
  children,
}: {
  label: string;
  value?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`min-h-[10.5mm] px-1 py-0.5 ${className}`}>
      {children ?? (
        <>
          <p className="text-[10px] leading-[13px]">{label}</p>
          <p className="text-[11px] font-bold leading-[14px]">{value || ""}</p>
        </>
      )}
    </div>
  );
}

/** A line under the goods - a tax, a charge, the round off. */
interface ChargeLine {
  label: string;
  amount: number;
}

/* =========================================================
   THE DOCUMENT
========================================================= */

export default function ProformaInvoiceDocument({
  invoice,
  profile,
}: {
  invoice: ProformaInvoiceModel;
  profile: CompanyProfile | null;
  /** Kept for callers; the printed form has nothing to copy. */
  onCopied?: (message: string) => void;
}) {
  const reference = invoice.pi_number || `PI-${invoice.id}`;
  const summary = invoice.tax_summary;
  const items = invoice.items || [];
  const bank = profile?.bank || {};

  const info = (invoice.customer_information || {}) as Record<string, any>;
  const contact = (info.primary_contact || {}) as Record<string, string>;
  const contactLine = [contact.name, contact.phone].filter(Boolean).join("  ");
  const gstin = info.gst as string | undefined;
  const partyName = invoice.company_name || invoice.customer_name;

  /* The goods, at the rate actually charged: a line discount is taken off
     the rate rather than shown, so quantity times rate is the amount. */
  const lines = items.map((item) => {
    const qty = Number(item.qty || item.quantity_case || 0);
    const rate = Number(item.rate || item.price || 0) * (1 - Number(item.discount || 0) / 100);
    return { item, qty, rate, amount: qty * rate };
  });

  const goodsTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const totalQuantity = lines.reduce((sum, line) => sum + line.qty, 0);

  /* Everything between the goods and the total, as the printed form lists
     it inside the goods table. The order's own discount and ORC are netted
     into one line rather than named. The round off is whatever is left, so
     the column always adds up to the total printed under it. */
  const net =
    Number(invoice.total_amount || 0) -
    Number(invoice.discount_amount || 0) -
    Number(invoice.orc_amount || 0);
  const adjustment = net - goodsTotal;

  const charges: ChargeLine[] = [];

  if (Math.abs(adjustment) >= 0.005) {
    charges.push({ label: adjustment < 0 ? "Less : Discount" : "Adjustment", amount: adjustment });
  }
  if (Number(invoice.freight_charges || 0)) {
    charges.push({ label: "Freight & Forwarding", amount: Number(invoice.freight_charges) });
  }
  if (Number(invoice.installation_lumpsum || 0)) {
    charges.push({
      label: "Installation & Commissioning",
      amount: Number(invoice.installation_lumpsum),
    });
  }

  if (summary) {
    if (summary.interstate) {
      charges.push({ label: "Output IGST", amount: summary.igst_total });
    } else {
      charges.push({ label: "Output CGST", amount: summary.cgst_total });
      charges.push({ label: "Output SGST", amount: summary.sgst_total });
    }
  } else if (Number(invoice.gst_amount || 0)) {
    charges.push({ label: "Output GST", amount: Number(invoice.gst_amount) });
  }

  const listed = goodsTotal + charges.reduce((sum, line) => sum + line.amount, 0);
  const roundOff = Number(invoice.grand_total || 0) - listed;

  if (Math.abs(roundOff) >= 0.005) charges.push({ label: "Round Off", amount: roundOff });

  const taxTotal = summary?.tax_total ?? Number(invoice.gst_amount || 0);
  const interstate = summary?.interstate ?? true;
  const terms = (invoice.commercial_terms || []).map((term) => term.trim()).filter(Boolean);

  const th = `border-b ${LINE} px-1 py-0.5 text-center text-[10px] font-normal`;

  return (
    <div
      className="pi-paper bg-white text-black"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <p className="mb-1 text-center text-[15px] font-bold">Proforma Invoice</p>

      <div className={`flex min-h-[266mm] flex-col border ${LINE}`}>
        {/* THE HEAD: seller and parties left, the voucher grid right */}
        <div className={`pi-keep grid grid-cols-[55%_45%] border-b ${LINE}`}>
          <div className={`border-r ${LINE}`}>
            <Party
              name={profile?.legal_name || "Company name not configured"}
              lines={profile?.address_lines || []}
              gstin={profile?.gstin}
              stateName={profile?.state_name}
              stateCode={profile?.state_code}
              email={profile?.email}
              className={`border-b ${LINE}`}
            />

            <Party
              title="Consignee (Ship to)"
              name={partyName}
              lines={addressLines(invoice.shipping_address)}
              contact={contactLine}
              gstin={gstin}
              stateName={invoice.shipping_address?.state || invoice.place_of_supply}
              stateCode={invoice.buyer_state_code}
              className={`border-b ${LINE}`}
            />

            <Party
              title="Buyer (Bill to)"
              name={partyName}
              lines={addressLines(invoice.billing_address)}
              contact={contactLine}
              gstin={gstin}
              stateName={invoice.billing_address?.state || invoice.place_of_supply}
              stateCode={invoice.buyer_state_code}
            />
          </div>

          <div className="grid grid-cols-2 content-start [&>div]:border-b [&>div]:border-black [&>div:nth-child(odd)]:border-r">
            <Cell label="Invoice No.">
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[10px] leading-[13px]">Invoice No.</p>
                  <p className="text-[11px] font-bold leading-[14px]">{reference}</p>
                </div>
                <div>
                  <p className="text-[10px] leading-[13px]">e-Way Bill No.</p>
                </div>
              </div>
            </Cell>
            <Cell label="Dated" value={shortDate(invoice.issue_date)} />

            <Cell label="Delivery Note" />
            <Cell label="Mode/Terms of Payment" value={`${invoice.advance_percent ?? 30}% Advance`} />

            <Cell label="Reference No. & Date." value={invoice.sales_order?.order_number} />
            <Cell label="Other References" />

            <Cell label="Buyer's Order No." value={invoice.sales_order?.po_number} />
            <Cell label="Dated" value={shortDate(invoice.sales_order?.po_date)} />

            <Cell label="Dispatch Doc No." />
            <Cell label="Delivery Note Date" />

            <Cell label="Dispatched through" />
            <Cell label="Destination" value={invoice.shipping_address?.city} />

            <Cell label="Vessel/Flight No." />
            <Cell label="Place of receipt by shipper:" />

            <Cell label="City/Port of Loading" />
            <Cell label="City/Port of Discharge" />

            <Cell label="Terms of Delivery" className="col-span-2 !border-b-0 !border-r-0" />
          </div>
        </div>

        {/* THE GOODS: the column rules run the full height of the body */}
        <div className="grid text-[10px]" style={{ gridTemplateColumns: GOODS_COLUMNS }}>
          {["Sl No.", "Description of Goods", "HSN/SAC", "Quantity", "Rate", "per", "Amount"].map(
            (heading, index) => (
              <div key={heading} className={`${th} ${index < 6 ? `border-r ${LINE}` : ""}`}>
                {heading}
              </div>
            ),
          )}
        </div>

        <div className="relative min-h-[40mm] flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: GOODS_COLUMNS }}
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={`border-r ${LINE}`} />
            ))}
            <div />
          </div>

          <div className="relative">
            {lines.map(({ item, qty, rate, amount }, index) => (
              <div
                key={`${item.sku || item.product || index}-${index}`}
                className="grid py-1 text-[11px]"
                style={{ gridTemplateColumns: GOODS_COLUMNS }}
              >
                <p className="px-1 text-right">{index + 1}</p>
                <div className="px-1">
                  <p className="font-bold">{item.product || item.description || item.item || "-"}</p>
                  <div className="pl-[8mm] text-[10.5px] italic leading-[15px]">
                    {item.model && <p>{item.model}</p>}
                    {item.description &&
                      item.description !== item.product &&
                      item.description !== item.model && (
                      <p>{item.description}</p>
                    )}
                    {item.warranty_term && <p>Warranty : {item.warranty_term}</p>}
                  </div>
                </div>
                <p className="px-1">{item.hsn || ""}</p>
                <p className="px-1 text-right font-bold">{quantity(qty)} Nos</p>
                <p className="px-1 text-right">{money(rate)}</p>
                <p className="px-1">Nos</p>
                <p className="px-1 text-right font-bold">{money(amount)}</p>
              </div>
            ))}

            {charges.length > 0 && (
              <div className="pt-4">
                {charges.map((line) => (
                  <div
                    key={line.label}
                    className="grid text-[11px] font-bold"
                    style={{ gridTemplateColumns: GOODS_COLUMNS }}
                  >
                    <span />
                    <p className="px-2 text-right italic">{line.label}</p>
                    <span />
                    <span />
                    <span />
                    <span />
                    <p className="px-1 text-right">{money(line.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className={`pi-keep grid border-y ${LINE} text-[11px]`}
          style={{ gridTemplateColumns: GOODS_COLUMNS }}
        >
          {[
            "",
            <p key="label" className="text-right">Total</p>,
            "",
            <p key="qty" className="text-right font-bold">{quantity(totalQuantity)} Nos</p>,
            "",
            "",
            <p key="total" className="text-right text-[13px] font-bold italic">
              ₹ {money(invoice.grand_total)}
            </p>,
          ].map((content, index) => (
            <div key={index} className={`px-1 py-0.5 ${index < 6 ? `border-r ${LINE}` : ""}`}>
              {content}
            </div>
          ))}
        </div>

        {/* THE TOTAL IN WORDS, AND THE TAX BY HSN */}
        <div className="pi-keep">
          <div className="flex items-start justify-between px-1.5 pt-0.5">
            <p className="text-[10px]">Amount Chargeable (in words)</p>
            <p className="text-[10px] italic">E. &amp; O.E</p>
          </div>
          <p className="px-1.5 pb-1 text-[11.5px] font-bold">{inWords(invoice.grand_total)}</p>

          {summary && summary.rows.length > 0 && (
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  <th rowSpan={2} className={`border ${LINE} border-l-0 font-normal`}>HSN/SAC</th>
                  <th rowSpan={2} className={`w-[24mm] border ${LINE} font-normal`}>
                    Taxable
                    <br />
                    Value
                  </th>
                  {interstate ? (
                    <th colSpan={2} className={`border ${LINE} font-normal`}>IGST</th>
                  ) : (
                    <>
                      <th colSpan={2} className={`border ${LINE} font-normal`}>CGST</th>
                      <th colSpan={2} className={`border ${LINE} font-normal`}>SGST/UTGST</th>
                    </>
                  )}
                  <th rowSpan={2} className={`w-[24mm] border ${LINE} border-r-0 font-normal`}>
                    Total
                    <br />
                    Tax Amount
                  </th>
                </tr>
                <tr>
                  {Array.from({ length: interstate ? 1 : 2 }, (_, index) => (
                    <FragmentCells key={index} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.hsn}>
                    <td className={`border-x ${LINE} border-l-0 px-1`}>{row.hsn}</td>
                    <td className={`border-x ${LINE} px-1 text-right`}>{money(row.taxable)}</td>
                    {interstate ? (
                      <>
                        <td className={`border-x ${LINE} px-1 text-center`}>{row.igst_rate}%</td>
                        <td className={`border-x ${LINE} px-1 text-right`}>{money(row.igst_amount)}</td>
                      </>
                    ) : (
                      <>
                        <td className={`border-x ${LINE} px-1 text-center`}>{row.cgst_rate}%</td>
                        <td className={`border-x ${LINE} px-1 text-right`}>{money(row.cgst_amount)}</td>
                        <td className={`border-x ${LINE} px-1 text-center`}>{row.sgst_rate}%</td>
                        <td className={`border-x ${LINE} px-1 text-right`}>{money(row.sgst_amount)}</td>
                      </>
                    )}
                    <td className={`border-x ${LINE} border-r-0 px-1 text-right`}>
                      {money(row.total_tax)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={`border ${LINE} border-l-0 px-1 text-right`}>Total</td>
                  <td className={`border ${LINE} px-1 text-right`}>{money(summary.taxable_total)}</td>
                  {interstate ? (
                    <>
                      <td className={`border ${LINE}`} />
                      <td className={`border ${LINE} px-1 text-right`}>{money(summary.igst_total)}</td>
                    </>
                  ) : (
                    <>
                      <td className={`border ${LINE}`} />
                      <td className={`border ${LINE} px-1 text-right`}>{money(summary.cgst_total)}</td>
                      <td className={`border ${LINE}`} />
                      <td className={`border ${LINE} px-1 text-right`}>{money(summary.sgst_total)}</td>
                    </>
                  )}
                  <td className={`border ${LINE} border-r-0 px-1 text-right`}>
                    {money(summary.tax_total)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          <p className="px-1.5 py-1 text-[10px]">
            Tax Amount (in words)&nbsp;:&nbsp;&nbsp;
            <span className="text-[11.5px] font-bold">{inWords(taxTotal)}</span>
          </p>
        </div>

        {/* THE FOOT: terms and the declaration left, the bank and the
            signature right */}
        <div className="pi-keep grid grid-cols-[50%_50%]">
          <div className="flex flex-col justify-between px-1.5 pb-1">
            <div>
              {terms.length > 0 && (
                <>
                  <p className="text-[10px] underline">Terms &amp; Conditions</p>
                  <ol className="mt-0.5 space-y-0.5 text-[9.5px] leading-[13px]">
                    {terms.map((term, index) => (
                      <li key={index} className="flex gap-1">
                        <span className="shrink-0">{index + 1}.</span>
                        <span>{term}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>

            <div className="mt-2">
              <p className="text-[10px] underline">Declaration</p>
              <p className="text-[10px] leading-[14px]">
                We declare that invoice shows the actual price of the goods described and that
                all particulars are true and correct.
              </p>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="px-1.5 pb-1 text-[10.5px] leading-[15px]">
              <p>Company&apos;s Bank Details</p>
              {[
                ["A/c Holder's Name", bank.beneficiary_name || profile?.legal_name],
                ["Bank Name", bank.bank_name],
                ["A/c No.", bank.account_number],
                ["Branch & IFS Code", [bank.branch, bank.ifsc].filter(Boolean).join(" & ")],
                ["SWIFT Code", bank.swift],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[28mm_1fr]">
                  <span>{label}</span>
                  <span className="font-bold">: {value || ""}</span>
                </div>
              ))}
            </div>

            <div className={`flex min-h-[20mm] flex-1 flex-col justify-between border-l border-t ${LINE} px-1.5 py-1 text-right`}>
              <p className="text-[10.5px] font-bold">for {profile?.legal_name || ""}</p>
              <p className="text-[10px]">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-1 text-center text-[10px]">This is a Computer Generated Invoice</p>
    </div>
  );
}

/** The Rate | Amount pair under a tax head. */
function FragmentCells() {
  return (
    <>
      <th className={`border ${LINE} w-[14mm] font-normal`}>Rate</th>
      <th className={`border ${LINE} w-[24mm] font-normal`}>Amount</th>
    </>
  );
}

/* =========================================================
   PREVIEW SHEET
========================================================= */

/**
 * The invoice on an A4-width sheet with the PDF's page margins, so the
 * Preview is laid out exactly as the downloaded file is.
 */
export function ProformaInvoiceSheet({
  invoice,
  profile,
}: {
  invoice: ProformaInvoiceModel;
  profile: CompanyProfile | null;
}) {
  useLightModeWhileMounted();

  return (
    <div className="pi-paper mx-auto w-[210mm] max-w-none shrink-0 bg-white p-[8mm] shadow-[0_2px_12px_rgba(15,23,42,0.15)]">
      {/* Controls the PDF hides are hidden on the preview sheet too. */}
      <style>{`.pi-paper .pi-no-print { display: none !important; }`}</style>
      <ProformaInvoiceDocument invoice={invoice} profile={profile} />
    </div>
  );
}

/**
 * The invoice on the Preview page and the order's preview popup: the A4
 * sheet itself, laid out exactly as it prints, then scaled up to fill the
 * screen the same way the proposal preview is - reading the document is
 * the whole job of these screens.
 */
export function ProformaInvoicePreviewCard({
  invoice,
  profile,
}: {
  invoice: ProformaInvoiceModel;
  profile: CompanyProfile | null;
}) {
  return (
    <div className="origin-top [zoom:1.15] xl:[zoom:1.35] 2xl:[zoom:1.55]">
      <div className="pi-paper mx-auto w-[210mm] bg-white p-[8mm] shadow-sm">
        <style>{`.pi-paper .pi-no-print { display: none !important; }`}</style>
        <ProformaInvoiceDocument invoice={invoice} profile={profile} />
      </div>
    </div>
  );
}

/**
 * The PDF is always the light document, so the preview is shown light too:
 * the app's dark mode is lifted while the sheet is open and restored when it
 * closes, exactly as Download PDF does for the print.
 */
function useLightModeWhileMounted() {
  useEffect(() => {
    const root = document.documentElement;

    if (!root.classList.contains("dark")) return;

    root.classList.remove("dark");

    return () => root.classList.add("dark");
  }, []);
}

/* =========================================================
   PRINTING
========================================================= */

const PRINT_CSS = `
.pi-print-root { display: none; }
@media print {
  @page { size: A4; margin: 8mm; }
  /* A white page, not the app's grey, wherever the invoice ends. */
  html, body { background: #fff !important; }
  body > *:not(.pi-print-root) { display: none !important; }
  .pi-print-root { display: block !important; }
  .pi-print-root .pi-no-print { display: none !important; }
  .pi-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* The form is one page; if a long order does run on, a section moves
     to the next page whole rather than splitting. */
  .pi-print-root .pi-keep { break-inside: avoid; page-break-inside: avoid; }
  .pi-print-root tr { break-inside: avoid; page-break-inside: avoid; }
}
`;

/**
 * Renders a copy of the invoice straight under <body>, hidden on screen and
 * the only thing on the page when printed. "Save as PDF" in the print dialog
 * is what produces the downloaded file.
 */
export function PrintableProformaInvoice({
  invoice,
  profile,
}: {
  invoice: ProformaInvoiceModel | null;
  profile: CompanyProfile | null;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !invoice) return null;

  return createPortal(
    <div className="pi-print-root">
      <style>{PRINT_CSS}</style>
      <ProformaInvoiceDocument invoice={invoice} profile={profile} />
    </div>,
    document.body,
  );
}

/**
 * Opens the print dialog for the invoice rendered by PrintableProformaInvoice.
 *
 * Dark mode is lifted for the duration so the PDF is always the light
 * document, and the tab title becomes the file name the browser suggests.
 */
export function usePrintProformaInvoice() {
  return useCallback((reference: string) => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const previousTitle = document.title;

    if (wasDark) root.classList.remove("dark");
    document.title = `Proforma_Invoice_${reference}`;

    const restore = () => {
      if (wasDark) root.classList.add("dark");
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);

    /* One frame so the light styles apply before the print snapshot. */
    requestAnimationFrame(() => window.print());
  }, []);
}
