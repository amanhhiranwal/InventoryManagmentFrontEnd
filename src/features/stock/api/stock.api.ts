import api from "@/lib/axios";

/** Every stock screen reports its own errors, so the shared client's
    toast is turned off here; otherwise each failure would show twice. */
const QUIET = { skipErrorToast: true };

/** Only UNRESTRICTED stock can be promised; the rest is held back. */
export type StockStatus = "UNRESTRICTED" | "QUARANTINE" | "REJECTED" | "BLOCKED" | "IN_TRANSIT";

export interface StockBalanceRow {
  id: number;
  company_id: string;
  company_name?: string | null;
  warehouse_id: string;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  bin_id: string;
  bin_code?: string | null;
  sku: string;
  product_name?: string | null;
  stock_status: StockStatus;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  avg_cost?: number | null;
  updated_at?: string | null;
}

export interface StockSummary {
  skus: number;
  on_hand: number;
  reserved: number;
  available: number;
  quarantine: number;
  rejected: number;
  blocked: number;
  in_transit: number;
}

export interface LedgerRow {
  id: number;
  company_id: string;
  company_name?: string | null;
  warehouse_id: string;
  warehouse_name?: string | null;
  bin_code?: string | null;
  sku: string;
  product_name?: string | null;
  serial_no?: string | null;
  movement_type: string;
  stock_status: StockStatus;
  quantity: number;
  unit_cost?: number | null;
  source_doc_type: string;
  source_doc_id: string;
  source_doc_number?: string | null;
  movement_date?: string | null;
  posted_at?: string | null;
  created_by_name?: string | null;
  approved_by_name?: string | null;
  remarks?: string | null;
}

export type OpeningStatus = "DRAFT" | "SUBMITTED" | "POSTED" | "REJECTED";

/** The kinds of stock document, by their API path. */
export type StockDocKind = "opening" | "adjustments" | "vendor-returns";
export type StockDocType = "OPENING" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "VENDOR_RETURN";

export const ADJUSTMENT_REASONS = [
  ["DAMAGE", "Damage"],
  ["LOSS", "Loss"],
  ["THEFT", "Theft"],
  ["FOUND", "Found"],
  ["EXPIRY", "Expiry"],
  ["DATA_CORRECTION", "Data correction"],
  ["COUNT_VARIANCE", "Count variance"],
  ["OTHER", "Other"],
] as const;

export interface OpeningLine {
  id?: number;
  line_no?: number;
  sku: string;
  product_name?: string | null;
  bin_id: string;
  bin_code?: string | null;
  quantity: number;
  unit_cost?: number | null;
  serials: string[];
  stock_status?: string;
  grn_line_id?: number | null;
}

export interface OpeningDocument {
  id: number;
  doc_number: string;
  doc_type: StockDocType;
  reason_code?: string | null;
  grn_id?: number | null;
  company_id: string;
  company_name?: string | null;
  warehouse_id: string;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  status: OpeningStatus;
  movement_date?: string | null;
  reason?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  submitted_at?: string | null;
  approved_by_name?: string | null;
  posted_at?: string | null;
  rejected_by_name?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
  lines: OpeningLine[];
  total_quantity: number;
  total_value: number;
}

export interface OpeningPayloadLine {
  sku?: string;
  bin_id?: string;
  quantity: number;
  unit_cost?: number | null;
  serials: string[];
  grn_line_id?: number;
  stock_status?: "UNRESTRICTED" | "REJECTED" | "BLOCKED";
}

export interface OpeningPayload {
  warehouse_id: string;
  movement_date?: string;
  reason?: string;
  remarks?: string;
  reason_code?: string;
  direction?: "IN" | "OUT";
  grn_id?: number;
  lines: OpeningPayloadLine[];
}

export interface CatalogueProduct {
  sku: string;
  name?: string | null;
  unit?: string | null;
  has_serials: boolean;
}

export interface Paged<T> {
  data: T[];
  total: number;
}

export interface StockFilters {
  company_id?: string;
  warehouse_id?: string;
  search?: string;
  page?: number;
  size?: number;
}

const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));

export const getStockSummaryApi = async (filters: StockFilters = {}): Promise<StockSummary> => {
  const { data } = await api.get("/api/v1/stock/summary", { ...QUIET, params: clean({ ...filters }) });
  return data.data;
};

export const getStockBalancesApi = async (
  filters: StockFilters & { status?: string },
): Promise<Paged<StockBalanceRow>> => {
  const { data } = await api.get("/api/v1/stock/balances", { ...QUIET, params: clean({ ...filters }) });
  return { data: data.data || [], total: data.total || 0 };
};

export const getStockLedgerApi = async (
  filters: StockFilters & { movement_type?: string; date_from?: string; date_to?: string },
): Promise<Paged<LedgerRow>> => {
  const { data } = await api.get("/api/v1/stock/ledger", { ...QUIET, params: clean({ ...filters }) });
  return { data: data.data || [], total: data.total || 0 };
};

export const getStockDocumentsApi = async (
  kind: StockDocKind,
  filters: StockFilters & { status?: string },
): Promise<Paged<OpeningDocument>> => {
  const { data } = await api.get(`/api/v1/stock/${kind}`, { ...QUIET, params: clean({ ...filters }) });
  return { data: data.data || [], total: data.total || 0 };
};

export const getStockDocumentApi = async (kind: StockDocKind, id: number): Promise<OpeningDocument> => {
  const { data } = await api.get(`/api/v1/stock/${kind}/${id}`, QUIET);
  return data.data;
};

export const createStockDocumentApi = async (kind: StockDocKind, payload: OpeningPayload): Promise<OpeningDocument> => {
  const { data } = await api.post(`/api/v1/stock/${kind}`, payload, QUIET);
  return data.data;
};

export const updateStockDocumentApi = async (
  kind: StockDocKind,
  id: number,
  payload: Omit<OpeningPayload, "warehouse_id" | "direction">,
): Promise<OpeningDocument> => {
  const { data } = await api.put(`/api/v1/stock/${kind}/${id}`, payload, QUIET);
  return data.data;
};

export const deleteStockDocumentApi = async (kind: StockDocKind, id: number): Promise<void> => {
  await api.delete(`/api/v1/stock/${kind}/${id}`, QUIET);
};

export const submitStockDocumentApi = async (kind: StockDocKind, id: number): Promise<OpeningDocument> => {
  const { data } = await api.post(`/api/v1/stock/${kind}/${id}/submit`, undefined, QUIET);
  return data.data;
};

export const approveStockDocumentApi = async (kind: StockDocKind, id: number): Promise<OpeningDocument> => {
  const { data } = await api.post(`/api/v1/stock/${kind}/${id}/approve`, undefined, QUIET);
  return data.data;
};

export const rejectStockDocumentApi = async (kind: StockDocKind, id: number, reason: string): Promise<OpeningDocument> => {
  const { data } = await api.post(`/api/v1/stock/${kind}/${id}/reject`, { reason }, QUIET);
  return data.data;
};

/** Which permissions draft and approve each kind; the server checks the same. */
export const DOC_PERMISSIONS: Record<StockDocKind, { create: string; approve: string; noun: string }> = {
  opening: { create: "stock.opening.create", approve: "stock.opening.approve", noun: "Opening Stock" },
  adjustments: { create: "stock.adjust.create", approve: "stock.adjust.approve", noun: "Stock Adjustment" },
  "vendor-returns": { create: "vendor_return.create", approve: "vendor_return.approve", noun: "Vendor Return" },
};

export const kindOf = (docType: StockDocType): StockDocKind =>
  docType === "OPENING" ? "opening" : docType === "VENDOR_RETURN" ? "vendor-returns" : "adjustments";

export const getStockCatalogueApi = async (warehouseId: string, search?: string): Promise<CatalogueProduct[]> => {
  const { data } = await api.get("/api/v1/stock/catalogue", { ...QUIET, params: clean({ warehouse_id: warehouseId, search }) });
  return data.data || [];
};

/** A product's In-Stock, saved on the Inventory page, into its company's store. */
export const putProductInStockApi = async (payload: {
  company_id: string;
  warehouse_id?: string;
  sku: string;
  quantity: number;
  serials: string[];
  request_id: string;
}): Promise<{ company_name: string; store: string; sku: string; quantity: number }> => {
  const { data } = await api.post("/api/v1/stock/product-stock", payload, QUIET);
  return data.data;
};
