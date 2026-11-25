import api from "@/lib/axios";

/** Every stock screen reports its own errors, so the shared client's
    toast is turned off here; otherwise each failure would show twice. */
const QUIET = { skipErrorToast: true };

export type DispatchStatus = "DRAFT" | "PICKED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";

export interface AvailabilityLine {
  so_line_id: number;
  line_index: number;
  sku: string;
  product_name?: string | null;
  qty_ordered: number;
  qty_reserved: number;
  qty_on_dispatch: number;
  qty_dispatched: number;
  qty_delivered: number;
  qty_remaining: number;
  available_here: number;
  available_other_warehouses: number;
  on_order: number;
  shortage: number;
}

export interface Availability {
  sales_order_id: number;
  order_number?: string | null;
  customer_name?: string | null;
  status: string;
  warehouse_id: string;
  warehouse_name?: string | null;
  company_id: string;
  /** Set once stock has been reserved: the order ships from here. */
  fixed_warehouse_id?: string | null;
  lines: AvailabilityLine[];
}

export interface DispatchLine {
  id: number;
  so_line_id: number;
  sku: string;
  product_name?: string | null;
  qty: number;
  qty_picked: number;
  serials: string[];
}

export interface DispatchOrder {
  id: number;
  do_number: string;
  company_id: string;
  company_name?: string | null;
  warehouse_id: string;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  sales_order_id: number;
  order_number?: string | null;
  customer_name?: string | null;
  order_status?: string | null;
  status: DispatchStatus;
  dispatch_date?: string | null;
  ship_to?: string | null;
  transporter?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  docket_no?: string | null;
  challan_no?: string | null;
  challan_date?: string | null;
  invoice_no?: string | null;
  eway_bill_no?: string | null;
  eway_bill_date?: string | null;
  eway_valid_until?: string | null;
  gate_pass_no?: string | null;
  packages?: number | null;
  gross_weight?: string | null;
  consignment_value?: number | null;
  eway_bill_threshold: number;
  remarks?: string | null;
  created_by_name?: string | null;
  committed_by_name?: string | null;
  committed_at?: string | null;
  delivered_at?: string | null;
  pod_receiver?: string | null;
  pod_remarks?: string | null;
  pod_recorded_by_name?: string | null;
  cancelled_reason?: string | null;
  created_at?: string | null;
  lines: DispatchLine[];
  total_qty: number;
}

export interface DispatchDocuments {
  transporter?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  docket_no?: string | null;
  challan_no?: string | null;
  challan_date?: string | null;
  invoice_no?: string | null;
  eway_bill_no?: string | null;
  eway_bill_date?: string | null;
  eway_valid_until?: string | null;
  gate_pass_no?: string | null;
  consignment_value?: number | null;
  ship_to?: string | null;
  remarks?: string | null;
}

export interface DispatchPage {
  data: DispatchOrder[];
  total: number;
  counts: Partial<Record<DispatchStatus, number>>;
}

const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null));

export const getAvailabilityApi = async (orderId: number, warehouseId?: string): Promise<Availability> => {
  const { data } = await api.get(`/api/v1/dispatch/orders/${orderId}/availability`, {
    ...QUIET,
    params: clean({ warehouse_id: warehouseId }),
  });
  return data.data;
};

export const reserveStockApi = async (
  orderId: number,
  warehouseId: string,
  lines: { so_line_id: number; qty: number }[],
): Promise<Availability> => {
  const { data } = await api.post(`/api/v1/dispatch/orders/${orderId}/reserve`, { warehouse_id: warehouseId, lines }, QUIET);
  return data.data;
};

export const releaseStockApi = async (orderId: number, reason: string, soLineId?: number): Promise<Availability> => {
  const { data } = await api.post(`/api/v1/dispatch/orders/${orderId}/release`, clean({ reason, so_line_id: soLineId }), QUIET);
  return data.data;
};

/** Whether the stock ledger is live. Until it is, orders go out from the
 *  Logistics desk and dispatch orders are not used. */
export const getLedgerLiveApi = async (): Promise<boolean> => {
  const { data } = await api.get("/api/v1/stock/ledger-status", QUIET);
  return Boolean(data.data?.live);
};

export const getDispatchesApi = async (params: {
  warehouse_id?: string;
  status?: string;
  search?: string;
  sales_order_id?: number;
  page?: number;
  size?: number;
}): Promise<DispatchPage> => {
  const { data } = await api.get("/api/v1/dispatch/", { ...QUIET, params: clean(params) });
  return { data: data.data || [], total: data.total || 0, counts: data.counts || {} };
};

export const getDispatchApi = async (id: number): Promise<DispatchOrder> => {
  const { data } = await api.get(`/api/v1/dispatch/${id}`, QUIET);
  return data.data;
};

export const createDispatchApi = async (payload: {
  sales_order_id: number;
  dispatch_date?: string;
  ship_to?: string;
  remarks?: string;
  lines: { so_line_id: number; qty: number }[];
}): Promise<DispatchOrder> => {
  const { data } = await api.post("/api/v1/dispatch/", payload, QUIET);
  return data.data;
};

export const pickDispatchApi = async (id: number, lines: { line_id: number; serials: string[] }[]): Promise<DispatchOrder> => {
  const { data } = await api.post(`/api/v1/dispatch/${id}/pick`, { lines }, QUIET);
  return data.data;
};

export const packDispatchApi = async (id: number, packages: number, grossWeight?: string): Promise<DispatchOrder> => {
  const { data } = await api.post(`/api/v1/dispatch/${id}/pack`, clean({ packages, gross_weight: grossWeight }), QUIET);
  return data.data;
};

export const saveDispatchDocumentsApi = async (id: number, payload: DispatchDocuments): Promise<DispatchOrder> => {
  const { data } = await api.put(`/api/v1/dispatch/${id}/documents`, payload, QUIET);
  return data.data;
};

export const commitDispatchApi = async (id: number): Promise<DispatchOrder> => {
  const { data } = await api.post(`/api/v1/dispatch/${id}/commit`, undefined, QUIET);
  return data.data;
};

export const recordPodApi = async (id: number, receiver: string, remarks?: string): Promise<DispatchOrder> => {
  const { data } = await api.post(`/api/v1/dispatch/${id}/pod`, clean({ receiver, remarks }), QUIET);
  return data.data;
};

export const cancelDispatchApi = async (id: number, reason: string): Promise<DispatchOrder> => {
  const { data } = await api.post(`/api/v1/dispatch/${id}/cancel`, { reason }, QUIET);
  return data.data;
};
