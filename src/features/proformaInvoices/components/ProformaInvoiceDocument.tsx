"use client";

/**
 * The proforma invoice as the customer sees it.
 *
 * One component serves three places: the detail page of a generated or sent
 * invoice, the Preview of a draft, and the PDF - Download PDF prints a copy
 * of exactly this into a portal, so what is downloaded is what was previewed.
 */

import { ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuFingerprint, LuReceiptText, LuTruck } from "react-icons/lu";

import {
  BankingDetails,
  PrintedAddress,
  ProductsTable,
  TermsBlock,
  TotalsBlock,
  daysBetween,
  formatDate,
  itemToLine,
} from "@/features/proformaInvoices/components/ProformaParts";
import type {
  CompanyProfile,
  ProformaInvoiceModel,
} from "@/features/proformaInvoices/api/proformaInvoices.api";

type ChargeField = "freight" | "lumpsum" | "gstPercent" | "paid";

export default function ProformaInvoiceDocument({
  invoice,
  profile,
  editable,
  onEdit,
  saving,
  onCopied,
}: {
  invoice: ProformaInvoiceModel;
  profile: CompanyProfile | null;
  /** Rows that carry a pencil; omit for a read-only copy. */
  editable?: Partial<Record<ChargeField, boolean>>;
  onEdit?: (field: ChargeField, value: number) => void;
  saving?: boolean;
  onCopied?: (message: string) => void;
}) {
  const reference = invoice.pi_number || `PI-${invoice.id}`;
  const orderNumber = invoice.sales_order?.order_number;
  const validity = daysBetween(invoice.issue_date, invoice.due_date);

  /* Only a generated or sent invoice has been issued; a draft preview must
     not claim to be authenticated. */
  const issued = invoice.status === "GENERATED" || invoice.status === "SENT";

  const signatory = profile?.signatory?.name || invoice.creator_name;

  return (
    <div className="bg-white px-6 py-8 text-slate-800 sm:px-10 dark:bg-[#071929] dark:text-slate-200">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 sm:flex-row dark:border-[#17304a]">
        <div>
          <img src="/logo-light.png" alt="Synergy" className="h-11 w-auto" />

          <div className="mt-3 text-[12px] leading-[17px] text-slate-700 dark:text-slate-300">
            {profile?.legal_name && <p className="font-medium">{profile.legal_name}</p>}
            {profile?.address_lines?.length ? (
              profile.address_lines.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p className="text-slate-400">Company address not configured</p>
            )}
            {profile?.gstin && <p>GSTIN: {profile.gstin}</p>}
          </div>
        </div>

        <div className="sm:text-right">
          <p className="text-[24px] font-medium tracking-wide text-slate-800 dark:text-white">
            PROFORMA INVOICE
          </p>

          <div className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-[10px] sm:inline-grid sm:grid-cols-[auto_auto_auto_auto]">
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

      {/* BILLED / SHIPPED */}
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <AddressCard icon={<LuReceiptText size={16} />} title="Billed To">
          <PrintedAddress
            name={invoice.company_name || invoice.customer_name}
            address={invoice.billing_address}
          />
        </AddressCard>

        <AddressCard icon={<LuTruck size={16} />} title="Shipped To">
          <PrintedAddress
            name={invoice.company_name || invoice.customer_name}
            address={invoice.shipping_address}
          />
        </AddressCard>
      </div>

      {/* PRODUCTS */}
      <div className="mt-6">
        <ProductsTable lines={invoice.items.map(itemToLine)} variant="document" />
      </div>

      <TotalsBlock
        figures={{
          subtotal: invoice.total_amount,
          discount: invoice.discount_amount,
          orc: invoice.orc_amount,
          freight: invoice.freight_charges,
          lumpsum: invoice.installation_lumpsum,
          taxable: invoice.taxable_amount,
          gstPercent: invoice.gst_percent,
          gst: invoice.gst_amount,
          total: invoice.grand_total,
          paid: invoice.amount_paid,
          balance: invoice.balance_due,
        }}
        editable={editable}
        onEdit={onEdit}
        saving={saving}
      />

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
        <p className="mt-4 text-[12px] text-slate-700 dark:text-slate-300">
          <span className="font-semibold">Validity:</span>&nbsp; This Proforma Invoice is
          valid for {validity} Days (Expires: {formatDate(invoice.due_date)}).
        </p>
      )}

      {/* FOOTER */}
      <div className="mt-10 flex flex-col justify-between gap-8 border-t border-slate-200 pt-8 sm:flex-row sm:items-end dark:border-[#17304a]">
        <div>
          <p className="text-[12px] text-slate-700 dark:text-slate-300">Generated by: Synergy SalesCRM</p>
          <p className="mt-1 text-[10px] font-medium text-slate-700 dark:text-slate-300">
            Doc Ref: DOC-{String(invoice.id).padStart(5, "0")}-PI-V1
          </p>
        </div>

        <div className="w-full max-w-[210px] text-center sm:ml-auto">
          <p className="font-serif text-[20px] text-slate-800 dark:text-white">{signatory || " "}</p>
          <div className="my-2 border-t border-slate-300" />
          <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
            {profile?.signatory?.title || "Authorised Signatory"}
          </p>
          {profile?.legal_name && (
            <p className="text-[10px] text-slate-600 dark:text-slate-400">{profile.legal_name}</p>
          )}
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

function AddressCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-100 px-4 pb-4 pt-3 dark:bg-[#0b2034]">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 text-slate-600 dark:border-[#17304a] dark:text-slate-300">
        {icon}
        <span className="text-[13px] font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

/* =========================================================
   PRINTING
========================================================= */

const PRINT_CSS = `
.pi-print-root { display: none; }
@media print {
  @page { size: A4; margin: 8mm; }
  body > *:not(.pi-print-root) { display: none !important; }
  .pi-print-root { display: block !important; }
  .pi-print-root .pi-no-print { display: none !important; }
  .pi-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pi-print-root table, .pi-print-root tr { page-break-inside: avoid; }
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
