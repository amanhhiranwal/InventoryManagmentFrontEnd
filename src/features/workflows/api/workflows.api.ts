import api from "@/lib/axios";

export interface WorkflowNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: {
    label: string;
    role_id: string;
  };
  x?: number;
  y?: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
}

export interface LeadActivity {
  id?: string;
  action: string;
  description?: string;

  /* Status either side of the move, so the timeline can still be read once
     the lead has advanced past it. Absent on a note-only entry. */
  from_status?: string | null;
  to_status?: string | null;

  created_at: string;
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface Lead {
  id: number | string;
  title: string;
  description?: string;
  status: string;
  stage: string;

  demo_status?: string;
  requirements?: string;

  quotation_type?: string;
  quotation_items?: Array<{
    item: string;
    qty: number;
    price: number;
  }>;

  contact_name?: string;
  organization_name?: string;
  email?: string;
  mobile_number?: string;
  website?: string;
  office_address?: string;
  city?: string;
  zip_code?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  coi_number?: string;
  designation?: string;
  remarks?: string;

  customer_type_id?: number | string;
  customer_type_name?: string;
  state_id?: number | string;
  state_name?: string;
  lead_source_id?: number | string;
  lead_source_name?: string;

  creator_id: string;
  creator_name: string;

  assigned_to_id?: string;
  assigned_to_name?: string;

  assigned_by_id?: string;
  assigned_by_name?: string;

  created_at: string;

  activity_history?: LeadActivity[];
}

export const getWorkflowsApi = async (): Promise<Workflow[]> => {
  const { data } = await api.get("/api/v1/workflows/");
  return data.data || data;
};

export const createWorkflowApi = async (payload: {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}): Promise<Workflow> => {
  const { data } = await api.post("/api/v1/workflows/", payload);
  return data.data || data;
};

export const updateWorkflowApi = async (
  id: string,
  payload: {
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  }
): Promise<Workflow> => {
  const { data } = await api.put(`/api/v1/workflows/${id}`, payload);
  return data.data || data;
};

export const deleteWorkflowApi = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/workflows/${id}`);
};

export const getLeadsApi = async (): Promise<Lead[]> => {
  const { data } = await api.get("/api/v1/leads/");
  return data.data || data;
};

export const createLeadApi = async (payload: {

  title: string;
  description?: string;
  status?: string;
  contact_name?: string;
  organization_name?: string;
  email?: string;
  mobile_number?: string;
  website?: string;
  office_address?: string;
  city?: string;
  zip_code?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  coi_number?: string;
  designation?: string;
  remarks?: string;
  customer_type_id?: number | string;
  state_id?: number | string;
  lead_source_id?: number | string;
  assigned_to_id?: string;
}): Promise<Lead> => {
  const { data } = await api.post("/api/v1/leads/", payload);
  return data.data || data;
};

/** One spreadsheet row, with the master lists named rather than numbered. */
export interface LeadImportRow {
  contact_name?: string;
  organization_name?: string;
  designation?: string;
  email?: string;
  mobile_number?: string;
  website?: string;
  office_address?: string;
  city?: string;
  zip_code?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  coi_number?: string;
  remarks?: string;
  customer_type?: string;
  state?: string;
  lead_source?: string;
  assigned_to?: string;
}

export interface LeadImportResult {
  created: number;
  ids: number[];
  skipped: { row: number; name: string; reason: string }[];
  total: number;
}

/**
 * Import a whole sheet of leads in one request.
 *
 * Needs lead.bulk_upload, checked on the server. The client used to loop
 * over the single-create route instead, which meant the permission was
 * only hiding a button. Each row is judged on its own and the rejected
 * ones come back with their sheet row and the reason, so one bad cell
 * does not cost the rest of the file.
 */
export const importLeadsApi = async (
  leads: LeadImportRow[],
): Promise<LeadImportResult> => {
  const { data } = await api.post("/api/v1/leads/bulk", { leads });
  return data.data;
};

export const updateLeadApi = async (
  leadId: number | string,
  payload: {
    title?: string;
    description?: string;
    status?: string;
    stage?: string;
    contact_name?: string;
    organization_name?: string;
    email?: string;
    mobile_number?: string;
    website?: string;
    office_address?: string;
    city?: string;
    zip_code?: string;
    country?: string;
    gst_number?: string;
    pan_number?: string;
    coi_number?: string;
    designation?: string;
    remarks?: string;
    customer_type_id?: number | string;
    state_id?: number | string;
    lead_source_id?: number | string;
    assigned_to_id?: string;
  }
): Promise<Lead> => {
  const { data } = await api.put(`/api/v1/leads/${leadId}`, payload);
  return data.data || data;
};

export interface ProgressLeadPayload {
  stage: string;
  status?: string;
  demo_status?: string;
  requirements?: string;
  quotation_type?: string;
  quotation_items?: Array<{
    item: string;
    qty: number;
    price: number;
  }>;
}

export const progressLeadApi = async (
  leadId: string,
  payload: ProgressLeadPayload
): Promise<Lead> => {
  const { data } = await api.put(
    `/api/v1/leads/${leadId}/progress`,
    payload
  );

  return data.data || data;
};

/* Activity History is fetched per lead rather than being carried on the list
   response: the table never shows it, so loading every lead's timeline just
   to draw the rows would be wasted work. */
export const getLeadActivitiesApi = async (
  leadId: number | string
): Promise<LeadActivity[]> => {
  const { data } = await api.get(`/api/v1/leads/${leadId}/activities`);

  return data.data || data;
};

export interface LogLeadActivityPayload {
  /* Omitted for a note against the lead; otherwise the status to move to.
     CONVERTED is not accepted here - conversion runs through the New
     Opportunity flow, which has to create the opportunity as well. */
  status?: string;
  action?: string;
  remarks?: string;
}

export const logLeadActivityApi = async (
  leadId: number | string,
  payload: LogLeadActivityPayload
): Promise<{
  activity: LeadActivity;
  lead: { id: number | string; status: string; stage: string };
}> => {
  const { data } = await api.post(
    `/api/v1/leads/${leadId}/activities`,
    payload
  );

  return data.data || data;
};

export const assignLeadApi = async (
  leadId: string,
  assignedToId: string
): Promise<Lead> => {
  const { data } = await api.put(
    `/api/v1/leads/${leadId}/assign`,
    {
      assigned_to_id: assignedToId,
    }
  );

  return data.data || data;
};