import api from "@/lib/axios";

/* =========================================================
   STAGES
========================================================= */

/** The Contact Details stepper, in order. Mirrors CUSTOMER_STAGES. */
export const CUSTOMER_STAGES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "OPEN_DEAL", label: "Open Deal" },
  { value: "CLOSED", label: "Closed" },
] as const;

export type CustomerStage = (typeof CUSTOMER_STAGES)[number]["value"];

/** What "Log Activity" can record. Mirrors ACTIVITY_TYPES. */
export const CUSTOMER_ACTIVITY_TYPES = [
  "Call",
  "Email",
  "Meeting",
  "Note",
  "Follow Up",
] as const;

export type CustomerActivityType = (typeof CUSTOMER_ACTIVITY_TYPES)[number];

/* =========================================================
   TYPES
========================================================= */

export interface CustomerModel {
  id: string;
  customer_code?: string;

  /** Organization name. */
  name: string;
  contact_name?: string;
  designation?: string;
  email?: string;
  phone?: string;
  website?: string;

  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  country?: string;

  gst?: string;
  pan?: string;
  coi?: string;
  isRegistered?: boolean;

  customer_type?: string;
  category?: string;
  remarks?: string;
  /** Marketing, Cold Calling, In-bound... - carried onto the lead. */
  lead_source?: string;
  /** Saved with "Save as Draft" and not yet turned into a lead. */
  is_draft?: boolean;

  stage?: CustomerStage;
  status?: "Active" | "Inactive";

  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  creator_id?: string | null;
  creator_name?: string | null;

  converted_lead_id?: number | null;
  attachments?: string[];

  created_at?: string;
  updated_at?: string;
  last_activity_at?: string;
}

export type CustomerPayload = Partial<
  Pick<
    CustomerModel,
    | "name"
    | "contact_name"
    | "designation"
    | "email"
    | "phone"
    | "website"
    | "address"
    | "city"
    | "state"
    | "pin_code"
    | "country"
    | "gst"
    | "pan"
    | "coi"
    | "customer_type"
    | "category"
    | "remarks"
    | "lead_source"
    | "assigned_to_id"
    | "attachments"
  >
> & {
  /** "Create Lead": save the customer and open its lead in one go. */
  create_lead?: boolean;
  /** "Save as Draft". */
  draft?: boolean;
};

/** A saved customer, plus the lead opened with it when asked. */
export type SavedCustomer = CustomerModel & { lead_id?: number | null };

export interface CustomerActivity {
  id: string;
  type: string;
  action: string;
  description?: string;
  from_stage?: string | null;
  to_stage?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

/* =========================================================
   API
========================================================= */

export const getCustomersApi = async (): Promise<CustomerModel[]> => {
  const { data } = await api.get("/api/v1/customers");
  return Array.isArray(data?.data) ? data.data : [];
};

export const getCustomerApi = async (id: string): Promise<CustomerModel> => {
  const { data } = await api.get(`/api/v1/customers/${id}`);
  return data.data;
};

export const createCustomerApi = async (
  payload: CustomerPayload,
): Promise<SavedCustomer> => {
  const { data } = await api.post("/api/v1/customers", payload);
  return data.data;
};

export const updateCustomerApi = async (
  id: string,
  payload: CustomerPayload,
): Promise<SavedCustomer> => {
  const { data } = await api.put(`/api/v1/customers/${id}`, payload);
  return data.data;
};

export const updateCustomerStageApi = async (
  id: string,
  stage: CustomerStage,
  remarks?: string,
): Promise<CustomerModel> => {
  const { data } = await api.put(`/api/v1/customers/${id}/stage`, { stage, remarks });
  return data.data;
};

/** Mark as Dead (Inactive, with a reason) or reactivate (Active). */
export const updateCustomerStatusApi = async (
  id: string,
  status: "Active" | "Inactive",
  remarks?: string,
): Promise<CustomerModel> => {
  const { data } = await api.put(`/api/v1/customers/${id}/status`, { status, remarks });
  return data.data;
};

export const getCustomerActivitiesApi = async (
  id: string,
): Promise<CustomerActivity[]> => {
  const { data } = await api.get(`/api/v1/customers/${id}/activities`);
  return Array.isArray(data?.data) ? data.data : [];
};

export const logCustomerActivityApi = async (
  id: string,
  type: CustomerActivityType,
  description: string,
): Promise<CustomerActivity> => {
  const { data } = await api.post(`/api/v1/customers/${id}/activities`, {
    type,
    description,
  });
  return data.data;
};

export const convertCustomerToLeadApi = async (
  id: string,
  payload: { title?: string; remarks?: string; assigned_to_id?: string },
): Promise<{ lead_id: number; customer: CustomerModel }> => {
  const { data } = await api.post(`/api/v1/customers/${id}/convert-to-lead`, payload);
  return data.data;
};

/* =========================================================
   BULK IMPORT
========================================================= */

/** One spreadsheet row, mapped from its column headers. */
export interface CustomerImportRow {
  name?: string;
  contact_name?: string;
  designation?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  gst?: string;
  pan?: string;
  customer_type?: string;
  category?: string;
  status?: string;
  assigned_to?: string;
}

export interface CustomerImportResult {
  created: number;
  total: number;
  /** Rows that were not created, with their sheet row number and why. */
  skipped: { row: number; name: string; reason: string }[];
}

export const importCustomersApi = async (
  customers: CustomerImportRow[],
): Promise<CustomerImportResult> => {
  const { data } = await api.post("/api/v1/customers/bulk", { customers });
  return data.data;
};

/** Permission key ticked in Roles & Access to allow Add From Excel. */
export const CUSTOMER_BULK_UPLOAD_PERMISSION = "customer.bulk_upload";
