import api from "@/lib/axios";

/* =========================================================
   CANONICAL STATUSES

   Persisted values. Display labels live in SALES_ORDER_STATUS_LABEL.
========================================================= */

export const SALES_ORDER_STATUS = {
  DRAFT: "DRAFT",
  CONFIRMED: "CONFIRMED",
  ON_HOLD: "ON_HOLD",
  RELEASED: "RELEASED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type SalesOrderStatus =
  (typeof SALES_ORDER_STATUS)[keyof typeof SALES_ORDER_STATUS];

export const SALES_ORDER_STATUSES: SalesOrderStatus[] = [
  SALES_ORDER_STATUS.DRAFT,
  SALES_ORDER_STATUS.CONFIRMED,
  SALES_ORDER_STATUS.ON_HOLD,
  SALES_ORDER_STATUS.RELEASED,
  SALES_ORDER_STATUS.COMPLETED,
  SALES_ORDER_STATUS.CANCELLED,
];

export const SALES_ORDER_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  ON_HOLD: "On Hold",
  RELEASED: "Released",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Mirrors SALES_ORDER_TRANSITIONS on the backend. */
export const SALES_ORDER_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> =
  {
    DRAFT: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["RELEASED", "ON_HOLD", "CANCELLED"],
    RELEASED: ["COMPLETED", "ON_HOLD", "CANCELLED"],
    ON_HOLD: ["CONFIRMED", "RELEASED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

export function canTransitionSalesOrder(
  from: SalesOrderStatus,
  to: SalesOrderStatus,
): boolean {
  if (from === to) return true;
  return (SALES_ORDER_TRANSITIONS[from] || []).includes(to);
}

export function salesOrderStatusLabel(status?: string | null): string {
  if (!status) return "Draft";
  return SALES_ORDER_STATUS_LABEL[status as SalesOrderStatus] || status;
}

/** Statuses a given order may move to next, for action menus. */
export function nextSalesOrderStatuses(
  status?: string | null,
): SalesOrderStatus[] {
  const current = (status || SALES_ORDER_STATUS.DRAFT) as SalesOrderStatus;
  return SALES_ORDER_TRANSITIONS[current] || [];
}

/* =========================================================
   TYPES
========================================================= */

export interface SalesOrderItem {
  product_id?: string;
  item?: string;
  description?: string;
  rate?: number;
  price?: number;
  qty?: number;
  quantity_case?: number;
  quantity_kg_ltr?: number;
  discount?: number;
  tax_rate?: number;
  tax_amount?: number;
  line_total?: number;
}

export interface SalesOrderModel {
  id: number;
  /** Kept for compatibility with the existing table, which keys rows by _id. */
  _id: string;

  order_number?: string | null;
  sales_order_id?: string | null;
  opportunity_id?: number | null;

  status: SalesOrderStatus;

  customer_name: string;
  company_name?: string | null;
  customer_type?: string | null;
  state?: string | null;
  order_date?: string | null;

  assigned_to?: string | null;
  sales_executive?: string | null;

  customer_information?: Record<string, unknown> | null;
  billing_address?: Record<string, unknown> | null;
  shipping_address?: Record<string, unknown> | null;

  items: SalesOrderItem[];

  total_amount?: number | null;
  discount_amount?: number | null;
  gst_amount?: number | null;
  grand_total?: number | null;

  taxable_amount?: number | null;
  orc_amount?: number | null;
  orc_percent?: number | null;
  orc_mode?: "AMOUNT" | "PERCENT" | null;
  orc_input?: number | null;
  discount_mode?: "AMOUNT" | "PERCENT" | null;
  discount_input?: number | null;
  freight_charges?: number | null;
  installation_lumpsum?: number | null;
  gst_percent?: number | null;
  advance_received?: number | null;
  outstanding_balance?: number | null;

  aging_0_30?: number | null;
  aging_31_60?: number | null;
  aging_61_90?: number | null;
  aging_91_120?: number | null;
  aging_121_180?: number | null;
  aging_above_180?: number | null;

  remarks?: string | null;

  creator_id?: string | null;
  creator_name?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateSalesOrderPayload {
  customer_name: string;

  order_number?: string;
  opportunity_id?: number | null;
  status?: SalesOrderStatus;

  company_name?: string;
  customer_type?: string;
  state?: string;
  order_date?: string;

  assigned_to?: string;
  sales_executive?: string;

  customer_information?: Record<string, unknown>;
  billing_address?: Record<string, unknown>;
  shipping_address?: Record<string, unknown>;

  items?: SalesOrderItem[];

  /** Totals are recomputed server-side from the lines and charges below. */
  total_amount?: number;
  discount_amount?: number;
  gst_amount?: number;
  grand_total?: number;

  /** "AMOUNT" or "PERCENT" - the unit the figure below was typed in. */
  discount_mode?: "AMOUNT" | "PERCENT";
  orc_mode?: "AMOUNT" | "PERCENT";
  /** Raw values as entered. A discount here overrides the per-line total. */
  discount_input?: number | null;
  orc_input?: number;

  freight_charges?: number;
  installation_lumpsum?: number;
  gst_percent?: number;
  advance_received?: number;

  aging_0_30?: number;
  aging_31_60?: number;
  aging_61_90?: number;
  aging_91_120?: number;
  aging_121_180?: number;
  aging_above_180?: number;

  remarks?: string;
}

export type UpdateSalesOrderPayload = Partial<
  Omit<CreateSalesOrderPayload, "status">
>;

/* =========================================================
   API
========================================================= */

export const getSalesOrdersApi = async (): Promise<SalesOrderModel[]> => {
  const { data } = await api.get("/api/v1/orders");
  return Array.isArray(data?.data) ? data.data : [];
};

export const getSalesOrderApi = async (
  id: number | string,
): Promise<SalesOrderModel> => {
  const { data } = await api.get(`/api/v1/orders/${id}`);
  return data.data;
};

export const createSalesOrderApi = async (
  payload: CreateSalesOrderPayload,
): Promise<SalesOrderModel> => {
  const { data } = await api.post("/api/v1/orders", payload);
  return data.data;
};

export const updateSalesOrderApi = async (
  id: number | string,
  payload: UpdateSalesOrderPayload,
): Promise<SalesOrderModel> => {
  const { data } = await api.put(`/api/v1/orders/${id}`, payload);
  return data.data;
};

export const updateSalesOrderStatusApi = async (
  id: number | string,
  status: SalesOrderStatus,
): Promise<SalesOrderModel> => {
  const { data } = await api.put(`/api/v1/orders/${id}/status`, { status });
  return data.data;
};

export const deleteSalesOrderApi = async (
  id: number | string,
): Promise<void> => {
  await api.delete(`/api/v1/orders/${id}`);
};
