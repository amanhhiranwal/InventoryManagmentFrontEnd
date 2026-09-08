import api from "@/lib/axios";

/* =========================================================
   CANONICAL STATUSES

   These are the exact values persisted by the backend and the
   database. Display labels live in OPPORTUNITY_STATUS_LABEL so the
   existing UI wording is preserved without leaking display strings
   into the API layer.
========================================================= */

export const OPPORTUNITY_STATUS = {
  QUALIFICATION: "QUALIFICATION",
  REQUIREMENT: "REQUIREMENT",
  DEMO: "DEMO",
  PROPOSAL: "PROPOSAL",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  LOST: "LOST",
} as const;

export type OpportunityStatus =
  (typeof OPPORTUNITY_STATUS)[keyof typeof OPPORTUNITY_STATUS];

/** Ordered pipeline stages, excluding terminal outcomes. */
export const OPPORTUNITY_PIPELINE: OpportunityStatus[] = [
  OPPORTUNITY_STATUS.QUALIFICATION,
  OPPORTUNITY_STATUS.REQUIREMENT,
  OPPORTUNITY_STATUS.DEMO,
  OPPORTUNITY_STATUS.PROPOSAL,
  OPPORTUNITY_STATUS.NEGOTIATION,
];

/** Existing UI wording, kept so the board/list look unchanged. */
export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatus, string> = {
  QUALIFICATION: "Qualified",
  REQUIREMENT: "Requirement",
  DEMO: "Demo Scheduled",
  PROPOSAL: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Closed Won",
  LOST: "Dead",
};

/** Allowed forward moves, mirroring OPPORTUNITY_TRANSITIONS on the backend. */
export const OPPORTUNITY_TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> =
  {
    QUALIFICATION: ["REQUIREMENT", "LOST"],
    REQUIREMENT: ["DEMO", "LOST"],
    DEMO: ["PROPOSAL", "LOST"],
    PROPOSAL: ["NEGOTIATION", "LOST"],
    NEGOTIATION: ["WON", "LOST"],
    WON: [],
    LOST: [],
  };

export function canTransitionOpportunity(
  from: OpportunityStatus,
  to: OpportunityStatus,
): boolean {
  if (from === to) return true;
  return (OPPORTUNITY_TRANSITIONS[from] || []).includes(to);
}

export function opportunityStatusLabel(status: string): string {
  return (
    OPPORTUNITY_STATUS_LABEL[status as OpportunityStatus] || status || "Qualified"
  );
}

/* =========================================================
   TYPES
========================================================= */

export interface OpportunityProductItem {
  name?: string;
  qty?: number;
  price?: number;
  [key: string]: unknown;
}

export interface OpportunityModel {
  id: number;
  lead_id: number | null;

  title: string;
  description?: string | null;
  status: OpportunityStatus;

  deal_value?: number | null;
  priority?: string | null;
  expected_closing_date?: string | null;

  contact_name?: string | null;
  organization_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  website?: string | null;
  designation?: string | null;
  office_address?: string | null;
  city?: string | null;
  zip_code?: string | null;
  country?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  coi_number?: string | null;

  requirements?: string | null;
  remarks?: string | null;
  demo_status?: string | null;

  product_items?: OpportunityProductItem[] | null;

  customer_type_id?: number | null;
  customer_type_name?: string | null;
  state_id?: number | null;
  state_name?: string | null;

  creator_id?: string | null;
  assigned_to_id?: string | null;

  won_at?: string | null;
  won_by?: string | null;
  won_reason?: string | null;
  lost_reason?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateOpportunityPayload {
  title?: string;
  description?: string;
  lead_id?: number;

  deal_value?: number;
  priority?: string;
  expected_closing_date?: string | null;

  contact_name?: string;
  organization_name?: string;
  email?: string;
  mobile_number?: string;
  website?: string;
  designation?: string;
  office_address?: string;
  city?: string;
  zip_code?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  coi_number?: string;

  requirements?: string;
  remarks?: string;

  product_items?: OpportunityProductItem[];

  customer_type_id?: number;
  state_id?: number;
  assigned_to_id?: string;
}

export type UpdateOpportunityPayload = Partial<CreateOpportunityPayload>;

export interface ConvertLeadPayload {
  deal_value?: number;
  priority?: string;
  expected_closing_date?: string | null;
  requirements?: string;
  product_items?: OpportunityProductItem[];
  assigned_to_id?: string;
}

/* =========================================================
   API
========================================================= */

export const getOpportunitiesApi = async (): Promise<OpportunityModel[]> => {
  const { data } = await api.get("/api/v1/opportunities/");
  return Array.isArray(data?.data) ? data.data : [];
};

export const getOpportunityApi = async (
  id: number | string,
): Promise<OpportunityModel> => {
  const { data } = await api.get(`/api/v1/opportunities/${id}`);
  return data.data;
};

export const createOpportunityApi = async (
  payload: CreateOpportunityPayload,
): Promise<OpportunityModel> => {
  const { data } = await api.post("/api/v1/opportunities/", payload);
  return data.data;
};

export const updateOpportunityApi = async (
  id: number | string,
  payload: UpdateOpportunityPayload,
): Promise<OpportunityModel> => {
  const { data } = await api.put(`/api/v1/opportunities/${id}`, payload);
  return data.data;
};

export const updateOpportunityStatusApi = async (
  id: number | string,
  status: OpportunityStatus,
  reason?: { won_reason?: string; lost_reason?: string },
): Promise<OpportunityModel> => {
  const { data } = await api.put(`/api/v1/opportunities/${id}/status`, {
    status,
    ...(reason || {}),
  });
  return data.data;
};

/** Promote a QUALIFIED lead into an opportunity. */
export const convertLeadToOpportunityApi = async (
  leadId: number | string,
  payload: ConvertLeadPayload = {},
): Promise<OpportunityModel> => {
  const { data } = await api.post(`/api/v1/leads/${leadId}/convert`, payload);
  return data.data;
};
