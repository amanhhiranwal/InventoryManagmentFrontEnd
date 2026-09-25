import api from "@/lib/axios";

/* =========================================================
   FULFILMENT

   Where an order goes once the discount chain has cleared it. Accounts
   confirm the money arrived, and inventory confirm the stock is there and
   send it out.

   A desk only ever sees the orders waiting on it, and only the desk
   holding an order can move it on - the backend enforces both. Where an
   order has got to is shown on the sales order itself, so there is no
   separate tracking board here.
========================================================= */

export type DeskRole = "Accounts" | "Inventory";

/** One number across the top of a desk. The backend decides which ones
    matter, so a new KPI does not need a frontend release. */
export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: "count" | "currency" | "days";
  /** Colours the card when the number is one somebody should act on. */
  tone?: "warn" | "good";
  hint?: string;
}

/** Stock this order has already taken off the shelf, or put back. */
export interface StockMovement {
  product?: string | null;
  serial_number?: string | null;
  direction: "OUT" | "IN";
  quantity: number;
  stock_before: number;
  stock_after: number;
  actor?: string | null;
  created_at?: string | null;
}

/** One line of an order against what the shelf can cover. */
export interface StockLine {
  product: string;
  sku?: string | null;
  wanted: number;
  /** null when nothing in the catalogue matches the line at all. */
  available: number | null;
  short: boolean;
  known: boolean;
}

export interface DeskOrder {
  id: number;
  order_number?: string | null;
  customer_name: string;
  company_name?: string | null;
  state?: string | null;

  status: string;
  status_label: string;
  /** What this desk is being asked to confirm. */
  asks?: string | null;
  /** Where approving sends it. */
  approves_to?: string | null;

  grand_total: number;
  advance_percent: number;
  advance_expected: number;
  advance_received: number;
  outstanding_balance: number;
  /** Whether the advance on the invoice covers what was asked for. */
  advance_settled: boolean;

  order_date?: string | null;
  /** How long it has sat at this desk. */
  waiting_days: number;

  items: Record<string, unknown>[];

  proforma_invoice?: {
    id: number;
    pi_number?: string | null;
    status: string;
    grand_total: number;
    amount_paid: number;
    balance_due: number;
  } | null;

  /** Procurement desk only. */
  stock?: StockLine[];
  stock_short?: boolean;
  /** What this order has already moved. Empty until it is dispatched. */
  stock_movements?: StockMovement[];
}

export interface DeskQueue {
  role: DeskRole;
  stages: {
    status: string;
    label: string;
    asks: string;
    approves_to: string;
    count: number;
  }[];
  orders: DeskOrder[];
  kpis: Kpi[];
}

export const getAccountsDeskApi = async (): Promise<DeskQueue> => {
  const { data } = await api.get("/api/v1/fulfilment/accounts");
  return data.data;
};

export const getProcurementDeskApi = async (): Promise<DeskQueue> => {
  const { data } = await api.get("/api/v1/fulfilment/procurement");
  return data.data;
};

/** The desk's call: send it on, or hold it with a reason. */
export const decideOrderApi = async (
  orderId: number,
  approve: boolean,
  remarks?: string,
): Promise<void> => {
  await api.put(`/api/v1/fulfilment/orders/${orderId}/decide`, {
    approve,
    remarks,
  });
};

/** Indian grouping, as the rest of the CRM uses. */
export const money = (value?: number | null): string =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

export function formatKpi(kpi: Kpi): string {
  if (kpi.format === "currency") return money(kpi.value);
  if (kpi.format === "days") {
    return kpi.value === 1 ? "1 day" : `${kpi.value} days`;
  }
  return Number(kpi.value).toLocaleString("en-IN");
}

/** A status as a person would say it: PAYMENT_VERIFIED -> Payment Verified. */
export function stageLabel(status: string): string {
  return String(status || "")
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}
