import api from "@/lib/axios";

/* =========================================================
   CANONICAL STATUSES

   Persisted values. Display labels live in QUOTATION_STATUS_LABEL.
========================================================= */

export const QUOTATION_STATUS = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;

export type QuotationStatus =
  (typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS];

export const QUOTATION_STATUSES: QuotationStatus[] = [
  QUOTATION_STATUS.DRAFT,
  QUOTATION_STATUS.SENT,
  QUOTATION_STATUS.ACCEPTED,
  QUOTATION_STATUS.REJECTED,
  QUOTATION_STATUS.EXPIRED,
];

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

/** Mirrors QUOTATION_TRANSITIONS on the backend. */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> =
  {
    DRAFT: ["SENT", "EXPIRED"],
    SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
    ACCEPTED: [],
    REJECTED: [],
    EXPIRED: [],
  };

export function canTransitionQuotation(
  from: QuotationStatus,
  to: QuotationStatus,
): boolean {
  if (from === to) return true;
  return (QUOTATION_TRANSITIONS[from] || []).includes(to);
}

export function quotationStatusLabel(status?: string | null): string {
  if (!status) return "Draft";
  return QUOTATION_STATUS_LABEL[status as QuotationStatus] || status;
}

/** Statuses a given quotation may move to next, for action menus. */
export function nextQuotationStatuses(
  status?: string | null,
): QuotationStatus[] {
  const current = (status || QUOTATION_STATUS.DRAFT) as QuotationStatus;
  return QUOTATION_TRANSITIONS[current] || [];
}

/* =========================================================
   TYPES
========================================================= */

export interface QuotationItem {
  product?: string;
  model?: string;
  sku?: string;
  quantity?: number;
  unit_price?: number;
  discount?: number;
  tax?: number;
}

export interface QuotationAddress {
  street?: string;
  state?: string;
  city?: string;
  country?: string;
  zip_code?: string;
}

export interface QuotationTerm {
  label: string;
  checked: boolean;
}

export interface QuotationAttachment {
  name: string;
  size?: number;
  type?: string;
}

export interface QuotationModel {
  id: number;
  quote_number?: string | null;
  opportunity_id?: number | null;

  status: QuotationStatus;

  opportunity_name?: string | null;
  organization_name?: string | null;
  contact_name?: string | null;
  designation?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  customer_type?: string | null;

  quotation_date?: string | null;
  validation_date?: string | null;

  billing_address?: QuotationAddress | null;
  shipping_address?: QuotationAddress | null;
  shipping_same_as_billing?: boolean;

  items: QuotationItem[];

  subtotal: number;
  discount_amount: number;
  orc_percent: number;
  orc_amount: number;
  freight_charges: number;
  installation_lumpsum: number;
  taxable_amount: number;
  gst_percent: number;
  gst_amount: number;
  total_payable: number;
  advance_percent: number;
  advance_amount: number;
  on_delivery_amount: number;

  attachments: QuotationAttachment[];
  terms: QuotationTerm[];
  remarks?: string | null;

  sent_at?: string | null;
  sent_to?: string | null;
  sent_cc?: string | null;
  sent_subject?: string | null;
  send_options?: Record<string, boolean> | null;
  rejected_reason?: string | null;

  customer_type_id?: number | null;
  state_id?: number | null;
  state_name?: string | null;

  creator_id?: string | null;
  assigned_to_id?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateQuotationPayload {
  opportunity_id?: number | null;
  status?: string;

  opportunity_name?: string;
  organization_name?: string;
  contact_name?: string;
  designation?: string;
  email?: string;
  mobile_number?: string;
  customer_type?: string;

  quotation_date?: string;
  validation_date?: string;

  billing_address?: QuotationAddress;
  shipping_address?: QuotationAddress;
  shipping_same_as_billing?: boolean;

  items?: QuotationItem[];

  orc_percent?: number;
  orc_amount?: number;
  freight_charges?: number;
  installation_lumpsum?: number;
  gst_percent?: number;
  advance_percent?: number;

  attachments?: QuotationAttachment[];
  terms?: QuotationTerm[];
  remarks?: string;

  customer_type_id?: number | null;
  state_id?: number | null;
  assigned_to_id?: string | null;
}

export interface SendQuotationPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  /** Plain-text body, sent as the text/plain part. */
  body?: string;
  /** Rich-text body from the composer, sanitised server-side and sent as
   *  the text/html part so bold/italic/underline survive. */
  body_html?: string;

  track_opens?: boolean;
  alert_on_download?: boolean;
  attach_gst_audit_trail?: boolean;
  notify_lead_owner?: boolean;

  /** Send Test Email To Self: delivers to the caller, leaves status alone. */
  test_only?: boolean;
}

/* =========================================================
   CLIENT
========================================================= */

export interface QuotationSender {
  name: string;
  email: string;
  configured: boolean;
}

/**
 * Identity every quotation email is sent from. Mail always leaves through
 * the one configured SMTP account, so this is not per-user and the Send
 * dialog shows it read-only.
 */
export const getQuotationSenderApi = async (): Promise<QuotationSender> => {
  const { data } = await api.get("/api/v1/quotations/sender");
  return data.data || data;
};

export const getQuotationsApi = async (): Promise<QuotationModel[]> => {
  const { data } = await api.get("/api/v1/quotations/");
  return data.data || [];
};

export const getQuotationApi = async (
  quotationId: number | string,
): Promise<QuotationModel> => {
  const { data } = await api.get(`/api/v1/quotations/${quotationId}`);
  return data.data || data;
};

export const createQuotationApi = async (
  payload: CreateQuotationPayload,
): Promise<QuotationModel> => {
  const { data } = await api.post("/api/v1/quotations/", payload);
  return data.data || data;
};

export const updateQuotationApi = async (
  quotationId: number | string,
  payload: Partial<CreateQuotationPayload>,
): Promise<QuotationModel> => {
  const { data } = await api.put(`/api/v1/quotations/${quotationId}`, payload);
  return data.data || data;
};

export const updateQuotationStatusApi = async (
  quotationId: number | string,
  status: QuotationStatus,
  rejectedReason?: string,
): Promise<QuotationModel> => {
  const { data } = await api.put(`/api/v1/quotations/${quotationId}/status`, {
    status,
    rejected_reason: rejectedReason,
  });
  return data.data || data;
};

export const sendQuotationApi = async (
  quotationId: number | string,
  payload: SendQuotationPayload,
): Promise<QuotationModel> => {
  const { data } = await api.post(
    `/api/v1/quotations/${quotationId}/send`,
    payload,
  );
  return data.data || data;
};
