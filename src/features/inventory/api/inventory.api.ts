import api from "@/lib/axios";

export interface InventoryField {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  required: boolean;
  options?: string[];
}

export interface InventoryTemplate {
  product_type_code: string;
  fields: InventoryField[];
}

export interface InventoryItem {
  _id: string;
  name: string;
  serial_number: string;
  product_type_code: string;
  category: string;
  attributes: Record<string, any>;
  image_base64?: string;
}

export const getTemplateApi = async (productTypeCode: string): Promise<InventoryTemplate> => {
  const { data } = await api.get(`/api/v1/inventory/templates/${productTypeCode}`);
  return data.data || data;
};

export const saveTemplateApi = async (productTypeCode: string, fields: InventoryField[]): Promise<InventoryTemplate> => {
  const { data } = await api.post("/api/v1/inventory/templates", {
    product_type_code: productTypeCode,
    fields,
  });
  return data.data || data;
};

export const getInventoryItemsApi = async (params?: { product_type_code?: string; search?: string }): Promise<InventoryItem[]> => {
  const { data } = await api.get("/api/v1/inventory/items", { params });
  return Array.isArray(data) ? data : data.data || [];
};

export const createInventoryItemApi = async (payload: {
  name: string;
  serial_number: string;
  product_type_code: string;
  category: string;
  attributes: Record<string, any>;
  image_base64?: string;
}): Promise<InventoryItem> => {
  const { data } = await api.post("/api/v1/inventory/items", payload);
  return data.data || data;
};

export const deleteInventoryItemApi = async (itemId: string): Promise<void> => {
  await api.delete(`/api/v1/inventory/items/${itemId}`);
};

export interface ProductTypeModel {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
}

export const getProductTypesApi = async (): Promise<ProductTypeModel[]> => {
  const { data } = await api.get("/api/v1/product-types/");
  return Array.isArray(data) ? data : data.data || [];
};

export const createProductTypeApi = async (payload: {
  name: string;
  code: string;
  category: string;
  description?: string;
}): Promise<ProductTypeModel> => {
  const { data } = await api.post("/api/v1/product-types/", payload);
  return data.data || data;
};

export const deleteProductTypeApi = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/product-types/${id}`);
};

export interface CategoryGroupModel {
  id: string;
  name: string;
  code: string;
}

export const getCategoryGroupsApi = async (): Promise<CategoryGroupModel[]> => {
  const { data } = await api.get("/api/v1/category-groups/");
  return Array.isArray(data) ? data : data.data || [];
};

export const createCategoryGroupApi = async (payload: {
  name: string;
  code: string;
}): Promise<CategoryGroupModel> => {
  const { data } = await api.post("/api/v1/category-groups/", payload);
  return data.data || data;
};

export const deleteCategoryGroupApi = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/category-groups/${id}`);
};


export interface CustomerTypeModel {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export const getCustomerTypesApi = async (): Promise<CustomerTypeModel[]> => {
  const { data } = await api.get("/api/v1/customer-types/");
  return Array.isArray(data) ? data : data.data || [];
};

export const createCustomerTypeApi = async (payload: {
  name: string;
  code: string;
  description?: string;
}): Promise<CustomerTypeModel> => {
  const { data } = await api.post("/api/v1/customer-types/", payload);
  return data.data || data;
};

export const deleteCustomerTypeApi = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/customer-types/${id}`);
};


export const updateInventoryItemApi = async (itemId: string, payload: {
  name: string;
  serial_number: string;
  product_type_code: string;
  category: string;
  attributes: Record<string, any>;
  image_base64?: string;
}): Promise<InventoryItem> => {
  const { data } = await api.put(`/api/v1/inventory/items/${itemId}`, payload);
  return data.data || data;
};


export const updateProductTypeApi = async (id: string, payload: {
  name: string;
  code: string;
  category: string;
  description?: string;
}): Promise<ProductTypeModel> => {
  const { data } = await api.put(`/api/v1/product-types/${id}`, payload);
  return data.data || data;
};
