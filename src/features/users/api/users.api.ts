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
  /** Role names in the same order as role_ids, for labels. */
  role_names?: string[];
  company_ids?: string[];
  is_super_admin: boolean;
  /** The manager this user reports to. */
  reports_to_id?: string | null;
  reports_to_name?: string | null;
  /** Where they are based, as the staffing sheet records it. */
  location?: string;
  /** Off means the password stops working and any live session ends. */
  is_active?: boolean;
  /** When the account was opened, ISO-8601. */
  created_at?: string | null;
  /** When the super admin sent the one-time welcome email; null until then. */
  welcome_email_sent_at?: string | null;
  /** Masters > Departments; fills the purchase requisition form. */
  department_id?: number | null;
  /** Their job title as HR writes it. Shown, never used for access. */
  designation?: string | null;
  /** Managers they also report to, beside reports_to_id. */
  also_reports_to_ids?: string[];
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
  reports_to_id?: string | null;
  /** Where they are based, as the staffing sheet records it. */
  location?: string;
  department_id?: number | null;
  designation?: string | null;
  also_reports_to_ids?: string[];
}

/** One sheet row, as Users > Bulk Upload would or did handle it. */
export interface UserImportRow {
  row: number;
  employee_id: string;
  name: string;
  email: string;
  action: "create" | "update" | "deactivate" | "skip" | "error";
  role: string;
  department: string;
  designation: string;
  changes: string[];
  issues: string[];
}

export interface UserImportResult {
  applied: boolean;
  counts: Partial<Record<UserImportRow["action"], number>>;
  rows: UserImportRow[];
  notes: string[];
  message: string;
}

export interface UserImportOptions {
  /** New people get @mailinator.com logins; nobody's email on file changes. */
  testEmails: boolean;
  /** Email each new person their sign-in. */
  sendWelcome: boolean;
  /** One starting password for everybody new; they change it at first sign-in. */
  startPassword?: string;
}

/** Read a sheet of people: without commit it only says what it would do. */
export const importUsersApi = async (
  file: File,
  commit: boolean,
  options: UserImportOptions,
): Promise<UserImportResult> => {
  const form = new FormData();
  form.append("file", file);
  form.append("commit", String(commit));
  form.append("test_emails", String(options.testEmails));
  form.append("send_welcome", String(options.sendWelcome));
  if (options.startPassword) form.append("start_password", options.startPassword);

  const { data } = await api.post("/api/v1/users/import", form);
  return { ...(data.data || {}), message: data.message || "" };
};

/** The columns the upload reads, with an example row, to Downloads. */
export const downloadUserTemplateApi = async (): Promise<void> => {
  const { data } = await api.get("/api/v1/users/import/template", { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = "User_Upload_Template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getUsersApi = async (
  page: number = 1,
  size: number = 20,
  options?: {
    skipErrorToast?: boolean;
    /** Narrows every user this person can see, not the page on screen. */
    search?: string;
  },
): Promise<{ data: User[]; total: number }> => {
  const search = options?.search?.trim();

  const { data } = await api.get("/api/v1/users/", {
    params: { page, size, ...(search ? { search } : {}) },
    skipErrorToast: options?.skipErrorToast,
  });
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
