import api from "@/lib/axios";

/** Every stock screen reports its own errors, so the shared client's
    toast is turned off here; otherwise each failure would show twice. */
const QUIET = { skipErrorToast: true };

export type GrnStatus = "DRAFT" | "SUBMITTED" | "QC_PENDING" | "POSTED" | "CANCELLED";
export type GrnType = "PURCHASE" | "RETURN" | "OTHER";

export interface GrnLine {
  id: number;
  line_no: number;
  po_item_id?: number | null;
  /** A customer return: the dispatch line the goods went out on. */
  dispatch_line_id?: number | null;
  sku: string;
  description?: string | null;
  uom?: string | null;
  qty_ordered?: number | null;
  qty_received: number;
  qty_accepted?: number | null;
  qty_rejected?: number | null;
  qty_damaged?: number | null;
  bin_id?: string | null;
  bin_code?: string | null;
  unit_cost?: number | null;
  serials: string[];
  remarks?: string | null;
}

export interface Grn {
  id: number;
  grn_number: string;
  company_id: string;
  company_name?: string | null;
  warehouse_id: string;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  receipt_type: GrnType;
  purchase_order_id?: number | null;
  po_number?: string | null;
  po_date?: string | null;
  dispatch_order_id?: number | null;
  do_number?: string | null;
  supplier_name: string;
  supplier_address?: string | null;
  delivery_note_no?: string | null;
  delivery_note_date?: string | null;
  receipt_date: string;
  transport_remarks?: string | null;
  remarks?: string | null;
  status: GrnStatus;
  received_by?: string | null;
  received_by_name?: string | null;
  submitted_at?: string | null;
  receipt_posted_by_name?: string | null;
  receipt_posted_at?: string | null;
  inspected_by_name?: string | null;
  posted_at?: string | null;
  cancelled_reason?: string | null;
  created_at?: string | null;
  lines: GrnLine[];
  totals: { ordered: number; received: number; accepted: number; rejected: number; damaged: number };
}

export interface Letterhead {
  company_name: string;
  address: string;
  gst_number?: string | null;
  phone_number?: string | null;
  email?: string | null;
}

export interface ReceivableItem {
  po_item_id: number;
  sku?: string | null;
  product_name?: string | null;
  description?: string | null;
  uom?: string | null;
  qty_ordered: number;
  qty_received: number;
  qty_open: number;
  unit_rate: number;
}

export interface ReceivableOrder {
  id: number;
  po_number: string;
  po_date?: string | null;
  status: string;
  vendor_name?: string | null;
  vendor_address?: string | null;
  created_by_name?: string | null;
  items: ReceivableItem[];
}

export interface ReturnableDispatchLine {
  id: number;
  sku: string;
  product_name?: string | null;
  qty_dispatched: number;
  qty_returnable: number;
  serials: string[];
}

/** A dispatch of this company that goods can come back on. */
export interface ReturnableDispatch {
  id: number;
  do_number: string;
  status: string;
  order_number?: string | null;
  customer_name?: string | null;
  dispatch_date?: string | null;
  lines: ReturnableDispatchLine[];
}

export interface GrnSaveLine {
  po_item_id?: number | null;
  dispatch_line_id?: number | null;
  sku: string;
  description?: string | null;
  uom?: string | null;
  qty_ordered?: number | null;
  qty_received: number;
  unit_cost?: number | null;
  remarks?: string | null;
}

export interface GrnSave {
  warehouse_id: string;
  receipt_type: GrnType;
  purchase_order_id?: number | null;
  dispatch_order_id?: number | null;
  supplier_name?: string | null;
  supplier_address?: string | null;
  delivery_note_no?: string | null;
  delivery_note_date?: string | null;
  receipt_date?: string | null;
  transport_remarks?: string | null;
  remarks?: string | null;
  lines: GrnSaveLine[];
}

export interface GrnDecision {
  line_id: number;
  qty_accepted: number;
  qty_rejected: number;
  qty_damaged: number;
  bin_id?: string | null;
  serials: string[];
  remarks?: string | null;
}

export interface GrnPage {
  data: Grn[];
  total: number;
  counts: Partial<Record<GrnStatus, number>>;
}

const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));

export const getGrnsApi = async (params: {
  warehouse_id?: string;
  status?: string;
  search?: string;
  page?: number;
  size?: number;
}): Promise<GrnPage> => {
  const { data } = await api.get("/api/v1/grn/", { ...QUIET, params: clean(params) });
  return { data: data.data || [], total: data.total || 0, counts: data.counts || {} };
};

export const getGrnApi = async (id: number): Promise<{ grn: Grn; letterhead: Letterhead }> => {
  const { data } = await api.get(`/api/v1/grn/${id}`, QUIET);
  return { grn: data.data, letterhead: data.letterhead };
};

export const getReceivableOrdersApi = async (warehouseId: string, search?: string): Promise<ReceivableOrder[]> => {
  const { data } = await api.get("/api/v1/grn/purchase-orders", { ...QUIET, params: clean({ warehouse_id: warehouseId, search }) });
  return data.data || [];
};

export const getReturnableDispatchesApi = async (warehouseId: string, search?: string): Promise<ReturnableDispatch[]> => {
  const { data } = await api.get("/api/v1/grn/dispatches", { ...QUIET, params: clean({ warehouse_id: warehouseId, search }) });
  return data.data || [];
};

export const createGrnApi = async (payload: GrnSave): Promise<Grn> => {
  const { data } = await api.post("/api/v1/grn/", payload, QUIET);
  return data.data;
};

export const updateGrnApi = async (id: number, payload: GrnSave): Promise<Grn> => {
  const { data } = await api.put(`/api/v1/grn/${id}`, payload, QUIET);
  return data.data;
};

export const submitGrnApi = async (id: number): Promise<Grn> => {
  const { data } = await api.post(`/api/v1/grn/${id}/submit`, undefined, QUIET);
  return data.data;
};

export const postGrnReceiptApi = async (id: number): Promise<Grn> => {
  const { data } = await api.post(`/api/v1/grn/${id}/receive`, undefined, QUIET);
  return data.data;
};

export const cancelGrnApi = async (id: number, reason: string): Promise<Grn> => {
  const { data } = await api.post(`/api/v1/grn/${id}/cancel`, { reason }, QUIET);
  return data.data;
};

export const inspectGrnApi = async (id: number, lines: GrnDecision[]): Promise<Grn> => {
  const { data } = await api.post(`/api/v1/grn/${id}/inspect`, { lines }, QUIET);
  return data.data;
};
