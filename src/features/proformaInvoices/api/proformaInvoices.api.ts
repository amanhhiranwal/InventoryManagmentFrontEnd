import api from "@/lib/axios";

/* =========================================================
   CANONICAL STATUSES
========================================================= */

export const PROFORMA_INVOICE_STATUS = {
  DRAFT: "DRAFT",
  GENERATED: "GENERATED",
  SENT: "SENT",
  CANCELLED: "CANCELLED",
} as const;

export type ProformaInvoiceStatus =
  (typeof PROFORMA_INVOICE_STATUS)[keyof typeof PROFORMA_INVOICE_STATUS];

export const PROFORMA_INVOICE_STATUSES: ProformaInvoiceStatus[] = [
  "DRAFT",
  "GENERATED",
  "SENT",
  "CANCELLED",
];

export const PROFORMA_INVOICE_STATUS_LABEL: Record<ProformaInvoiceStatus, string> = {
  DRAFT: "Draft",
  GENERATED: "Generated",
  SENT: "Sent",
  CANCELLED: "Cancelled",
};

/** Mirrors PROFORMA_INVOICE_TRANSITIONS on the backend. */
export const PROFORMA_INVOICE_TRANSITIONS: Record<
  ProformaInvoiceStatus,
  ProformaInvoiceStatus[]
> = {
  DRAFT: ["GENERATED", "CANCELLED"],
  GENERATED: ["SENT", "CANCELLED"],
  SENT: ["CANCELLED"],
  CANCELLED: [],
};

/** Pill colours from the design: Draft blue, Generated grey, Sent green,
    Cancelled red. */
export const PROFORMA_INVOICE_STATUS_TONE: Record<
  ProformaInvoiceStatus,
  "blue" | "neutral" | "green" | "rose"
> = {
  DRAFT: "blue",
  GENERATED: "neutral",
  SENT: "green",
  CANCELLED: "rose",
};

export function proformaInvoiceStatusLabel(status?: string | null) {
  return (
    PROFORMA_INVOICE_STATUS_LABEL[status as ProformaInvoiceStatus] ||
    status ||
    "Draft"
  );
}

/** What can still be changed at each status - mirrors EDITABLE_FIELDS. */
export function editableProformaFields(status?: string | null) {
  switch (status) {
    case "DRAFT":
      return {
        everything: true,
        charges: true,
        amountPaid: true,
      };
    case "GENERATED":
      return { everything: false, charges: true, amountPaid: true };
    case "SENT":
      return { everything: false, charges: false, amountPaid: true };
    default:
      return { everything: false, charges: false, amountPaid: false };
  }
}

/** The stored reference with a single leading "#", e.g. "#PI-00001". */
export function piReference(invoice: { pi_number?: string | null; id: number }) {
  return `#${invoice.pi_number || `PI-${invoice.id}`}`;
}

/* =========================================================
   TYPES
========================================================= */

export interface ProformaInvoiceItem {
  product_id?: string;
  product?: string;
  model?: string;
  sku?: string;
  description?: string;
  item?: string;
  rate?: number;
  price?: number;
  qty?: number;
  quantity_case?: number;
  quantity_kg_ltr?: number;
  discount?: number;
  tax_rate?: number;
  /** Carried from the product, through the quotation and the order. A GST
      document has to print the code the goods were classified under. */
  hsn?: string;
}

export interface ProformaAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
}

/** One HSN's worth of tax, as a GST document has to show it. */
export interface TaxSummaryRow {
  hsn: string;
  taxable: number;
  rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax: number;
}

export interface TaxSummary {
  /** True when the goods cross a state line, so one IGST line replaces
      the CGST and SGST pair. */
  interstate: boolean;
  rows: TaxSummaryRow[];
  taxable_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  tax_total: number;
  grand_total: number;
}

export interface ProformaInvoiceModel {
  id: number;
  pi_number?: string | null;
  status: ProformaInvoiceStatus;

  sales_order_id?: number | null;
  sales_order?: {
    id: number;
    order_number?: string | null;
    status: string;
    quotation_id?: string | null;
    po_number?: string | null;
    po_date?: string | null;
    opportunity_id?: number | null;
  } | null;

  issue_date?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;

  customer_name: string;
  company_name?: string | null;
  customer_type?: string | null;
  state?: string | null;

  customer_information: Record<string, any>;
  billing_address: ProformaAddress;
  shipping_address: ProformaAddress;
  items: ProformaInvoiceItem[];

  total_amount: number;
  discount_amount: number;
  /** How the order's summary discount and ORC were entered. */
  discount_mode?: "AMOUNT" | "PERCENT";
  discount_input?: number | null;
  orc_mode?: "AMOUNT" | "PERCENT";
  orc_input?: number | null;
  orc_amount: number;
  orc_percent: number;
  freight_charges: number;
  installation_lumpsum: number;
  taxable_amount: number;
  gst_percent: number;
  gst_amount: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;

  advance_percent: number;
  advance_expected: number;
  balance_expected: number;

  commercial_terms: string[];
  /** How this invoice is to be paid, carried from the proposal. */
  payment_terms?: string | null;
  technical_notes?: string | null;

  /* The tax, worked out on the server. A document that recomputes its own
     GST is a document that can disagree with what was charged. */
  tax_summary?: TaxSummary | null;
  place_of_supply?: string | null;
  seller_state_code?: string | null;
  buyer_state_code?: string | null;
  attachments: { name: string; size?: number; type?: string }[];

  generated_at?: string | null;
  sent_at?: string | null;
  sent_to?: string | null;
  send_options?: Record<string, boolean>;

  creator_id?: string | null;
  creator_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProformaInvoicePayload {
  sales_order_id?: number;
  status?: "DRAFT" | "GENERATED";
  issue_date?: string | null;
  due_date?: string | null;
  assigned_to?: string;
  billing_address?: ProformaAddress;
  shipping_address?: ProformaAddress;
  items?: ProformaInvoiceItem[];
  freight_charges?: number;
  installation_lumpsum?: number;
  gst_percent?: number;
  amount_paid?: number;
  advance_percent?: number;
  commercial_terms?: string[];
  payment_terms?: string;
  technical_notes?: string;
  attachments?: { name: string; size?: number; type?: string }[];
}

export interface CompanyProfile {
  legal_name?: string | null;
  address_lines: string[];
  gstin?: string | null;
  state_name?: string | null;
  state_code?: string | null;
  bank: {
    beneficiary_name?: string | null;
    bank_name?: string | null;
    branch?: string | null;
    account_number?: string | null;
    ifsc?: string | null;
    swift?: string | null;
    upi_vpa?: string | null;
    /** Path on the API, not a data URL: the image is served, not inlined. */
    upi_qr_url?: string | null;
  };
  signatory: { name?: string | null; title?: string | null };
  configured: boolean;
}

export interface ProformaInvoiceActivity {
  id: string;
  source: "proforma_invoice" | "order" | "opportunity";
  action: string;
  description?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  created_at: string;
  created_by?: string | null;
  created_by_name?: string | null;
}

/* =========================================================
   API
========================================================= */

const BASE = "/api/v1/proforma-invoices";

export const getProformaInvoicesApi = async (
  salesOrderId?: number | string,
): Promise<ProformaInvoiceModel[]> => {
  const { data } = await api.get(BASE, {
    params: salesOrderId ? { sales_order_id: salesOrderId } : undefined,
  });
  return Array.isArray(data?.data) ? data.data : [];
};

export const getProformaInvoiceApi = async (
  id: number | string,
): Promise<ProformaInvoiceModel> => {
  const { data } = await api.get(`${BASE}/${id}`);
  return data.data;
};

export const getCompanyProfileApi = async (): Promise<CompanyProfile> => {
  const { data } = await api.get(`${BASE}/company-profile`);
  return data.data;
};

/** One payment split: the advance figure and the sentence that describes it. */
export interface PaymentTermOption {
  advance_percent: number;
  label: string;
}

/**
 * The splits a document can be issued on.
 *
 * Served rather than listed in each screen, so the proposal, the sales
 * order and this invoice offer the same terms and a new one is added in a
 * single place. The percentage travels with the wording because every
 * figure on the three documents is worked out from it - the wording alone
 * would leave "50% advance" printing a 30% number.
 */
export const getPaymentTermOptionsApi = async (): Promise<PaymentTermOption[]> => {
  const { data } = await api.get(`${BASE}/payment-terms`);
  return data.data || [];
};

export const createProformaInvoiceApi = async (
  payload: ProformaInvoicePayload,
): Promise<ProformaInvoiceModel> => {
  const { data } = await api.post(BASE, payload);
  return data.data;
};

export const updateProformaInvoiceApi = async (
  id: number | string,
  payload: ProformaInvoicePayload,
): Promise<ProformaInvoiceModel> => {
  const { data } = await api.put(`${BASE}/${id}`, payload);
  return data.data;
};

export const generateProformaInvoiceApi = async (
  id: number | string,
): Promise<ProformaInvoiceModel> => {
  const { data } = await api.post(`${BASE}/${id}/generate`);
  return data.data;
};

export const updateProformaInvoiceStatusApi = async (
  id: number | string,
  status: ProformaInvoiceStatus,
  remarks?: string,
): Promise<ProformaInvoiceModel> => {
  const { data } = await api.put(`${BASE}/${id}/status`, { status, remarks });
  return data.data;
};

export const sendProformaInvoiceApi = async (
  id: number | string,
  payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    body_html?: string;
    track_opens?: boolean;
    alert_on_download?: boolean;
    attach_gst_audit_trail?: boolean;
    notify_lead_owner?: boolean;
    test_only?: boolean;
  },
): Promise<ProformaInvoiceModel> => {
  const { data } = await api.post(`${BASE}/${id}/send`, payload);
  return data.data;
};

export const getProformaInvoiceActivitiesApi = async (
  id: number | string,
): Promise<ProformaInvoiceActivity[]> => {
  const { data } = await api.get(`${BASE}/${id}/activities`);
  return Array.isArray(data?.data) ? data.data : [];
};

export const logProformaInvoiceActivityApi = async (
  id: number | string,
  payload: { status?: string; remarks?: string },
): Promise<{ activity: ProformaInvoiceActivity; invoice: ProformaInvoiceModel }> => {
  const { data } = await api.post(`${BASE}/${id}/activities`, payload);
  return data.data;
};

export const deleteProformaInvoiceApi = async (id: number | string) => {
  await api.delete(`${BASE}/${id}`);
};
