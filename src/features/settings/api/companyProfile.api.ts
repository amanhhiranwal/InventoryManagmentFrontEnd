import api from "@/lib/axios";

/* =========================================================
   COMPANY PROFILE

   Who the proposals and emails come from. Held in the database and edited
   from the Company Profile screen, so it can be changed without touching
   the deployment's environment.
========================================================= */

export interface CompanyProfile {
  company_legal_name: string;
  company_address: string;
  company_gstin: string;
  company_website: string;
  company_email: string;
  company_phone: string;
  company_about: string;
  company_offerings: string;
  company_logo_path: string;
  company_cover_image: string;
  signatory_name: string;
  signatory_title: string;

  /** The multi-line fields, already split by the backend. */
  company_address_lines: string[];
  company_about_paragraphs: string[];
  company_offering_list: string[];
}

export type CompanyProfilePayload = Partial<
  Omit<
    CompanyProfile,
    "company_address_lines" | "company_about_paragraphs" | "company_offering_list"
  >
>;

export const getCompanyProfileApi = async (): Promise<CompanyProfile> => {
  const { data } = await api.get("/api/v1/company-profile");
  return data.data;
};

export const saveCompanyProfileApi = async (
  payload: CompanyProfilePayload,
): Promise<CompanyProfile> => {
  const { data } = await api.put("/api/v1/company-profile", payload);
  return data.data;
};

export const uploadCompanyLogoApi = async (
  file: File,
): Promise<CompanyProfile> => {
  const form = new FormData();
  form.append("file", file);

  const { data } = await api.post("/api/v1/company-profile/logo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};
