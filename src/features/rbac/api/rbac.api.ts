import api from "@/lib/axios";

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
}

export const getRolesApi = async (): Promise<Role[]> => {
  const { data } = await api.get("/api/v1/rbac/roles");
  const list = Array.isArray(data) ? data : data.data || [];
  return list.map((r: any) => ({
    id: String(r.id),
    name: r.role_name,
    description: r.description,
  }));
};

export const getPermissionsApi = async (): Promise<Permission[]> => {
  const { data } = await api.get("/api/v1/rbac/permissions");
  const list = Array.isArray(data) ? data : data.data || [];
  return list.map((p: any) => ({
    id: String(p.id),
    name: p.permission_name,
    description: p.description,
  }));
};

export const createRoleApi = async (name: string, description?: string): Promise<Role> => {
  const { data } = await api.post("/api/v1/rbac/roles", { role_name: name, description });
  const raw = data.data || data;
  return {
    id: String(raw.id),
    name: raw.role_name,
    description: raw.description,
  };
};

export const createPermissionApi = async (name: string, description?: string): Promise<Permission> => {
  const { data } = await api.post("/api/v1/rbac/permissions", {
    permission_name: name,
    module: name.split(".")[0] || "system",
    description,
  });
  const raw = data.data || data;
  return {
    id: String(raw.id),
    name: raw.permission_name,
    description: raw.description,
  };
};

export const deleteRoleApi = async (roleId: string): Promise<void> => {
  await api.delete(`/api/v1/rbac/roles/${roleId}`);
};

export const deletePermissionApi = async (permissionId: string): Promise<void> => {
  await api.delete(`/api/v1/rbac/permissions/${permissionId}`);
};

export const assignPermissionToRoleApi = async (roleId: string, permissionId: string): Promise<void> => {
  await api.post(`/api/v1/rbac/roles/${roleId}/permissions/${permissionId}`);
};

export const removePermissionFromRoleApi = async (roleId: string, permissionId: string): Promise<void> => {
  await api.delete(`/api/v1/rbac/roles/${roleId}/permissions/${permissionId}`);
};

export const getRolePermissionsApi = async (roleId: string): Promise<Permission[]> => {
  const { data } = await api.get(`/api/v1/rbac/roles/${roleId}/permissions`);
  const list = Array.isArray(data) ? data : data.data || [];
  return list.map((p: any) => ({
    id: String(p.id),
    name: p.permission_name,
    description: p.description,
  }));
};
