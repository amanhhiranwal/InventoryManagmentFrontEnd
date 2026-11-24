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
  /** WAREHOUSE holds stock and has bins; OFFICE does not. Older rows may be null, which means a warehouse. */
  location_type?: LocationType | null;
  is_default?: boolean;
  is_active?: boolean;
}

export type LocationType = "WAREHOUSE" | "OFFICE";

export const locationTypeOf = (loc: Pick<Location, "location_type">): LocationType =>
  loc.location_type === "OFFICE" ? "OFFICE" : "WAREHOUSE";

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
  location_type?: LocationType;
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

export type BinType = "STORE" | "QC" | "REJECT";

export interface WarehouseBin {
  id: string;
  warehouse_id: string;
  code: string;
  name: string;
  bin_type: BinType;
  zone?: string | null;
  rack?: string | null;
  shelf?: string | null;
  is_active: boolean;
}

export interface BinPayload {
  code?: string;
  name?: string;
  bin_type?: BinType;
  zone?: string | null;
  rack?: string | null;
  shelf?: string | null;
  is_active?: boolean;
}

export const getBinsApi = async (locationId: string): Promise<WarehouseBin[]> => {
  const { data } = await api.get(`/api/v1/locations/${locationId}/bins`);
  return data.data || [];
};

export const createBinApi = async (locationId: string, payload: BinPayload): Promise<WarehouseBin> => {
  const { data } = await api.post(`/api/v1/locations/${locationId}/bins`, payload);
  return data.data;
};

export const updateBinApi = async (locationId: string, binId: string, payload: BinPayload): Promise<WarehouseBin> => {
  const { data } = await api.put(`/api/v1/locations/${locationId}/bins/${binId}`, payload);
  return data.data;
};

/** A warehouse the signed-in user may work in. */
export interface MyWarehouse {
  id: string;
  location_name: string;
  location_code: string;
  company_id: string;
  company_name?: string | null;
  city?: string | null;
  state?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

export const getMyWarehousesApi = async (companyId?: string): Promise<MyWarehouse[]> => {
  const { data } = await api.get("/api/v1/locations/warehouses/mine", {
    params: companyId ? { company_id: companyId } : undefined,
  });
  return data.data || [];
};
