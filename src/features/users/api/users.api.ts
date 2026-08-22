import api from "@/lib/axios";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  employee_id?: string;
  role_id?: string;
  role_ids?: string[];
  company_ids?: string[];
  is_super_admin: boolean;
}

export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  password?: string;
  phone_number?: string;
  employee_id?: string;
  role_ids?: string[];
  company_ids?: string[];
}

export const getUsersApi = async (page: number = 1, size: number = 20, options?: { skipErrorToast?: boolean }): Promise<{ data: User[]; total: number }> => {
  const { data } = await api.get("/api/v1/users/", { params: { page, size }, skipErrorToast: options?.skipErrorToast });
  return {
    data: data.data || [],
    total: data.total || 0,
  };
};

export const createUserApi = async (payload: CreateUserPayload): Promise<User> => {
  const { data } = await api.post("/api/v1/users/", payload);
  return data.data || data;
};

export const updateUserRoleApi = async (userId: string, roleIds: string[], companyIds: string[]): Promise<User> => {
  const { data } = await api.put(`/api/v1/users/${userId}/role`, { role_ids: roleIds, company_ids: companyIds });
  return data.data || data;
};

export const deleteUserApi = async (userId: string): Promise<void> => {
  await api.delete(`/api/v1/users/${userId}`);
};

export const updateUserApi = async (userId: string, payload: Partial<CreateUserPayload>): Promise<User> => {
  const { data } = await api.put(`/api/v1/users/${userId}`, payload);
  return data.data || data;
};
