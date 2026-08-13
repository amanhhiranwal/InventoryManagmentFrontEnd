import api from "@/lib/axios";

export interface Company {
  id: string;
  company_name: string;
  company_code: string;
  email: string;
  phone_number?: string;
  website?: string;
  gst_number?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  logo_url?: string;
  is_active: boolean;
  created_at?: string;
}

export interface CreateCompanyPayload {
  company_name: string;
  company_code: string;
  email: string;
  phone_number?: string;
  website?: string;
  gst_number?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  logo_url?: string;
  is_active?: boolean;
}

export const getCompaniesApi = async (page: number = 1, size: number = 20): Promise<{ data: Company[]; total: number }> => {
  const { data } = await api.get("/api/v1/companies/", { params: { page, size } });
  return {
    data: data.data || [],
    total: data.total || 0,
  };
};

export const getCompanyByIdApi = async (companyId: string): Promise<Company> => {
  const { data } = await api.get(`/api/v1/companies/${companyId}`);
  return data.data || data;
};

export const createCompanyApi = async (payload: CreateCompanyPayload): Promise<Company> => {
  const { data } = await api.post("/api/v1/companies/", payload);
  return data;
};

export const updateCompanyApi = async (companyId: string, payload: Partial<CreateCompanyPayload>): Promise<Company> => {
  const { data } = await api.put(`/api/v1/companies/${companyId}`, payload);
  return data;
};

export const deleteCompanyApi = async (companyId: string): Promise<void> => {
  await api.delete(`/api/v1/companies/${companyId}`);
};

export const uploadCompanyLogoApi = async (companyId: string, file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/api/v1/companies/${companyId}/logo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.logo_url;
};
