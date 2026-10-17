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
  serial_numbers?: string[];
  serials_count?: number;
  item_ids?: string[];
  product_type_code: string;
  category: string;
  attributes: Record<string, any>;
  image_base64?: string;
  has_image?: boolean;
  /** The company that stocks this product. Null means every company. */
  company_id?: string | null;
  company_name?: string | null;
}

/** A company a product may be filed under - those on the user's profile,
    or every company for a super admin. */
export interface ScopeCompany {
  id: string;
  company_name: string;
}

export const getInventoryCompaniesApi = async (): Promise<{
  companies: ScopeCompany[];
  unrestricted: boolean;
}> => {
  const { data } = await api.get("/api/v1/inventory/companies");
  return {
    companies: Array.isArray(data?.data) ? data.data : [],
    unrestricted: data?.unrestricted === true,
  };
};

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

/** The figures across the top, worked out by the server over the whole
    catalogue rather than over the page on screen. */
export interface InventorySummary {
  products: number;
  units: number;
  value: number;
  thin: number;
  out: number;
  categories: number;
}

export interface InventoryPage {
  items: InventoryItem[];
  /** Products matching the search and company, before the category tab. */
  total: number;
  summary: InventorySummary;
  /** product_type_code -> how many, for the category tabs. */
  counts: Record<string, number>;
}

export const getInventoryItemsApi = async (params?: {
  product_type_code?: string;
  search?: string;
  company_id?: string;
  page?: number;
  size?: number;
}): Promise<InventoryPage> => {
  const { data } = await api.get("/api/v1/inventory/items", { params });

  const items = Array.isArray(data) ? data : data.data || [];

  return {
    items,
    total: Number(data?.total ?? items.length),
    summary: data?.summary || {
      products: items.length,
      units: 0,
      value: 0,
      thin: 0,
      out: 0,
      categories: 0,
    },
    counts: data?.counts || {},
  };
};

/** One product's picture. Kept off the list, which carries a thousand
    rows and would otherwise carry a thousand data: URIs with them. */
export const getInventoryImageApi = async (
  itemId: string,
): Promise<string | null> => {
  const { data } = await api.get(`/api/v1/inventory/items/${itemId}/image`);
  return data?.data || null;
};

export const createInventoryItemApi = async (payload: {
  name: string;
  serial_number: string;
  product_type_code: string;
  category: string;
  attributes: Record<string, any>;
  image_base64?: string;
  company_id?: string | null;
}): Promise<InventoryItem> => {
  const { data } = await api.post("/api/v1/inventory/items", payload);
  return data.data || data;
};

export const deleteInventoryItemApi = async (itemId: string, allUnits: boolean = true): Promise<void> => {
  await api.delete(`/api/v1/inventory/items/${itemId}?all_units=${allUnits ? "true" : "false"}`);
};

/* ----------------------------------------------------------------------
   Loading a sheet of products

   The same call answers both questions the screen asks: "what would this
   file do" and "do it". Only the commit flag differs, so what was shown
   and what is saved are read from the file the same way.
---------------------------------------------------------------------- */

/** One product a sheet would create, as the preview lists it. */
export interface BulkUploadItem {
  /** The row of the sheet it came from - several products can share one. */
  row: number;
  name: string;
  serial_number: string;
  product_type_code: string;
  category: string;
  company_name?: string | null;
  model_number?: string;
  unit?: string;
  rate?: number;
  dtp_rate?: number;
  instock?: number;
  case_size?: number;
  hsn_code?: string;
}

export interface BulkUploadResult {
  /** Rows read from the sheet. */
  rows: number;
  /** Products those rows describe - more than rows, with serials split. */
  products: number;
  created: number;
  committed: boolean;
  /** Everything wrong with the sheet. Any at all and nothing was saved. */
  errors: string[];
  items: BulkUploadItem[];
  message: string;
}

export const bulkUploadInventoryApi = async (
  file: File,
  commit: boolean,
): Promise<BulkUploadResult> => {
  const form = new FormData();
  form.append("file", file);

  const { data } = await api.post(
    `/api/v1/inventory/items/bulk?commit=${commit ? "true" : "false"}`,
    form,
  );

  return { ...(data.data || {}), message: data.message || "" };
};

/** The blank sheet, built from today's masters, straight to Downloads. */
export const downloadBulkTemplateApi = async (): Promise<void> => {
  const { data } = await api.get("/api/v1/inventory/items/bulk/template", {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");

  link.href = url;
  link.download = "Inventory_Upload_Template.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
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
  id: number | string;
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
  /** Left out keeps the picture the product has; null clears it. */
  image_base64?: string | null;
  company_id?: string | null;
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
