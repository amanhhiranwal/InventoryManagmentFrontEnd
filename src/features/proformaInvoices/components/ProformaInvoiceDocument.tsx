"use client";

/**
 * The proforma invoice as the customer sees it.
 *
 * One component serves the Preview and the PDF: Download PDF prints a copy of
 * exactly this, and the Preview shows it on an A4-width sheet with the PDF's
 * margins. Its layout is fixed rather than responsive, because the printed
 * page is narrower than the screen breakpoints - a responsive layout printed
 * differently from how it previewed.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuFingerprint } from "react-icons/lu";

import {
  BankingDetails,
  TermsBlock,
  daysBetween,
  formatDate,
} from "@/features/proformaInvoices/components/ProformaParts";
import {
  AmountsInWords,
  GoodsTable,
  HsnTaxSummary,
  InvoiceTotals,
  PartyBlock,
  ReferencePanel,
} from "@/features/proformaInvoices/components/TaxInvoiceParts";
import type {
  CompanyProfile,
  ProformaInvoiceModel,
} from "@/features/proformaInvoices/api/proformaInvoices.api";

export default function ProformaInvoiceDocument({
  invoice,
  profile,
  onCopied,
}: {
  invoice: ProformaInvoiceModel;
  profile: CompanyProfile | null;
  onCopied?: (message: string) => void;
}) {
  const reference = invoice.pi_number || `PI-${invoice.id}`;
  const orderNumber = invoice.sales_order?.order_number;
  const validity = daysBetween(invoice.issue_date, invoice.due_date);

  /* Only a generated or sent invoice has been issued; a draft preview must
     not claim to be authenticated. */
  const issued = invoice.status === "GENERATED" || invoice.status === "SENT";

  const signatory = profile?.signatory?.name || invoice.creator_name;

  /* A GSTIN is held on the account rather than on the invoice, so it is
     read from whichever the document carries. Absent, the line is left
     off rather than printed empty - a blank registration on a tax
     document reads as a claim that there is none. */
  const billGstin =
    (invoice.customer_information as Record<string, unknown> | undefined)?.gst as
      | string
      | undefined;
  const shipGstin = billGstin;

  const summary = invoice.tax_summary;

  return (
    <div className="pi-paper @container bg-white px-10 py-8 text-slate-800">
      {/* HEADER */}
      <div className="pi-keep flex flex-row justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <img src="/logo-light.png" alt="Synergy" className="h-11 w-auto" />

          <div className="mt-3 text-[12px] leading-[17px] text-slate-700">
            {profile?.legal_name && <p className="font-medium">{profile.legal_name}</p>}
            {profile?.address_lines?.length ? (
              profile.address_lines.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p className="text-slate-400">Company address not configured</p>
            )}
            {profile?.gstin && <p>GSTIN: {profile.gstin}</p>}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[24px] font-medium tracking-wide text-slate-800">
            PROFORMA INVOICE
          </p>

          <div className="mt-1 inline-grid grid-cols-[auto_auto_auto_auto] gap-x-3 gap-y-1 text-[10px]">
            <span className="text-slate-500">Sales Order ID:</span>
            <span className="font-semibold">{orderNumber ? `#${orderNumber}` : "-"}</span>
            <span className="text-slate-500">PI ID:</span>
            <span className="font-semibold">#{reference}</span>
            <span className="text-slate-500">PI Date (Issue)</span>
            <span className="font-semibold">{formatDate(invoice.issue_date)}</span>
            <span className="text-slate-500">PI Date (Due)</span>
            <span className="font-semibold">{formatDate(invoice.due_date)}</span>
          </div>
        </div>
      </div>

      {/* THE PARTIES AND THE REFERENCES

          Three panels in the design's own card language. A GST document
          identifies both sides by registration and state, because that
          pair is what decides how the tax splits - so the panels carry
          the GSTIN and the state code rather than the address alone. */}
      <div className="pi-keep mt-6 grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2">
        <PartyBlock
          title="Buyer (Bill To)"
          name={invoice.company_name || invoice.customer_name}
          lines={addressLines(invoice.billing_address)}
          gstin={billGstin}
          stateName={invoice.billing_address?.state}
          stateCode={invoice.buyer_state_code}
        />

        <PartyBlock
          title="Consignee (Ship To)"
          name={invoice.company_name || invoice.customer_name}
          lines={addressLines(invoice.shipping_address)}
          gstin={shipGstin}
          stateName={invoice.shipping_address?.state}
          stateCode={invoice.buyer_state_code}
        />
      </div>

      <div className="pi-keep mt-4">
        <ReferencePanel
          invoice={invoice}
          orderNumber={orderNumber}
          reference={reference}
          issueDate={formatDate(invoice.issue_date)}
        />
      </div>

      {/* THE GOODS, AND THE ARITHMETIC THAT FOLLOWS THEM */}
      <div className="mt-6">
        <GoodsTable invoice={invoice} summary={summary} />
      </div>

      <InvoiceTotals invoice={invoice} summary={summary} />

      {/* THE TAX, SHOWN RATHER THAN STATED

          A GST document carries the taxable value and the tax under each
          HSN, so a reader can check the arithmetic rather than take the
          total on trust. Both figures also appear in words: digits can be
          altered with a pen and words cannot. */}
      {summary && summary.rows.length > 0 && (
        <div className="pi-keep mt-6 space-y-4">
          <HsnTaxSummary summary={summary} />
          <AmountsInWords invoice={invoice} />
        </div>
      )}

      <p className="mt-2 text-right text-[10px] italic text-slate-500">E. &amp; O.E</p>

      <div className="mt-6">
        <BankingDetails profile={profile} reference={reference} onCopied={onCopied} />
      </div>

      <div className="mt-6">
        <TermsBlock
          terms={invoice.commercial_terms}
          notes={invoice.technical_notes}
          showHeading={false}
        />
      </div>

      {validity !== null && (
        <p className="mt-4 text-[12px] text-slate-700">
          <span className="font-semibold">Validity:</span>&nbsp; This Proforma Invoice is
          valid for {validity} Days (Expires: {formatDate(invoice.due_date)}).
        </p>
      )}

      {/* FOOTER */}
      <div className="pi-keep mt-10 flex flex-row items-end justify-between gap-8 border-t border-slate-200 pt-8">
        <div>
          <p className="text-[12px] text-slate-700">
            This is a Computer Generated Document
          </p>
          <p className="mt-1 text-[10px] text-slate-600">Generated by Synergy SalesCRM</p>
          <p className="mt-1 text-[10px] font-medium text-slate-700">
            Doc Ref: DOC-{String(invoice.id).padStart(5, "0")}-PI-V1
          </p>
        </div>

        <div className="ml-auto w-[230px] text-center">
          {/* "for <COMPANY>" above the signature, as a company signs a
              document rather than a person signing on their own account. */}
          {profile?.legal_name && (
            <p className="text-[10px] font-semibold text-slate-700">
              for {profile.legal_name}
            </p>
          )}

          <p className="font-serif text-[20px] text-slate-800">{signatory || " "}</p>
          <div className="my-2 border-t border-slate-300" />
          <p className="text-[12px] font-medium text-slate-700">
            {profile?.signatory?.title || "Authorised Signatory"}
          </p>
          {issued && (
            <p className="mt-1 flex items-center justify-center gap-1 text-[9px] text-blue-500">
              <LuFingerprint size={11} />
              Digitally Authenticated
            </p>
          )}
        </div>
      </div>
    </div>
  );
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
    [address.city, address.pin].filter(Boolean).join(" "),
    [address.state, address.country].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];
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
 * The invoice on the Preview page: the document in a full-width white card,
 * as in the design, with the controls the PDF hides hidden here too.
 */
export function ProformaInvoicePreviewCard({
  invoice,
  profile,
}: {
  invoice: ProformaInvoiceModel;
  profile: CompanyProfile | null;
}) {
  return (
    <div className="pi-paper overflow-hidden rounded-xl bg-white">
      <style>{`.pi-paper .pi-no-print { display: none !important; }`}</style>
      <ProformaInvoiceDocument invoice={invoice} profile={profile} />
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
  /* A section never splits across pages - banking details, totals, terms,
     addresses and the signature move to the next page whole. A long
     products table may still run on, but never breaks inside a row, and its
     header repeats on the new page. */
  .pi-print-root .pi-keep { break-inside: avoid; page-break-inside: avoid; }
  .pi-print-root tr { break-inside: avoid; page-break-inside: avoid; }
  .pi-print-root thead { display: table-header-group; }
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
