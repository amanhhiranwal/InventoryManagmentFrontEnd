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
  created_at: string;
  created_by_name?: string;
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