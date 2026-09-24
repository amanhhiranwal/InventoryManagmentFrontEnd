import api from "@/lib/axios";

/* =========================================================
   DISCOUNT APPROVALS

   A discount is applied by a salesperson and signed for above them: the
   AVP carries the first 15%, the CEO the next 5%, and past 20% only the
   founder. Dealer price is a transfer price and is the CEO's alone.
========================================================= */

export const PRICE_TYPE = {
  /** End Customer Price - what a discount comes off. */
  ECP: "ECP",
  /** Dealer Price, the transfer price. Non-negotiable. */
  DP: "DP",
} as const;

export type PriceType = (typeof PRICE_TYPE)[keyof typeof PRICE_TYPE];

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  ECP: "End Customer Price",
  DP: "Dealer Price",
};

export type ApprovalDocumentType = "QUOTATION" | "SALES_ORDER";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export interface ApprovalStep {
  role: string;
  approver_id?: string | null;
  approver_name?: string | null;
  decision?: "APPROVED" | "REJECTED" | null;
  remarks?: string | null;
  decided_at?: string | null;
}

export interface SalesApproval {
  id: number;
  document_type: ApprovalDocumentType;
  document_id: number;
  document_number?: string | null;

  price_type: PriceType;
  discount_percent: number;
  discount_amount?: number | null;
  orc_percent?: number | null;
  orc_amount?: number | null;
  document_value?: number | null;

  status: ApprovalStatus;
  current_step: number;
  /** The role holding it up, or null once it is decided. */
  waiting_on?: string | null;
  steps: ApprovalStep[];

  requested_by?: string | null;
  requested_by_name?: string | null;
  requested_at?: string | null;
  decided_at?: string | null;
  remarks?: string | null;
  /** One line explaining why these approvals are needed. */
  reason?: string | null;
}

export interface ApprovalBand {
  role: string;
  from_percent: number;
  to_percent: number | null;
  label: string;
}

export const getApprovalMatrixApi = async (): Promise<{
  bands: ApprovalBand[];
  founder_role: string;
  price_types: { value: PriceType; label: string }[];
}> => {
  const { data } = await api.get("/api/v1/approvals/matrix");
  return data.data;
};

/** Who would have to approve this, without raising anything. */
export const previewApprovalApi = async (
  priceType: PriceType,
  discountPercent: number,
): Promise<{ chain: string[]; reason: string; needs_approval: boolean }> => {
  const { data } = await api.get("/api/v1/approvals/preview", {
    params: { price_type: priceType, discount_percent: discountPercent },
  });
  return data.data;
};

export interface RequestApprovalPayload {
  document_type: ApprovalDocumentType;
  document_id: number;
  document_number?: string | null;
  price_type: PriceType;
  discount_percent: number;
  discount_amount?: number | null;
  orc_percent?: number | null;
  orc_amount?: number | null;
  document_value?: number | null;
  remarks?: string | null;
}

export const requestApprovalApi = async (
  payload: RequestApprovalPayload,
): Promise<SalesApproval | null> => {
  const { data } = await api.post("/api/v1/approvals", payload);
  return data.data ?? null;
};

/** Requests this user is the one holding up. */
export const getPendingApprovalsApi = async (): Promise<SalesApproval[]> => {
  const { data } = await api.get("/api/v1/approvals/pending");
  return Array.isArray(data?.data) ? data.data : [];
};

/** Every request raised by someone this user can see. */
export const getApprovalsApi = async (): Promise<SalesApproval[]> => {
  const { data } = await api.get("/api/v1/approvals");
  return Array.isArray(data?.data) ? data.data : [];
};

export const getApprovalForDocumentApi = async (
  documentType: ApprovalDocumentType,
  documentId: number | string,
): Promise<SalesApproval | null> => {
  const { data } = await api.get(
    `/api/v1/approvals/document/${documentType}/${documentId}`,
  );
  return data.data ?? null;
};

export const decideApprovalApi = async (
  approvalId: number,
  approve: boolean,
  remarks?: string,
): Promise<SalesApproval> => {
  const { data } = await api.put(`/api/v1/approvals/${approvalId}/decide`, {
    approve,
    remarks,
  });
  return data.data;
};

export const withdrawApprovalApi = async (
  approvalId: number,
): Promise<SalesApproval> => {
  const { data } = await api.put(`/api/v1/approvals/${approvalId}/withdraw`);
  return data.data;
};

/** Where a document lives, for the link off an approval row. */
export function approvalDocumentLink(approval: SalesApproval): string {
  return approval.document_type === "QUOTATION"
    ? `/sales/quotations/${approval.document_id}`
    : `/sales/orders/${approval.document_id}`;
}

export function approvalDocumentLabel(type: ApprovalDocumentType): string {
  return type === "QUOTATION" ? "Quotation" : "Sales Order";
}
