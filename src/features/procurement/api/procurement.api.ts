/* Procurement: requisitions, approvals, the procurement desk, vendors,
 * quotations, purchase orders, their approval and payment.
 *
 * Every rule - who may approve, what may be edited, the arithmetic - is
 * the server's. These calls carry what the screens send and read back
 * what the server decided. */

import api from "@/lib/axios";
import type { StoredAttachment } from "@/features/attachments/attachments.api";

export interface Option {
  value: string;
  label: string;
}

export interface ActivityRow {
  id: number;
  entity_type: string;
  action: string;
  previous_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  remarks?: string | null;
  actor_name?: string | null;
  created_at?: string | null;
}

// ------------------------------------------------------------------
// Masters
// ------------------------------------------------------------------
export interface Department {
  id: number;
  name: string;
  code?: string | null;
  head_user_id?: string | null;
  head_name?: string | null;
  is_active: boolean;
  members?: number;
}

/** A company of the group: a requisition's cost centre. */
export interface CompanyOption {
  id: string;
  name: string;
}

export interface ApprovalMatrix {
  bands: { upto: number | null; steps: string[]; labels: string[] }[];
  limits: number[];
}

export const getDepartmentsApi = async (active = false): Promise<Department[]> =>
  (await api.get("/api/v1/departments", { params: { active } })).data.data;
export const saveDepartmentApi = async (payload: Partial<Department>, id?: number) =>
  id
    ? (await api.put(`/api/v1/departments/${id}`, payload)).data
    : (await api.post("/api/v1/departments", payload)).data;
export const deleteDepartmentApi = async (id: number) =>
  (await api.delete(`/api/v1/departments/${id}`)).data;

export const getApprovalMatrixApi = async (): Promise<ApprovalMatrix> =>
  (await api.get("/api/v1/procurement/approval-matrix")).data.data;
export const saveApprovalMatrixApi = async (limits: number[]): Promise<ApprovalMatrix> =>
  (await api.put("/api/v1/procurement/approval-matrix", { limits })).data.data;

// ------------------------------------------------------------------
// Requisitions
// ------------------------------------------------------------------
export interface RequisitionItem {
  id?: number;
  line_no?: number;
  product_name: string;
  sku?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  specification?: string | null;
  uom: string;
  quantity: number | string;
  approved_quantity?: number | null;
  effective_quantity?: number;
  quantity_change_reason?: string | null;
  est_unit_price?: number | string | null;
  tax_percent?: number | string | null;
  est_total?: number;
  required_date?: string | null;
  preferred_vendor_id?: number | null;
  /** Vendors procurement asked to quote for this line. */
  rfq_vendor_ids?: number[];
  rfq_vendors?: { id: number; name: string }[];
  remarks?: string | null;
  attachments?: StoredAttachment[];
}

export interface ApprovalStepRow {
  id: number;
  round: number;
  level: number;
  step: string;
  step_label: string;
  approver_label: string;
  decision: string;
  decided_by_name?: string | null;
  decided_at?: string | null;
  remarks?: string | null;
}

export interface Requisition {
  id: number;
  pr_number: string;
  pr_date: string;
  requested_by: string;
  requester_name: string;
  employee_id?: string | null;
  designation?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  /** Requisitions raised before the company became the cost centre. */
  cost_center_code?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  reporting_manager_name?: string | null;
  purchase_type: string;
  purchase_type_label: string;
  priority: string;
  required_by?: string | null;
  currency: string;
  sales_order_id?: number | null;
  sales_order_number?: string | null;
  customer_name?: string | null;
  project_code?: string | null;
  linked_record?: string | null;
  delivery_location?: string | null;
  purpose?: string | null;
  remarks?: string | null;
  budget_code?: string | null;
  budget_available?: number | null;
  budgeted?: boolean | null;
  preferred_vendor_id?: number | null;
  preferred_vendor_name?: string | null;
  preferred_vendor_reason?: string | null;
  alternatives_considered?: string | null;
  special_requirements?: string | null;
  attachments: StoredAttachment[];
  estimated_total: number;
  status: string;
  approval_round: number;
  submitted_at?: string | null;
  approved_at?: string | null;
  resubmitted: boolean;
  procurement_status?: string | null;
  procurement_since?: string | null;
  assigned_to?: string | null;
  assigned_name?: string | null;
  item_count: number;
  pending_days: number;
  pending_since_days?: number;
  overdue?: boolean;
  waiting_on?: ApprovalStepRow | null;
  can_edit?: boolean;
  can_cancel?: boolean;
  can_decide?: boolean;
  items?: RequisitionItem[];
  approvals?: ApprovalStepRow[];
  procurement_remarks?: string | null;
  internal_notes?: { text: string; by: string; at: string }[];
  activity?: ActivityRow[];
  created_at?: string | null;
  /** On the approver's history: their own latest decision on this PR. */
  my_decision?: string | null;
  my_step_label?: string | null;
  my_decided_at?: string | null;
  my_remarks?: string | null;
}

export interface RequisitionMeta {
  purchase_types: Option[];
  priorities: string[];
  departments: Department[];
  /** The companies this person may charge a purchase to. */
  companies: CompanyOption[];
  matrix: ApprovalMatrix;
  me: {
    id: string | null;
    name: string;
    employee_id?: string | null;
    designation?: string | null;
    department_id?: number | null;
    department_name?: string | null;
    reporting_manager_id?: string | null;
    reporting_manager_name?: string | null;
  };
}

export type RequisitionPayload = Record<string, unknown> & { submit?: boolean };

export const getRequisitionMetaApi = async (): Promise<RequisitionMeta> =>
  (await api.get("/api/v1/purchase-requisitions/meta")).data.data;
export const getMyRequisitionsApi = async (params: Record<string, unknown>) =>
  (await api.get("/api/v1/purchase-requisitions/mine", { params })).data as {
    data: Requisition[];
    total: number;
    counts: Record<string, number>;
    /** The page's KPIs: what this person raised and where it stands. */
    summary: {
      raised: number;
      awaiting_approval: number;
      returned: number;
      with_procurement: number;
      ordered: number;
    };
  };
/** What waits on this person: PRs (confirming a need) and POs (the amount
 *  approval), and the PRs they have decided. */
export const getApprovalQueueApi = async (): Promise<{
  pending: Requisition[];
  decided: Requisition[];
  purchase_orders: PurchaseOrder[];
}> =>
  (await api.get("/api/v1/purchase-requisitions/approvals")).data.data;
export const getRequisitionApi = async (id: number | string): Promise<Requisition> =>
  (await api.get(`/api/v1/purchase-requisitions/${id}`)).data.data;
export const createRequisitionApi = async (payload: RequisitionPayload) =>
  (await api.post("/api/v1/purchase-requisitions", payload)).data as { data: Requisition; message: string };
export const updateRequisitionApi = async (id: number, payload: RequisitionPayload) =>
  (await api.put(`/api/v1/purchase-requisitions/${id}`, payload)).data as { data: Requisition; message: string };
/** ``budget`` is the manager recording, when approving, what it is charged to. */
export const decideRequisitionApi = async (
  id: number,
  decision: string,
  remarks?: string,
  budget?: { budget_code?: string | null; budget_available?: number | null; budgeted?: boolean | null },
) =>
  (await api.post(`/api/v1/purchase-requisitions/${id}/decision`, { decision, remarks, ...(budget || {}) })).data as {
    data: Requisition;
    message: string;
  };
/** + Log Activity: a dated entry with remarks on a requisition or a PO. */
export const logRequisitionActivityApi = async (id: number, activity: string, remarks: string) =>
  (await api.post(`/api/v1/purchase-requisitions/${id}/activity`, { activity, remarks })).data as {
    data: Requisition;
    message: string;
  };
export const logPurchaseOrderActivityApi = async (id: number, activity: string, remarks: string) =>
  (await api.post(`/api/v1/purchase-orders/${id}/activity`, { activity, remarks })).data as {
    data: PurchaseOrder;
    message: string;
  };
export const cancelRequisitionApi = async (id: number, remarks?: string) =>
  (await api.post(`/api/v1/purchase-requisitions/${id}/cancel`, { remarks })).data as { data: Requisition };
export const salesOrderOptionsApi = async (search: string) =>
  (await api.get("/api/v1/purchase-requisitions/sales-orders", { params: { search } })).data.data as {
    id: number;
    order_number: string;
    customer_name: string;
  }[];
export const vendorOptionsApi = async () =>
  (await api.get("/api/v1/purchase-requisitions/vendor-options")).data.data as {
    id: number;
    name: string;
    vendor_code: string;
  }[];

// ------------------------------------------------------------------
// The procurement desk
// ------------------------------------------------------------------
export interface ProcurementMeta {
  procurement_statuses: string[];
  manual_statuses: string[];
  purchase_types: Option[];
  priorities: string[];
  quotation_statuses: string[];
  manual_quotation_statuses: string[];
  compliance: string[];
  payment_terms: Option[];
  credit_day_options: Record<string, number[]>;
  payment_modes: Option[];
  permissions: Record<string, boolean>;
}

export interface DeskKpis {
  total: number;
  new: number;
  under_procurement: number;
  collecting: number;
  awaiting_comparison: number;
  po_approval: number;
  po_generated: number;
  overdue: number;
}

export interface Workspace extends Requisition {
  quotations: Quotation[];
  collections: {
    reference: string;
    vendors: string[];
    lines: { item: string; vendors: string[] }[];
    notes?: string;
    started_by_name?: string;
    created_at?: string;
  }[];
  purchase_orders: PurchaseOrder[];
  /** Lines already on a live (not cancelled) PO. */
  ordered_item_ids: number[];
}

/** The desk KPIs over a period. A null figure means there was nothing to
 *  measure it from, which is not the same as zero. */
export interface ProcurementAnalytics {
  days: 30 | 90 | 365;
  since: string;
  open_pipeline: { count: number; value: number };
  overdue: { count: number; percent: number | null };
  approval_cycle: { days: number | null; basis: number };
  sourcing_cycle: { days: number | null; basis: number };
  po_spend: { value: number; count: number };
  po_approval_cycle: { days: number | null; basis: number };
  competitive_rate: { percent: number | null; basis: number };
  quotes_per_pr: { average: number | null; basis: number };
}

export const getProcurementAnalyticsApi = async (days: number): Promise<ProcurementAnalytics> =>
  (await api.get("/api/v1/procurement/analytics", { params: { days } })).data.data;

export const getProcurementMetaApi = async (): Promise<ProcurementMeta> =>
  (await api.get("/api/v1/procurement/meta")).data.data;
export const getDeskApi = async (params: Record<string, unknown>) =>
  (await api.get("/api/v1/procurement/requisitions", { params })).data as {
    data: Requisition[];
    total: number;
    kpis: DeskKpis;
  };
export const getExecutivesApi = async () =>
  (await api.get("/api/v1/procurement/executives")).data.data as { id: string; name: string; email: string }[];
export const getWorkspaceApi = async (id: number | string): Promise<Workspace> =>
  (await api.get(`/api/v1/procurement/requisitions/${id}`)).data.data;

const desk = async (id: number, path: string, payload: unknown, method: "post" | "put" = "post") =>
  (await api[method](`/api/v1/procurement/requisitions/${id}/${path}`, payload)).data as {
    data: Workspace;
    message: string;
  };

export const assignRequisitionApi = (id: number, user_id: string, remarks?: string) =>
  desk(id, "assign", { user_id, remarks });
export const addNoteApi = (id: number, note: string) => desk(id, "notes", { note });
export const setProcurementRemarksApi = (id: number, remarks: string) => desk(id, "remarks", { remarks }, "put");
export const setProcurementStatusApi = (id: number, status: string, remarks?: string) =>
  desk(id, "status", { status, remarks });
/** Which vendors are asked to quote for which lines: {line id: [vendor ids]}. */
export const requestQuotationsApi = (id: number, item_vendors: Record<number, number[]>, notes?: string) =>
  desk(id, "collection", { item_vendors, notes });
/** Active people a requisition can be raised for (procurement only). */
export const requesterOptionsApi = async (search?: string) =>
  (await api.get("/api/v1/procurement/requesters", { params: search ? { search } : {} })).data.data as {
    id: string;
    name: string;
    employee_id?: string | null;
    department_id?: number | null;
    department_name?: string | null;
  }[];
/** Procurement raising a requisition itself; it lands on the desk directly. */
export const raiseDirectRequisitionApi = async (payload: RequisitionPayload) =>
  (await api.post("/api/v1/procurement/requisitions", payload)).data as { data: Workspace; message: string };
export const changeQuantityApi = (id: number, itemId: number, quantity: number | null, reason: string) =>
  desk(id, `items/${itemId}/quantity`, { quantity, reason }, "put");

// ------------------------------------------------------------------
// Vendors
// ------------------------------------------------------------------
export interface Vendor {
  id: number;
  vendor_code: string;
  name: string;
  vendor_type?: string | null;
  contact_person?: string | null;
  designation?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  gstin?: string | null;
  pan?: string | null;
  bank_name?: string | null;
  account_holder?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  branch?: string | null;
  product_categories: string[];
  brands: string[];
  payment_terms?: string | null;
  credit_days?: number | null;
  freight_terms?: string | null;
  lead_time_days?: number | null;
  warranty_terms?: string | null;
  documents: {
    gst?: StoredAttachment;
    pan?: StoredAttachment;
    bank?: StoredAttachment;
    msme?: StoredAttachment;
    other?: StoredAttachment[];
  };
  status: string;
  usable: boolean;
  documents_verified: boolean;
  verified_at?: string | null;
  approved_at?: string | null;
  remarks?: string | null;
  created_at?: string | null;
  performance?: {
    quotations: number;
    selected: number;
    win_rate: number | null;
    purchase_orders: number;
    po_value: number;
    on_time_delivery: number | null;
    quality_acceptance: number | null;
    note: string;
  };
  quotations?: Quotation[];
  purchase_orders?: PurchaseOrder[];
  activity?: ActivityRow[];
}

export const getVendorsApi = async (params: Record<string, unknown>) =>
  (await api.get("/api/v1/vendors", { params })).data as {
    data: Vendor[];
    total: number;
    counts: Record<string, number>;
    vendor_types: string[];
    statuses: string[];
  };
export const getVendorApi = async (id: number | string): Promise<Vendor> =>
  (await api.get(`/api/v1/vendors/${id}`)).data.data;
export const saveVendorApi = async (payload: Record<string, unknown>, id?: number) =>
  (id
    ? (await api.put(`/api/v1/vendors/${id}`, payload)).data
    : (await api.post("/api/v1/vendors", payload)).data) as { data: Vendor; message: string };
export const vendorActionApi = async (id: number, action: string, remarks?: string) =>
  (await api.post(`/api/v1/vendors/${id}/action`, { action, remarks })).data as { data: Vendor };

// ------------------------------------------------------------------
// Quotations
// ------------------------------------------------------------------
export interface QuotationItem {
  id?: number;
  requisition_item_id?: number | null;
  product_name?: string | null;
  sku?: string | null;
  vendor_product_name?: string | null;
  vendor_model?: string | null;
  brand?: string | null;
  hsn?: string | null;
  quantity: number | string;
  uom?: string | null;
  unit_rate: number | string;
  discount_type: "PERCENT" | "AMOUNT";
  discount_value: number | string;
  discount_amount?: number;
  taxable_amount?: number;
  gst_rate: number | string;
  gst_amount?: number;
  freight: number | string;
  packing: number | string;
  other_charges: number | string;
  total?: number;
  delivery_days?: number | string | null;
  warranty?: string | null;
  compliance: string;
  deviation?: string | null;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  requisition_id: number;
  pr_number?: string | null;
  vendor_id: number;
  vendor_name: string;
  root_id: number;
  version: number;
  version_label: string;
  is_latest: boolean;
  vendor_reference?: string | null;
  quotation_date?: string | null;
  valid_until?: string | null;
  received_date?: string | null;
  received_by_name?: string | null;
  currency: string;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  freight_terms?: string | null;
  delivery_days?: number | null;
  warranty_terms?: string | null;
  remarks?: string | null;
  attachments: StoredAttachment[];
  status: string;
  expired: boolean;
  subtotal: number;
  discount_total: number;
  taxable_total: number;
  gst_total: number;
  charges_total: number;
  grand_total: number;
  entered_by_name?: string | null;
  created_at?: string | null;
  item_count: number;
  items?: QuotationItem[];
  versions?: Quotation[];
  activity?: ActivityRow[];
}

export const getQuotationApi = async (id: number | string): Promise<Quotation> =>
  (await api.get(`/api/v1/vendor-quotations/${id}`)).data.data;
export const createQuotationApi = async (payload: Record<string, unknown>) =>
  (await api.post("/api/v1/vendor-quotations", payload)).data as { data: Quotation; message: string };
export const reviseQuotationApi = async (id: number, payload: Record<string, unknown>) =>
  (await api.post(`/api/v1/vendor-quotations/${id}/revise`, payload)).data as { data: Quotation; message: string };
export const setQuotationStatusApi = async (id: number, status: string, remarks?: string) =>
  (await api.post(`/api/v1/vendor-quotations/${id}/status`, { status, remarks })).data as { data: Quotation };

// ------------------------------------------------------------------
// Comparison
// ------------------------------------------------------------------
export interface ComparisonCell extends QuotationItem {
  charges: number;
  landed_unit_cost: number | null;
  short_quantity: boolean;
  lowest_rate: boolean;
  lowest_landed: boolean;
  fastest_delivery: boolean;
  deviation_flag: boolean;
  variance_percent: number | null;
}

export interface ComparisonColumn {
  quotation_id: number;
  quotation_number: string;
  vendor_id: number;
  vendor_name: string;
  vendor_reference?: string | null;
  version_label: string;
  status: string;
  expired: boolean;
  valid_until?: string | null;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  warranty_terms?: string | null;
  delivery_days?: number | null;
  taxable_total: number;
  gst_total: number;
  charges_total: number;
  grand_total: number;
  performance?: Vendor["performance"];
  deviations: number;
  lowest_total: boolean;
  fastest_delivery: boolean;
  difference: number;
  variance_percent: number | null;
}

export interface Comparison {
  requisition_id: number;
  pr_number: string;
  columns: ComparisonColumn[];
  rows: {
    requisition_item_id: number;
    product_name: string;
    sku?: string | null;
    uom?: string | null;
    requested_quantity: number;
    approved_quantity?: number | null;
    quantity: number;
    quotes: Record<string, ComparisonCell>;
  }[];
  generated_at: string;
}

export const getComparisonApi = async (id: number | string, quotationIds?: number[]): Promise<Comparison> =>
  (
    await api.get(`/api/v1/procurement/requisitions/${id}/comparison`, {
      params: quotationIds?.length ? { quotation_ids: quotationIds.join(",") } : {},
    })
  ).data.data;
// ------------------------------------------------------------------
// Purchase orders
// ------------------------------------------------------------------
export interface PurchaseOrderItem {
  id: number;
  product_name?: string | null;
  sku?: string | null;
  hsn?: string | null;
  description?: string | null;
  uom?: string | null;
  quantity: number;
  received_quantity: number;
  unit_rate: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  gst_amount: number;
  freight: number;
  other_charges: number;
  total: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  po_date: string;
  requisition_id: number;
  pr_number?: string | null;
  sales_order_id?: number | null;
  sales_order_number?: string | null;
  vendor_id: number;
  vendor_name: string;
  vendor_address?: string | null;
  vendor_gstin?: string | null;
  vendor_reference?: string | null;
  quotation_id: number;
  quotation_number?: string | null;
  quotation_version?: string | null;
  bill_to?: string | null;
  ship_to?: string | null;
  payment_terms?: string | null;
  payment_term_type?: string | null;
  advance_percent?: number | null;
  credit_days?: number | null;
  payment_mode?: string | null;
  delivery_terms?: string | null;
  freight_terms?: string | null;
  warranty_terms?: string | null;
  terms: string[];
  expected_delivery?: string | null;
  currency: string;
  subtotal: number;
  discount_total: number;
  taxable_total: number;
  gst_total: number;
  charges_total: number;
  grand_total: number;
  status: string;
  submitted_at?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  sent_at?: string | null;
  acknowledged_at?: string | null;
  closed_at?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  item_count: number;
  next_actions: string[];
  requester_name?: string | null;
  waiting_on?: ApprovalStepRow | null;
  can_decide?: boolean;
  items?: PurchaseOrderItem[];
  approvals?: ApprovalStepRow[];
  payments?: PaymentInstalment[];
  activity?: ActivityRow[];
}

export interface PaymentInstalment {
  id: number;
  line_no: number;
  label: string;
  percent: number;
  amount: number;
  due_date?: string | null;
  week?: number | null;
  mode?: string | null;
  bank_name?: string | null;
  cheque_number?: string | null;
  cheque_date?: string | null;
  reference?: string | null;
  status: "PENDING" | "PAID";
  paid_at?: string | null;
  paid_by_name?: string | null;
  remarks?: string | null;
}

export const getPurchaseOrdersApi = async (params: Record<string, unknown>) =>
  (await api.get("/api/v1/purchase-orders", { params })).data as {
    data: PurchaseOrder[];
    total: number;
    counts: Record<string, number>;
  };
export const getPurchaseOrderApi = async (id: number | string): Promise<PurchaseOrder> =>
  (await api.get(`/api/v1/purchase-orders/${id}`)).data.data;
/** A draft PO from a vendor's quotation, for the chosen lines, with its payment terms. */
export const createPurchaseOrderApi = async (payload: Record<string, unknown>) =>
  (await api.post("/api/v1/purchase-orders", payload)).data as { data: PurchaseOrder; message: string };
export const decidePurchaseOrderApi = async (id: number, decision: "APPROVE" | "REJECT", remarks?: string) =>
  (await api.post(`/api/v1/purchase-orders/${id}/decision`, { decision, remarks })).data as {
    data: PurchaseOrder;
    message: string;
  };
export const updatePaymentApi = async (poId: number, paymentId: number, payload: Record<string, unknown>) =>
  (await api.put(`/api/v1/purchase-orders/${poId}/payments/${paymentId}`, payload)).data as {
    data: PurchaseOrder;
    message: string;
  };
export const updatePurchaseOrderApi = async (id: number, payload: Record<string, unknown>) =>
  (await api.put(`/api/v1/purchase-orders/${id}`, payload)).data as { data: PurchaseOrder; message: string };
export const purchaseOrderActionApi = async (id: number, action: string, remarks?: string) =>
  (await api.post(`/api/v1/purchase-orders/${id}/action`, { action, remarks })).data as {
    data: PurchaseOrder;
    message: string;
  };
export const downloadPurchaseOrderPdfApi = async (id: number, number: string) => {
  const response = await api.get(`/api/v1/purchase-orders/${id}/pdf`, { responseType: "blob", timeout: 60000 });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Purchase_Order_${number}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

/** The detail an API error carries, or a fallback. */
export const errorDetail = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
