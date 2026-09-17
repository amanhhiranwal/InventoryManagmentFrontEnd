"use client";

/**
 * Building blocks shared by every Proforma Invoice screen - the Generate
 * form, the draft detail page and the printable document - so the products
 * table, totals, banking details and terms read identically on all three.
 */

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  LuBox,
  LuCopy,
  LuLandmark,
  LuMinus,
  LuPencil,
  LuPlus,
  LuQrCode,
  LuSearch,
  LuShield,
  LuTrash2,
  LuX,
} from "react-icons/lu";

import {
  PRODUCT_CATALOG,
  PRODUCT_CATEGORIES,
  productSku,
} from "@/features/catalog/productCatalog";
import type {
  CompanyProfile,
  ProformaAddress,
  ProformaInvoiceItem,
} from "@/features/proformaInvoices/api/proformaInvoices.api";

/* =========================================================
   FORMATTING
========================================================= */

export const money = (value?: number | null) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const plainAmount = (value?: number | null) =>
  Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/** "₹8.46 Cr", "₹48.6 L" - the short form the KPI cards and list use. */
export function compactMoney(value?: number | null) {
  const amount = Number(value || 0);
  const trim = (n: number) => String(Number(n.toFixed(2)));

  if (Math.abs(amount) >= 1e7) return `₹${trim(amount / 1e7)} Cr`;
  if (Math.abs(amount) >= 1e5) return `₹${trim(amount / 1e5)} L`;

  return money(amount);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** YYYY-MM-DD for a date input. */
export const toDateInput = (value?: string | Date | null) => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Whole days between two dates, for "valid for 30 Days". */
export function daysBetween(from?: string | null, to?: string | null) {
  if (!from || !to) return null;

  const start = new Date(from).getTime();
  const end = new Date(to).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  return Math.round((end - start) / 86400000);
}

/* =========================================================
   LINES AND TOTALS
========================================================= */

/** One product line as the pickers and form hold it. */
export interface EditableLine {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  quantity: number;
  discount: number;
  tax: number;
}

export function itemToLine(item: ProformaInvoiceItem, index: number): EditableLine {
  const catalogued = PRODUCT_CATALOG.find(
    (product) => product.id === String(item.product_id),
  );

  return {
    id: String(item.product_id || `line-${index}`),
    name: item.model || item.description || item.item || "Product",
    category: item.product || catalogued?.category || "",
    sku: item.sku || (item.product_id ? productSku(String(item.product_id)) : ""),
    price: Number(item.price ?? item.rate) || 0,
    quantity: Number(item.quantity_case ?? item.qty) || 1,
    discount: Number(item.discount) || 0,
    tax: Number(item.tax_rate) || 0,
  };
}

export function lineToItem(line: EditableLine): ProformaInvoiceItem {
  return {
    product_id: line.id,
    product: line.category,
    model: line.name,
    sku: line.sku,
    description: line.name,
    rate: line.price,
    price: line.price,
    quantity_case: line.quantity,
    quantity_kg_ltr: 0,
    discount: line.discount,
    tax_rate: line.tax,
  };
}

/**
 * Every money figure, mirroring compute_order_totals on the backend so the
 * form shows what will be saved. The backend recomputes on write regardless.
 */
export function computeTotals(
  lines: EditableLine[],
  charges: {
    discountMode?: string | null;
    discountInput?: number | null;
    orcMode?: string | null;
    orcInput?: number | null;
    freight: number;
    lumpsum: number;
    gstPercent: number;
    amountPaid: number;
  },
) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);

  let discount = lines.reduce(
    (sum, line) => sum + (line.quantity * line.price * line.discount) / 100,
    0,
  );

  if (charges.discountInput !== null && charges.discountInput !== undefined) {
    discount =
      charges.discountMode === "PERCENT"
        ? (subtotal * charges.discountInput) / 100
        : charges.discountInput;
  }

  discount = Math.max(0, Math.min(discount, subtotal));

  const orc =
    charges.orcInput === null || charges.orcInput === undefined
      ? 0
      : charges.orcMode === "PERCENT"
        ? (subtotal * charges.orcInput) / 100
        : charges.orcInput;

  const taxable = subtotal - discount + orc + charges.freight + charges.lumpsum;
  const gst = (taxable * charges.gstPercent) / 100;
  const total = taxable + gst;
  const paid = Math.max(0, Math.min(charges.amountPaid, total));

  return { subtotal, discount, orc, taxable, gst, total, paid, balance: total - paid };
}

/* =========================================================
   LAYOUT
========================================================= */

export function SectionTitle({
  icon,
  title,
  action,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-[#17304a] ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-slate-600 dark:text-slate-300">{icon}</span>

        <h3 className="whitespace-nowrap text-[14px] font-semibold text-slate-800 dark:text-white">
          {title}
        </h3>
      </div>

      {action}
    </div>
  );
}

/** "Label:   value" pair used by the overview and organisation blocks. */
export function InfoRow({
  label,
  value,
  labelWidth = "w-[110px]",
}: {
  label: string;
  value?: ReactNode;
  labelWidth?: string;
}) {
  const empty = value === null || value === undefined || value === "";

  return (
    <div className="flex items-start">
      <span className={`${labelWidth} shrink-0 text-[11px] text-slate-500`}>
        {label}:
      </span>

      <span className="min-w-0 break-words text-[11px] font-semibold text-slate-800 dark:text-white">
        {empty ? "-" : value}
      </span>
    </div>
  );
}

export function UserChip({ name }: { name?: string | null }) {
  const label = name || "Unassigned";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[8px] dark:bg-[#17304a]">
        {label.charAt(0).toUpperCase()}
      </span>
      {label}
    </span>
  );
}

/* =========================================================
   ADDRESSES
========================================================= */

const COUNTRIES = ["India", "United States", "China", "Malaysia", "Indonesia"];

export function AddressFields({
  title,
  address,
  onChange,
  disabled,
  header,
  compact = false,
  readOnly = false,
}: {
  title: string;
  address: ProformaAddress;
  onChange: (next: ProformaAddress) => void;
  disabled?: boolean;
  /** Show the saved values in the same fields, without allowing edits. */
  readOnly?: boolean;
  header?: ReactNode;
  /** Street and state on one row, as the Generate form lays them out. */
  compact?: boolean;
}) {
  const set = (field: keyof ProformaAddress, value: string) =>
    onChange({ ...address, [field]: value });

  const input = `h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#233353] disabled:bg-slate-50 disabled:text-slate-400 dark:border-[#17304a] dark:bg-[#051422] dark:text-white ${
    readOnly
      ? "cursor-default focus:border-slate-200 disabled:bg-white disabled:text-slate-700 dark:disabled:bg-[#051422] dark:disabled:text-white"
      : ""
  }`;

  const label = "mb-1.5 block text-[11px] text-slate-500";

  const street = (
    <div>
      <label className={label}>
        Street Address<span className="text-rose-500">*</span>
      </label>
      <input
        value={address.street || ""}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => set("street", event.target.value)}
        placeholder="Street Address, Building, Suite"
        className={input}
      />
    </div>
  );

  const state = (
    <div>
      <label className={label}>
        State / Province<span className="text-rose-500">*</span>
      </label>
      <input
        value={address.state || ""}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => set("state", event.target.value)}
        placeholder="State"
        className={input}
      />
    </div>
  );

  const city = (
    <div>
      <label className={label}>
        City<span className="text-rose-500">*</span>
      </label>
      <input
        value={address.city || ""}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => set("city", event.target.value)}
        placeholder="Type or select"
        className={input}
      />
    </div>
  );

  const country = (
    <div>
      <label className={label}>
        Country<span className="text-rose-500">*</span>
      </label>
      <select
        value={address.country || ""}
        disabled={disabled || readOnly}
        onChange={(event) => set("country", event.target.value)}
        className={input}
      >
        <option value="">Select here</option>
        {[...new Set([...(address.country ? [address.country] : []), ...COUNTRIES])].map(
          (option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ),
        )}
      </select>
    </div>
  );

  const pin = (
    <div>
      <label className={label}>
        PIN / ZIP Code<span className="text-rose-500">*</span>
      </label>
      <input
        value={address.pin || ""}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => set("pin", event.target.value)}
        placeholder="Pin Code"
        className={input}
      />
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-[#17304a]">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {title}
        </p>
        {header}
      </div>

      {compact ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {street}
            {state}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr]">
            {city}
            {country}
            {pin}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {street}
          <div className="grid grid-cols-2 gap-3">
            {state}
            {city}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {country}
            {pin}
          </div>
        </div>
      )}
    </div>
  );
}

/** Address as printed on the document: company, street, state + city, country + PIN. */
export function PrintedAddress({
  name,
  address,
}: {
  name?: string | null;
  address: ProformaAddress;
}) {
  const hasAny = address.street || address.city || address.state || address.country;

  return (
    <div>
      <p className="text-[18px] font-medium text-slate-900 dark:text-white">{name || "-"}</p>

      {hasAny ? (
        <div className="mt-1 text-[11px] leading-[17px] text-slate-600 dark:text-slate-400">
          {address.street && <p>{address.street}</p>}
          {(address.state || address.city) && (
            <p>{[address.state, address.city].filter(Boolean).join(" ")}</p>
          )}
          {(address.country || address.pin) && (
            <p>{[address.country, address.pin].filter(Boolean).join(" ")}</p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-slate-400">No address recorded.</p>
      )}
    </div>
  );
}

/* =========================================================
   PRODUCTS TABLE
========================================================= */

export function ProductsTable({
  lines,
  variant = "form",
  onRemove,
}: {
  lines: EditableLine[];
  /** "document" gives the navy header the printed invoice uses. */
  variant?: "form" | "document";
  onRemove?: (index: number) => void;
}) {
  const documentStyle = variant === "document";

  const th = `px-3 py-3 text-[11px] font-normal ${
    documentStyle ? "text-white" : "text-slate-500"
  }`;

  return (
    <div
      className={
        documentStyle
          ? "overflow-x-auto"
          : "overflow-x-auto rounded-xl border border-slate-200 dark:border-[#17304a]"
      }
    >
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr
            className={
              documentStyle
                ? "bg-[#233353] [&>th:first-child]:rounded-tl-xl [&>th:last-child]:rounded-tr-xl"
                : "border-b border-slate-200 dark:border-[#17304a]"
            }
          >
            <th className={`${th} w-[28%] text-left`}>Product</th>
            <th className={`${th} w-[20%] text-left`}>Model / Variant</th>
            <th className={`${th} text-left`}>Qty</th>
            <th className={`${th} text-left`}>Discount</th>
            <th className={`${th} text-left`}>Tax</th>
            <th className={`${th} text-right`}>Unit Price</th>
            {onRemove && <th className={`${th} w-12`} />}
          </tr>
        </thead>

        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={onRemove ? 7 : 6} className="py-10 text-center text-xs text-slate-400">
                No products on this invoice.
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr
                key={`${line.id}-${index}`}
                className={
                  documentStyle
                    ? "border-b border-slate-100 last:border-slate-300"
                    : "border-b border-slate-100 last:border-0 dark:border-[#17304a]/70"
                }
              >
                <td className="px-3 py-3">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-white">
                    {line.category || line.name}
                  </p>
                  {line.sku && (
                    <p className="text-[9px] text-slate-500">SKU: {line.sku}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-[10px] text-slate-500">{line.name}</td>
                <td className="px-3 py-3 text-[11px] text-slate-700 dark:text-slate-200">
                  {line.quantity}
                </td>
                <td className="px-3 py-3 text-[11px] text-slate-700 dark:text-slate-200">
                  {line.discount} %
                </td>
                <td className="px-3 py-3 text-[11px] text-slate-700 dark:text-slate-200">
                  {line.tax} %
                </td>
                <td className="px-3 py-3 text-right text-[11px] text-slate-700 dark:text-slate-200">
                  {plainAmount(line.price)}
                </td>
                {onRemove && (
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => onRemove(index)}
                      className="pi-no-print rounded-md p-1.5 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <LuTrash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   TOTALS
========================================================= */

export interface TotalsFigures {
  subtotal: number;
  discount: number;
  orc: number;
  freight: number;
  lumpsum: number;
  taxable: number;
  gstPercent: number;
  gst: number;
  total: number;
  paid: number;
  balance: number;
}

type ChargeField = "freight" | "lumpsum" | "gstPercent" | "paid";

export function TotalsBlock({
  figures,
  editable = {},
  onEdit,
  saving,
}: {
  figures: TotalsFigures;
  /** Which rows carry a pencil. */
  editable?: Partial<Record<ChargeField, boolean>>;
  onEdit?: (field: ChargeField, value: number) => void;
  saving?: boolean;
}) {
  return (
    <div className="pi-keep mt-5 flex justify-end">
      <div className="w-full max-w-[420px] px-3">
        <TotalsRow label="Subtotal" value={money(figures.subtotal)} />

        {/* Only shown when there is something to show. The design has no
            discount or ORC row, but an invoice carrying one from its order
            would otherwise not add up on the page. */}
        {figures.discount > 0 && (
          <TotalsRow label="Discount" value={`-${money(figures.discount)}`} tone="rose" />
        )}

        {figures.orc > 0 && <TotalsRow label="ORC" value={`+${money(figures.orc)}`} />}

        <TotalsRow
          label="Freight Charges"
          value={`+${money(figures.freight)}`}
          edit={editable.freight ? figures.freight : undefined}
          onCommit={(next) => onEdit?.("freight", next)}
          saving={saving}
        />

        <TotalsRow
          label="Lumpsum (Installation)"
          value={`+${money(figures.lumpsum)}`}
          edit={editable.lumpsum ? figures.lumpsum : undefined}
          onCommit={(next) => onEdit?.("lumpsum", next)}
          saving={saving}
        />

        <Divider />

        <TotalsRow label="Taxable Amount" value={money(figures.taxable)} />

        <TotalsRow
          label={`Estimated GST (${Number(figures.gstPercent.toFixed(2))}%)`}
          name="Estimated GST"
          value={money(figures.gst)}
          edit={editable.gstPercent ? figures.gstPercent : undefined}
          unit="%"
          onCommit={(next) => onEdit?.("gstPercent", Math.min(100, next))}
          saving={saving}
        />

        <Divider />

        <TotalsRow label="Total Payable" value={money(figures.total)} strong />

        <Divider />

        <TotalsRow
          label="Amount Paid"
          value={`-${money(figures.paid)}`}
          tone="rose"
          edit={editable.paid ? figures.paid : undefined}
          onCommit={(next) => onEdit?.("paid", next)}
          saving={saving}
        />

        <TotalsRow label="Balance Due" value={money(figures.balance)} />
      </div>
    </div>
  );
}

function Divider() {
  return <div className="my-2 ml-auto w-[62%] border-t border-slate-200 dark:border-[#17304a]" />;
}

function TotalsRow({
  label,
  name,
  value,
  tone,
  strong,
  edit,
  unit,
  onCommit,
  saving,
}: {
  label: string;
  name?: string;
  value: string;
  tone?: "rose";
  strong?: boolean;
  /** Current raw value; when set, the row carries a pencil. */
  edit?: number;
  unit?: "%";
  onCommit?: (next: number) => void;
  saving?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  /* Enter followed by the blur of the closing input - or a repeated Enter -
     would otherwise save the same edit twice. */
  const committed = useRef(false);

  const start = () => {
    committed.current = false;
    setDraft(String(edit ?? 0));
    setEditing(true);
  };

  const commit = () => {
    if (committed.current) return;

    committed.current = true;

    const next = Math.max(0, Number(draft.replace(/[^\d.]/g, "")) || 0);

    setEditing(false);

    if (next !== edit) onCommit?.(next);
  };

  return (
    <div className="flex items-center justify-end gap-4 py-1.5">
      <span className="flex items-center gap-1 text-right text-[12px] text-slate-500">
        {label}
        {edit !== undefined && (
          <button
            type="button"
            aria-label={`Edit ${name || label}`}
            disabled={saving}
            onClick={start}
            className="pi-no-print text-slate-500 transition hover:text-slate-800 disabled:opacity-40"
          >
            <LuPencil size={11} />
          </button>
        )}
        :
      </span>

      <span className="flex w-[130px] shrink-0 justify-end">
        {editing ? (
          <span className="flex items-center gap-1">
            {unit !== "%" && <span className="text-[11px] text-slate-400">₹</span>}
            <input
              autoFocus
              inputMode="decimal"
              aria-label={name || label}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") {
                  committed.current = true;
                  setEditing(false);
                }
              }}
              className="h-7 w-24 rounded-md border border-slate-300 px-2 text-right text-[11px] text-slate-800 outline-none focus:border-[#233353]"
            />
            {unit === "%" && <span className="text-[11px] text-slate-400">%</span>}
          </span>
        ) : (
          <span
            className={`text-right ${
              strong ? "text-[13px]" : "text-[12px]"
            } font-semibold ${
              tone === "rose" ? "text-rose-500" : "text-slate-900 dark:text-white"
            }`}
          >
            {value}
          </span>
        )}
      </span>
    </div>
  );
}

/* =========================================================
   BANKING DETAILS
========================================================= */

export function BankingDetails({
  profile,
  reference,
  onCopied,
}: {
  profile: CompanyProfile | null;
  /** The PI number the customer quotes on their transfer; unset until saved. */
  reference?: string | null;
  onCopied?: (what: string) => void;
}) {
  const bank = profile?.bank || {};

  const copy = async (text?: string | null, what = "Copied") => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      onCopied?.(what);
    } catch {
      /* Clipboard is unavailable on insecure origins; nothing to do. */
    }
  };

  const notSet = <span className="font-normal text-slate-400">Not configured</span>;

  return (
    <div className="pi-keep @container">
      <SectionTitle icon={<LuLandmark size={17} />} title="Banking Details" />

      {/* Sized by the space it has, not the window: the PDF page is narrower
          than the md breakpoint, which used to stack these on paper while
          the Preview showed them side by side. */}
      <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2">
        <div className="rounded-xl bg-slate-100 p-4 dark:bg-[#0b2034]">
          <p className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300">
            Settlement &amp; Remittance Banking Details
          </p>

          <div className="space-y-3">
            <InfoRow
              label="Beneficiary Account Name"
              labelWidth="w-[120px]"
              value={bank.beneficiary_name || profile?.legal_name || notSet}
            />
            <InfoRow label="Bank Name" labelWidth="w-[120px]" value={bank.bank_name || notSet} />
            <InfoRow label="Branch Name" labelWidth="w-[120px]" value={bank.branch || notSet} />
            <InfoRow
              label="Account Number"
              labelWidth="w-[120px]"
              value={bank.account_number || notSet}
            />
            <InfoRow label="IFSC Code" labelWidth="w-[120px]" value={bank.ifsc || notSet} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-slate-100 p-4 dark:bg-[#0b2034]">
            <p className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300">
              Virtual UPI Settlement
            </p>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-200/60 px-3 py-3 dark:bg-[#071929]">
              <div className="flex min-w-0 items-center gap-3">
                <LuQrCode size={20} className="shrink-0 text-slate-700 dark:text-slate-300" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-slate-800 dark:text-white">
                    UPI Corporate VPA
                  </p>
                  <p className="break-all text-[10px] text-slate-600 dark:text-slate-400">
                    {bank.upi_vpa || "Not configured"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!bank.upi_vpa}
                onClick={() => copy(bank.upi_vpa, "UPI ID copied.")}
                className="pi-no-print flex shrink-0 items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[10px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                <LuCopy size={11} />
                Copy
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-slate-100 p-4 dark:bg-[#0b2034]">
            <p className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300">
              Remittance Advice Reference
            </p>

            <div className="flex items-center">
              <span className="w-[110px] shrink-0 text-[11px] text-slate-500">Reference:</span>
              {reference ? (
                <button
                  type="button"
                  onClick={() => copy(reference, "Reference copied.")}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 dark:bg-[#071929] dark:text-slate-200"
                >
                  <LuCopy size={10} />
                  {reference}
                </button>
              ) : (
                <span className="text-[10px] text-slate-400">Assigned on save</span>
              )}
            </div>

            <p className="mt-3 text-[10px] leading-[15px] text-slate-500">
              Please mention {reference || "the PI number"} in NEFT/RTGS/UPI
              transaction remarks for automated payment reconciliation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TERMS
========================================================= */

export function TermsBlock({
  terms,
  notes,
  showHeading = true,
  onTermsChange,
  onNotesChange,
}: {
  terms: string[];
  notes?: string | null;
  /** The printed document drops the "Pre-filled" caption. */
  showHeading?: boolean;
  onTermsChange?: (next: string[]) => void;
  onNotesChange?: (next: string) => void;
}) {
  const editable = Boolean(onTermsChange);

  return (
    <div className="pi-keep">
      <SectionTitle
        icon={<LuShield size={17} />}
        title="Terms, Conditions & Technical Notes"
      />

      <div className="rounded-xl bg-slate-100 px-4 py-3 dark:bg-[#0b2034]">
        {showHeading && (
          <p className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300">
            Pre-filled Commercial Conditions
          </p>
        )}

        {terms.length === 0 && !editable ? (
          <p className="text-[11px] text-slate-400">No commercial conditions recorded.</p>
        ) : (
          <ul className="space-y-1.5">
            {terms.map((term, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[#233353] dark:bg-slate-300" />

                {editable ? (
                  <AutoTextarea
                    value={term}
                    onChange={(next) =>
                      onTermsChange?.(terms.map((t, i) => (i === index ? next : t)))
                    }
                  />
                ) : (
                  <span className="text-[12px] leading-5 text-slate-700 dark:text-slate-300">
                    {term}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mb-2 mt-4 text-[12px] font-medium text-slate-500">
        Technical Scope &amp; Deployment Notes
      </p>

      {onNotesChange ? (
        <textarea
          rows={3}
          value={notes || ""}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Agreed scope, installation and training notes."
          className="w-full resize-none rounded-xl bg-slate-100 p-3 text-[12px] leading-5 text-slate-700 outline-none focus:ring-1 focus:ring-slate-300 dark:bg-[#0b2034] dark:text-slate-300"
        />
      ) : (
        <p className="rounded-xl bg-slate-100 p-3 text-[12px] leading-5 text-slate-700 dark:bg-[#0b2034] dark:text-slate-300">
          {notes || <span className="text-slate-400">No technical notes recorded.</span>}
        </p>
      )}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const node = ref.current;

    if (node) {
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1 py-0 text-[12px] leading-5 text-slate-700 outline-none hover:border-slate-300 focus:border-slate-300 focus:bg-white dark:text-slate-300 dark:focus:bg-[#051422]"
    />
  );
}

/* =========================================================
   ORDER SUMMARY
========================================================= */

export function OrderSummaryCard({
  icon,
  total,
  advancePercent,
}: {
  icon: ReactNode;
  total: number;
  advancePercent: number;
}) {
  const advance = (total * advancePercent) / 100;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-[#17304a] dark:bg-[#071929]">
      <SectionTitle icon={icon} title="Order Summary" />

      <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-4 shadow-[inset_0_-2px_0_rgba(16,185,129,0.25)] dark:bg-emerald-950/20">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Total Payable
        </span>
        <span className="text-[22px] font-medium text-slate-900 dark:text-white">
          {money(total)}
        </span>
      </div>

      <p className="mb-3 mt-4 border-b border-slate-200 pb-2 text-[11px] text-slate-500 dark:border-[#17304a]">
        Payment Terms:
      </p>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {Number(advancePercent)}% Advance
          </span>
          <span className="text-[11px] font-semibold text-slate-900 dark:text-white">
            {money(advance)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {100 - Number(advancePercent)}% Against Delivery
          </span>
          <span className="text-[11px] font-semibold text-slate-900 dark:text-white">
            {money(total - advance)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ADD PRODUCTS MODAL
========================================================= */

const TAX_OPTIONS = [0, 5, 12, 18, 28];

export function ProductPickerModal({
  initial,
  onClose,
  onConfirm,
}: {
  initial: EditableLine[];
  onClose: () => void;
  onConfirm: (lines: EditableLine[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<EditableLine[]>(initial);

  const products = useMemo(() => {
    const query = search.trim().toLowerCase();

    return PRODUCT_CATALOG.filter(
      (product) =>
        (category === "All" || product.category === category) &&
        (!query ||
          product.name.toLowerCase().includes(query) ||
          productSku(product.id).toLowerCase().includes(query)),
    );
  }, [search, category]);

  const toggle = (id: string) => {
    const product = PRODUCT_CATALOG.find((entry) => entry.id === id);

    if (!product) return;

    setSelected((current) =>
      current.some((line) => line.id === id)
        ? current.filter((line) => line.id !== id)
        : [
            ...current,
            {
              id: product.id,
              name: product.name,
              category: product.category,
              sku: productSku(product.id),
              price: product.price,
              quantity: 1,
              discount: 0,
              tax: 18,
            },
          ],
    );
  };

  const update = (id: string, patch: Partial<EditableLine>) =>
    setSelected((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );

  const lineTotal = selected.reduce((sum, line) => sum + line.price * line.quantity, 0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5">
      <div className="flex h-[600px] max-h-[92vh] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#051422]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-[#17304a]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
            Add Products to Order
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <LuX size={17} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name, model or SKU..."
              className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-xs outline-none focus:border-slate-400 dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
            />
            <LuSearch
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
          </div>
        </div>

        <div className="px-5 pt-3">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-[#17304a]">
            {PRODUCT_CATEGORIES.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setCategory(entry)}
                className={`whitespace-nowrap px-3 py-2 text-[10px] font-medium ${
                  category === entry
                    ? "rounded-t-md bg-[#233353] text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300"
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-hidden px-5 py-4 md:grid-cols-2">
          <div className="space-y-2 overflow-y-auto pr-1">
            {products.map((product) => {
              const checked = selected.some((line) => line.id === product.id);

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggle(product.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    checked
                      ? "border-slate-300 bg-slate-100 dark:border-[#17304a] dark:bg-[#0b2034]"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-[#17304a] dark:bg-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border text-[9px] ${
                        checked
                          ? "border-[#233353] bg-[#233353] text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {checked && "✓"}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white">
                        {product.name}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {money(product.price)} • {product.available} available
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {products.length === 0 && (
              <p className="py-10 text-center text-xs text-slate-400">
                No products match your search.
              </p>
            )}
          </div>

          <div className="overflow-y-auto md:border-l md:border-slate-100 md:pl-5 dark:md:border-[#17304a]">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-[#17304a]">
              <LuBox size={17} className="text-slate-600" />
              <h3 className="text-[14px] font-semibold text-slate-800 dark:text-white">
                Selected Products
              </h3>
            </div>

            {selected.length === 0 ? (
              <div className="flex h-[260px] flex-col items-center justify-center text-center">
                <LuBox size={22} className="mb-3 text-slate-400" />
                <p className="text-xs font-medium text-slate-400">No Product Selected</p>
                <p className="mt-1 text-[9px] text-slate-400">Select product to get started</p>
              </div>
            ) : (
              <div className="space-y-3 pt-3">
                {selected.map((line) => (
                  <div
                    key={line.id}
                    className="rounded-xl border border-slate-200 p-4 dark:border-[#17304a]"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white">
                        {line.name}
                      </p>
                      <button
                        type="button"
                        aria-label={`Remove ${line.name}`}
                        onClick={() =>
                          setSelected((current) => current.filter((l) => l.id !== line.id))
                        }
                        className="text-rose-500"
                      >
                        <LuTrash2 size={14} />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Quantity</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={line.quantity <= 1}
                          onClick={() => update(line.id, { quantity: line.quantity - 1 })}
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 disabled:opacity-30"
                        >
                          <LuMinus size={11} />
                        </button>
                        <span className="w-5 text-center text-xs">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => update(line.id, { quantity: line.quantity + 1 })}
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-300"
                        >
                          <LuPlus size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[9px] text-slate-500">Unit Price (₹)</span>
                        <span className="flex h-9 items-center rounded-md border border-slate-200 px-2 text-xs dark:border-[#17304a]">
                          <span className="mr-1 text-slate-400">₹</span>
                          <input
                            inputMode="decimal"
                            value={plainAmount(line.price)}
                            onChange={(event) =>
                              update(line.id, {
                                price: Number(event.target.value.replace(/[^\d.]/g, "")) || 0,
                              })
                            }
                            className="w-full min-w-0 bg-transparent outline-none"
                          />
                        </span>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[9px] text-slate-500">Discount (%)</span>
                        <input
                          inputMode="decimal"
                          value={String(line.discount)}
                          onChange={(event) =>
                            update(line.id, {
                              discount: Math.min(
                                100,
                                Number(event.target.value.replace(/[^\d.]/g, "")) || 0,
                              ),
                            })
                          }
                          className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs outline-none dark:border-[#17304a] dark:bg-transparent"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[9px] text-slate-500">Tax (GST %)</span>
                        <select
                          value={line.tax}
                          onChange={(event) => update(line.id, { tax: Number(event.target.value) })}
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-[#17304a] dark:bg-[#071929]"
                        >
                          {[...new Set([...TAX_OPTIONS, line.tax])]
                            .sort((a, b) => a - b)
                            .map((rate) => (
                              <option key={rate} value={rate}>
                                {rate}%
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex h-11 shrink-0 items-center justify-end gap-10 border-t border-slate-200 px-5 dark:border-[#17304a]">
          <span className="text-xs text-slate-500">Line Total</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-white">
            {money(lineTotal)}
          </span>
        </div>

        <div className="flex h-16 shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 dark:border-[#17304a] dark:bg-[#071929]">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="flex h-10 items-center gap-2 rounded-md bg-[#233353] px-5 text-xs font-semibold text-white"
          >
            <LuPlus size={15} />
            Add Product
          </button>
        </div>
      </div>
    </div>
  );
}
