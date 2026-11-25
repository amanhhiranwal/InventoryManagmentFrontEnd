import api from "@/lib/axios";

/** Every stock screen reports its own errors, so the shared client's
    toast is turned off here; otherwise each failure would show twice. */
const QUIET = { skipErrorToast: true };

/* ------------------------------------------------------------------ */
/* Transfers between two warehouses of one company                     */
/* ------------------------------------------------------------------ */
export type TransferStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "SHIPPED" | "RECEIVED" | "CANCELLED";

export interface TransferLine {
  id: number;
  line_no: number;
  sku: string;
  product_name?: string | null;
  from_bin_id: string;
  from_bin_code?: string | null;
  to_bin_id?: string | null;
  to_bin_code?: string | null;
  qty: number;
  qty_received?: number | null;
  qty_damaged?: number | null;
  qty_short?: number | null;
  unit_cost?: number | null;
  serials: string[];
  serials_received: string[];
  serials_damaged: string[];
  remarks?: string | null;
}

export interface Transfer {
  id: number;
  transfer_number: string;
  company_id: string;
  company_name?: string | null;
  from_warehouse_id: string;
  from_warehouse_name?: string | null;
  from_warehouse_code?: string | null;
  to_warehouse_id: string;
  to_warehouse_name?: string | null;
  to_warehouse_code?: string | null;
  status: TransferStatus;
  transfer_date?: string | null;
  reason?: string | null;
  remarks?: string | null;
  vehicle_number?: string | null;
  docket_no?: string | null;
  challan_no?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  submitted_at?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  shipped_by_name?: string | null;
  shipped_at?: string | null;
  received_by_name?: string | null;
  received_at?: string | null;
  receipt_remarks?: string | null;
  cancelled_reason?: string | null;
  created_at?: string | null;
  lines: TransferLine[];
  total_quantity: number;
}

export interface TransferPayloadLine {
  sku: string;
  bin_id?: string;
  quantity: number;
  serials: string[];
  remarks?: string;
}

export interface TransferPayload {
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_date?: string;
  reason?: string;
  remarks?: string;
  lines: TransferPayloadLine[];
}

export interface ReceiveLine {
  line_id: number;
  qty_received: number;
  qty_damaged?: number;
  bin_id?: string;
  serials_received: string[];
  serials_damaged: string[];
  remarks?: string;
}

export interface Destination {
  id: string;
  location_name: string;
  location_code: string;
}

export interface Page<T, S extends string> {
  data: T[];
  total: number;
  counts: Partial<Record<S, number>>;
}

export interface ListFilters {
  company_id?: string;
  warehouse_id?: string;
  status?: string;
  search?: string;
  page?: number;
  size?: number;
}

const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));

export const getTransfersApi = async (filters: ListFilters): Promise<Page<Transfer, TransferStatus>> => {
  const { data } = await api.get("/api/v1/stock/transfers", { ...QUIET, params: clean({ ...filters }) });
  return { data: data.data || [], total: data.total || 0, counts: data.counts || {} };
};

export const getTransferApi = async (id: number): Promise<Transfer> => {
  const { data } = await api.get(`/api/v1/stock/transfers/${id}`, QUIET);
  return data.data;
};

export const getTransferDestinationsApi = async (fromWarehouseId: string): Promise<Destination[]> => {
  const { data } = await api.get("/api/v1/stock/transfers/destinations", { ...QUIET, params: { from_warehouse_id: fromWarehouseId } });
  return data.data || [];
};

export const createTransferApi = async (payload: TransferPayload): Promise<Transfer> => {
  const { data } = await api.post("/api/v1/stock/transfers", payload, QUIET);
  return data.data;
};

export const updateTransferApi = async (id: number, payload: Omit<TransferPayload, "from_warehouse_id">): Promise<Transfer> => {
  const { data } = await api.put(`/api/v1/stock/transfers/${id}`, payload, QUIET);
  return data.data;
};

export const deleteTransferApi = async (id: number): Promise<void> => {
  await api.delete(`/api/v1/stock/transfers/${id}`, QUIET);
};

export const submitTransferApi = async (id: number): Promise<Transfer> => {
  const { data } = await api.post(`/api/v1/stock/transfers/${id}/submit`, undefined, QUIET);
  return data.data;
};

export const approveTransferApi = async (id: number): Promise<Transfer> => {
  const { data } = await api.post(`/api/v1/stock/transfers/${id}/approve`, undefined, QUIET);
  return data.data;
};

export const cancelTransferApi = async (id: number, reason: string): Promise<Transfer> => {
  const { data } = await api.post(`/api/v1/stock/transfers/${id}/cancel`, { reason }, QUIET);
  return data.data;
};

export const shipTransferApi = async (
  id: number,
  body: { vehicle_number?: string; docket_no?: string; challan_no?: string },
): Promise<Transfer> => {
  const { data } = await api.post(`/api/v1/stock/transfers/${id}/ship`, body, QUIET);
  return data.data;
};

export const receiveTransferApi = async (id: number, body: { lines: ReceiveLine[]; remarks?: string }): Promise<Transfer> => {
  const { data } = await api.post(`/api/v1/stock/transfers/${id}/receive`, body, QUIET);
  return data.data;
};

/* ------------------------------------------------------------------ */
/* Cycle counts                                                        */
/* ------------------------------------------------------------------ */
export type CountStatus = "OPEN" | "SUBMITTED" | "POSTED" | "CANCELLED";

export interface CountLine {
  id: number;
  line_no: number;
  bin_id: string;
  bin_code?: string | null;
  sku: string;
  product_name?: string | null;
  qty_system: number;
  qty_counted?: number | null;
  variance?: number | null;
  unit_cost?: number | null;
  variance_value?: number | null;
  remarks?: string | null;
}

export interface StockCount {
  id: number;
  count_number: string;
  company_id: string;
  company_name?: string | null;
  warehouse_id: string;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  bin_id?: string | null;
  bin_code?: string | null;
  status: CountStatus;
  count_date?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  submitted_at?: string | null;
  approved_by_name?: string | null;
  posted_at?: string | null;
  cancelled_reason?: string | null;
  created_at?: string | null;
  lines: CountLine[];
  lines_counted: number;
  lines_with_variance: number;
  variance_value: number;
}

export interface CountRecordBody {
  lines: { line_id: number; qty_counted: number; remarks?: string }[];
  found: { sku: string; bin_id?: string; qty_counted: number; remarks?: string }[];
}

export const getCountsApi = async (filters: ListFilters): Promise<Page<StockCount, CountStatus>> => {
  const { data } = await api.get("/api/v1/stock/counts", { ...QUIET, params: clean({ ...filters }) });
  return { data: data.data || [], total: data.total || 0, counts: data.counts || {} };
};

export const getCountApi = async (id: number): Promise<StockCount> => {
  const { data } = await api.get(`/api/v1/stock/counts/${id}`, QUIET);
  return data.data;
};

export const createCountApi = async (body: { warehouse_id: string; bin_id?: string; count_date?: string; remarks?: string }): Promise<StockCount> => {
  const { data } = await api.post("/api/v1/stock/counts", body, QUIET);
  return data.data;
};

export const recordCountApi = async (id: number, body: CountRecordBody): Promise<StockCount> => {
  const { data } = await api.put(`/api/v1/stock/counts/${id}`, body, QUIET);
  return data.data;
};

export const submitCountApi = async (id: number): Promise<StockCount> => {
  const { data } = await api.post(`/api/v1/stock/counts/${id}/submit`, undefined, QUIET);
  return data.data;
};

export const approveCountApi = async (id: number): Promise<StockCount> => {
  const { data } = await api.post(`/api/v1/stock/counts/${id}/approve`, undefined, QUIET);
  return data.data;
};

export const cancelCountApi = async (id: number, reason: string): Promise<StockCount> => {
  const { data } = await api.post(`/api/v1/stock/counts/${id}/cancel`, { reason }, QUIET);
  return data.data;
};
