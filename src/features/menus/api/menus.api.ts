import api from "@/lib/axios";

export interface DBMenuItem {
  id: string;
  title: string;
  icon?: string;
  path?: string;
  permission_key?: string;
  parent_id?: string;
  order_index: number;
  is_active: boolean;
  children?: DBMenuItem[];
}

export const getMenuTreeApi = async (): Promise<DBMenuItem[]> => {
  const { data } = await api.get("/api/v1/menus/");
  return data.data || data;
};

export const getSidebarMenusApi = async (): Promise<DBMenuItem[]> => {
  const { data } = await api.get("/api/v1/menus/sidebar");
  return data.data || data;
};

export const createMenuItemApi = async (payload: Partial<DBMenuItem>): Promise<DBMenuItem> => {
  const { data } = await api.post("/api/v1/menus/", payload);
  return data.data || data;
};

export const updateMenuItemApi = async (menuId: string, payload: Partial<DBMenuItem>): Promise<DBMenuItem> => {
  const { data } = await api.put(`/api/v1/menus/${menuId}`, payload);
  return data.data || data;
};

export const deleteMenuItemApi = async (menuId: string): Promise<void> => {
  await api.delete(`/api/v1/menus/${menuId}`);
};
