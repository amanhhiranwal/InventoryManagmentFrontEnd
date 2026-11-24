import type { OpeningStatus, StockStatus } from "@/features/stock/api/stock.api";

/** Column heading cell, as on the Stock Out and Inventory lists. */
export const TH = "whitespace-nowrap px-5 py-3 text-[12px] font-normal text-[#777777] dark:text-slate-400";

export const SELECT =
  "h-[39px] shrink-0 rounded-lg border border-[#cccccc] bg-[#f3f3f3] px-3 text-[13px] text-[#141414] outline-none transition focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

const STOCK_STATUS: Record<StockStatus, { label: string; style: string }> = {
  UNRESTRICTED: { label: "Available", style: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
  QUARANTINE: { label: "Quarantine", style: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
  REJECTED: { label: "Rejected", style: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" },
  BLOCKED: { label: "Blocked", style: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
  IN_TRANSIT: { label: "In Transit", style: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400" },
};

export const STOCK_STATUS_OPTIONS = Object.entries(STOCK_STATUS).map(([value, { label }]) => ({ value, label }));

export function StockStatusPill({ status }: { status: StockStatus }) {
  const known = STOCK_STATUS[status] ?? { label: status, style: STOCK_STATUS.BLOCKED.style };
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${known.style}`}>
      {known.label}
    </span>
  );
}

const OPENING_STATUS: Record<OpeningStatus, { label: string; style: string }> = {
  DRAFT: { label: "Draft", style: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
  SUBMITTED: { label: "Awaiting Approval", style: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
  POSTED: { label: "Posted", style: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
  REJECTED: { label: "Rejected", style: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" },
};

export function OpeningStatusPill({ status }: { status: OpeningStatus }) {
  const known = OPENING_STATUS[status];
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${known.style}`}>
      {known.label}
    </span>
  );
}

export const MOVEMENT_LABEL: Record<string, string> = {
  OPENING_BALANCE: "Opening Stock",
  PURCHASE_RECEIPT: "Purchase Receipt",
  SALES_DISPATCH: "Sales Dispatch",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
  CUSTOMER_RETURN: "Customer Return",
  VENDOR_RETURN: "Vendor Return",
  STOCK_ADJUSTMENT_IN: "Adjustment In",
  STOCK_ADJUSTMENT_OUT: "Adjustment Out",
  REVERSAL: "Reversal",
  QC_STATUS_TRANSFER: "Quality Check",
};

/** Quantities are whole units almost always; show decimals only when there are some. */
export const qty = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 });

export const money = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The server's reason, or a fallback - never an empty toast. */
export function errorText(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown; message?: string } } })?.response?.data;
  if (typeof detail?.detail === "string") return detail.detail;
  if (Array.isArray(detail?.detail)) {
    const first = detail.detail[0] as { msg?: string } | undefined;
    if (first?.msg) return first.msg;
  }
  return detail?.message || fallback;
}

const GRN_STATUS: Record<string, { label: string; style: string }> = {
  DRAFT: { label: "Receiving In Progress", style: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" },
  SUBMITTED: { label: "Awaiting Receipt Posting", style: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" },
  QC_PENDING: { label: "QC Pending", style: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
  POSTED: { label: "GRN Generated", style: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400" },
  CANCELLED: { label: "Cancelled", style: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
};

/** The Stock-In statuses, worded as in the design. */
export function GrnStatusPill({ status }: { status: string }) {
  const known = GRN_STATUS[status] ?? { label: status, style: GRN_STATUS.CANCELLED.style };
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${known.style}`}>
      {known.label}
    </span>
  );
}

export const GRN_TYPE_LABEL: Record<string, string> = {
  PURCHASE: "Against Purchase Order",
  RETURN: "Return (customer / dealer)",
  OTHER: "Other (no PO)",
};

const DISPATCH_STATUS: Record<string, { label: string; style: string }> = {
  DRAFT: { label: "Draft", style: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
  PICKED: { label: "Picked", style: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" },
  PACKED: { label: "Ready to Dispatch", style: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
  DISPATCHED: { label: "Dispatched", style: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400" },
  DELIVERED: { label: "Delivered", style: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
  CANCELLED: { label: "Cancelled", style: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" },
};

export function DispatchStatusPill({ status }: { status: string }) {
  const known = DISPATCH_STATUS[status] ?? { label: status, style: DISPATCH_STATUS.DRAFT.style };
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${known.style}`}>
      {known.label}
    </span>
  );
}

const TRANSFER_STATUS: Record<string, { label: string; style: string }> = {
  DRAFT: { label: "Draft", style: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
  SUBMITTED: { label: "Awaiting Approval", style: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
  APPROVED: { label: "Ready to Ship", style: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" },
  SHIPPED: { label: "In Transit", style: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400" },
  RECEIVED: { label: "Received", style: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
  CANCELLED: { label: "Cancelled", style: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" },
};

export function TransferStatusPill({ status }: { status: string }) {
  const known = TRANSFER_STATUS[status] ?? { label: status, style: TRANSFER_STATUS.DRAFT.style };
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${known.style}`}>
      {known.label}
    </span>
  );
}

const COUNT_STATUS: Record<string, { label: string; style: string }> = {
  OPEN: { label: "Counting", style: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" },
  SUBMITTED: { label: "Awaiting Approval", style: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
  POSTED: { label: "Posted", style: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
  CANCELLED: { label: "Cancelled", style: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" },
};

export function CountStatusPill({ status }: { status: string }) {
  const known = COUNT_STATUS[status] ?? { label: status, style: COUNT_STATUS.OPEN.style };
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${known.style}`}>
      {known.label}
    </span>
  );
}

/** Serial numbers typed one per line or separated by commas. */
export const splitSerials = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
