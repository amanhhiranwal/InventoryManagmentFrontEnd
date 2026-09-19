import api from "@/lib/axios";

/** One spreadsheet row, mapped from its column headers. */
export interface CustomerImportRow {
  name?: string;
  contact_name?: string;
  designation?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  gst?: string;
  pan?: string;
  customer_type?: string;
  category?: string;
  status?: string;
  assigned_to?: string;
}

export interface CustomerImportResult {
  created: number;
  total: number;
  /** Rows that were not created, with their sheet row number and why. */
  skipped: { row: number; name: string; reason: string }[];
}

export const importCustomersApi = async (
  customers: CustomerImportRow[],
): Promise<CustomerImportResult> => {
  const { data } = await api.post("/api/v1/customers/bulk", { customers });
  return data.data;
};
