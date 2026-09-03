import api from "@/lib/axios";

export interface Location {
  id: string;
  location_name: string;
  location_code: string;
  company_id: string;
  email: string;
  phone_number?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  created_at?: string;
}

export interface CreateLocationPayload {
  location_name: string;
  location_code: string;
  company_id: string;
  email: string;
  phone_number?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

export const getLocationsApi = async (page: number = 1, size: number = 20): Promise<{ data: Location[]; total: number }> => {
  const { data } = await api.get("/api/v1/locations/", { params: { page, size } });
  return {
    data: data.data || [],
    total: data.total || 0,
  };
};

export const getLocationByIdApi = async (locationId: string): Promise<Location> => {
  const { data } = await api.get(`/api/v1/locations/${locationId}`);
  return data.data || data;
};

export const getLocationsByCompanyApi = async (companyId: string): Promise<Location[]> => {
  const { data } = await api.get(`/api/v1/locations/company/${companyId}`);
  return Array.isArray(data) ? data : data.data || [];
};

export const createLocationApi = async (payload: CreateLocationPayload): Promise<Location> => {
  const { data } = await api.post("/api/v1/locations/", payload);
  return data;
};

export const updateLocationApi = async (locationId: string, payload: Partial<CreateLocationPayload>): Promise<Location> => {
  const { data } = await api.put(`/api/v1/locations/${locationId}`, payload);
  return data;
};

export const deleteLocationApi = async (locationId: string): Promise<void> => {
  await api.delete(`/api/v1/locations/${locationId}`);
};

export interface StateModel {
  id: number | string;
  name: string;
  code: string;
  country: string;
}

export const getStatesApi = async (): Promise<StateModel[]> => {
  const { data } = await api.get("/api/v1/states/");
  return Array.isArray(data) ? data : data.data || [];
};
