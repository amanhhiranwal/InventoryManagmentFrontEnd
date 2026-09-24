"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { FiChevronDown, FiX } from "react-icons/fi";
import {
  LuBuilding2,
  LuFileText,
  LuFileUp,
  LuIdCard,
  LuMapPin,
  LuSquareUser,
} from "react-icons/lu";
import { CgSpinner } from "react-icons/cg";

import api from "@/lib/axios";
import { FormCard, FormSectionBlock } from "@/components/crm/FormCard";
import FormPageHeader, {
  CancelButton,
  DraftButton,
  SubmitButton,
} from "@/components/crm/FormPageHeader";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  CustomerPayload,
  createCustomerApi,
  getCustomerApi,
  updateCustomerApi,
} from "@/features/customers/api/customers.api";
import { getCustomerTypesApi } from "@/features/inventory/api/inventory.api";
import { getStatesApi } from "@/features/locations/api/locations.api";
import { getUsersApi, User } from "@/features/users/api/users.api";

const FALLBACK_CUSTOMER_TYPES = [
  "Distributor",
  "OEM",
  "End Customer",
  "Dealer",
  "Corporate",
  "Other",
];

const COUNTRIES = ["India", "United States", "China", "Malaysia", "Indonesia"];

/** Mobile prefixes offered next to the number, as in the design. */
const DIAL_CODES = [
  { code: "+91", flag: "🇮🇳" },
  { code: "+1", flag: "🇺🇸" },
  { code: "+86", flag: "🇨🇳" },
  { code: "+60", flag: "🇲🇾" },
  { code: "+62", flag: "🇮🇩" },
];

interface CustomerForm {
  customerType: string;
  organizationName: string;
  website: string;
  address: string;
  state: string;
  city: string;
  country: string;
  pinCode: string;
  contactName: string;
  designation: string;
  dialCode: string;
  mobile: string;
  email: string;
  leadSource: string;
  assignedToId: string;
  remarks: string;
  attachments: string[];
}

type FormErrors = Partial<Record<keyof CustomerForm, string>>;

const EMPTY_FORM: CustomerForm = {
  customerType: "",
  organizationName: "",
  website: "",
  address: "",
  state: "",
  city: "",
  country: "",
  pinCode: "",
  contactName: "",
  designation: "",
  dialCode: "+91",
  mobile: "",
  email: "",
  leadSource: "",
  assignedToId: "",
  remarks: "",
  attachments: [],
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "+91 9876543210" -> ["+91", "9876543210"]. */
function splitPhone(phone?: string): [string, string] {
  const match = (phone || "").trim().match(/^(\+\d{1,3})\s*(.*)$/);
  return match ? [match[1], match[2]] : ["+91", (phone || "").trim()];
}

function userName(user: User) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
}

/**
 * New Customer, as designed: organization, location and primary contact on
 * the left; lead source, owner, remarks and files on the right.
 *
 * "Create Lead" saves the customer and opens its lead with the chosen Lead
 * Source; "Save as Draft" keeps the customer without a lead. ?edit=<id>
 * reopens a customer.
 */
export default function CustomerFormPage() {
  const router = useRouter();
  const { addToast } = useUIStore();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [editId, setEditId] = useState<string | null>(null);
  const [convertedLeadId, setConvertedLeadId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"draft" | "lead" | "save" | null>(null);
  const [dragging, setDragging] = useState(false);

  const [customerTypes, setCustomerTypes] = useState<string[]>(FALLBACK_CUSTOMER_TYPES);
  const [states, setStates] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const isEdit = Boolean(editId);

  const update = <K extends keyof CustomerForm>(field: K, value: CustomerForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /* Read ?edit= directly so the page needs no Suspense boundary. */
  useEffect(() => {
    setEditId(new URLSearchParams(window.location.search).get("edit"));
  }, []);

  useEffect(() => {
    getCustomerTypesApi()
      .then((types) => {
        const names = types.map((type) => type.name).filter(Boolean);
        if (names.length) setCustomerTypes(names);
      })
      .catch(() => undefined);

    getStatesApi()
      .then((list) => setStates(list.map((state) => state.name).filter(Boolean)))
      .catch(() => undefined);

    api
      .get("/api/v1/lead-sources")
      .then(({ data }) =>
        setLeadSources(
          (Array.isArray(data?.data) ? data.data : [])
            .filter((source: { is_active?: boolean }) => source.is_active !== false)
            /* In the order they were set up - Marketing, Cold Calling,
               In-bound - as the design lists them. */
            .sort((a: { id: string }, b: { id: string }) => Number(a.id) - Number(b.id))
            .map((source: { name: string }) => source.name),
        ),
      )
      .catch(() => undefined);

    getUsersApi(1, 500, { skipErrorToast: true })
      .then((response) => setUsers(response.data))
      .catch(() => undefined);
  }, []);

  /* A new customer is assigned to whoever is adding it until changed. */
  useEffect(() => {
    if (!isEdit && currentUserId) {
      setForm((current) =>
        current.assignedToId ? current : { ...current, assignedToId: currentUserId },
      );
    }
  }, [isEdit, currentUserId]);

  useEffect(() => {
    if (!editId) return;

    setLoading(true);

    getCustomerApi(editId)
      .then((customer) => {
        const [dialCode, mobile] = splitPhone(customer.phone);

        setConvertedLeadId(customer.converted_lead_id ?? null);
        setForm({
          customerType: customer.customer_type || "",
          organizationName: customer.name || "",
          website: customer.website || "",
          address: customer.address || "",
          state: customer.state || "",
          city: customer.city || "",
          country: customer.country || "",
          pinCode: customer.pin_code || "",
          contactName: customer.contact_name || "",
          designation: customer.designation || "",
          dialCode,
          mobile,
          email: customer.email || "",
          leadSource: customer.lead_source || "",
          assignedToId: customer.assigned_to_id || "",
          remarks: customer.remarks || "",
          attachments: customer.attachments || [],
        });
      })
      .catch((error) => {
        console.error(error);
        addToast("Could not open this customer.", "error");
        router.push("/sales/customers");
      })
      .finally(() => setLoading(false));
  }, [editId, addToast, router]);

  /* Every field is required to open a lead, as marked in the design; a draft
     only needs a name to be found again. */
  const validate = (full: boolean) => {
    const next: FormErrors = {};
    const required = (field: keyof CustomerForm, message: string) => {
      if (!String(form[field] || "").trim()) next[field] = message;
    };

    required("organizationName", "Organization name is required.");

    if (full) {
      required("customerType", "Select the customer type.");
      required("website", "Organization website is required.");
      required("address", "Street address is required.");
      required("state", "State is required.");
      required("city", "City is required.");
      required("country", "Country is required.");
      required("pinCode", "PIN / ZIP code is required.");
      required("contactName", "Full name is required.");
      required("designation", "Designation is required.");
      required("mobile", "Mobile number is required.");
      required("email", "Email address is required.");
      required("leadSource", "Select the lead source.");
      required("assignedToId", "Select who it is assigned to.");
    }

    if (form.email.trim() && !EMAIL.test(form.email.trim()))
      next.email = "Enter a valid email address.";
    if (form.mobile.trim() && !/^[0-9]{6,14}$/.test(form.mobile.replace(/\s/g, "")))
      next.mobile = "Enter digits only, 6 to 14 long.";
    if (form.pinCode.trim() && !/^[A-Za-z0-9 -]{3,10}$/.test(form.pinCode.trim()))
      next.pinCode = "Enter a valid PIN / ZIP code.";
    if (form.website.trim() && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+.*$/.test(form.website.trim()))
      next.website = "Enter a website like www.company.com.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): CustomerPayload => ({
    name: form.organizationName.trim(),
    customer_type: form.customerType,
    website: form.website.trim(),
    address: form.address.trim(),
    state: form.state,
    city: form.city.trim(),
    country: form.country,
    pin_code: form.pinCode.trim(),
    contact_name: form.contactName.trim(),
    designation: form.designation.trim(),
    phone: form.mobile.trim() ? `${form.dialCode} ${form.mobile.replace(/\s/g, "")}` : "",
    email: form.email.trim(),
    lead_source: form.leadSource,
    assigned_to_id: form.assignedToId,
    remarks: form.remarks.trim(),
    attachments: form.attachments,
  });

  const save = async (mode: "draft" | "lead" | "save") => {
    if (!validate(mode === "lead")) {
      addToast("Please fill in the highlighted fields.", "warning");
      return;
    }

    const payload: CustomerPayload = {
      ...buildPayload(),
      create_lead: mode === "lead",
      draft: mode === "draft",
    };

    try {
      setSaving(mode);

      const saved = editId
        ? await updateCustomerApi(editId, payload)
        : await createCustomerApi(payload);

      addToast(
        saved.lead_id
          ? `${saved.name} saved and Lead #${saved.lead_id} created.`
          : mode === "draft"
            ? `${saved.name} saved as a draft.`
            : `${saved.name} saved.`,
        "success",
      );

      router.push("/sales/customers");
    } catch (error) {
      console.error(error);
      const detail = (error as AxiosError<{ detail?: string }>).response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not save the customer.", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    save(convertedLeadId ? "save" : "lead");
  };

  /* Only the names are kept - there is no file store behind the form yet,
     the same as the lead form's attachments. */
  const addFiles = (files: FileList | null) => {
    const accepted = Array.from(files || []).filter((file) => {
      const ok = /\.(pdf|docx?|xlsx?)$/i.test(file.name) && file.size <= 10 * 1024 * 1024;
      if (!ok) addToast(`${file.name}: PDF, DOC or XLS up to 10MB only.`, "warning");
      return ok;
    });

    if (accepted.length) {
      update("attachments", [
        ...form.attachments,
        ...accepted.map((file) => file.name).filter((name) => !form.attachments.includes(name)),
      ]);
    }
  };

  const title = isEdit ? "Edit Customer" : "New Customer";

  return (
    <div className="min-h-full pb-8">
      <FormPageHeader
        title={title}
        parentLabel="Customers"
        currentLabel={isEdit ? "Edit" : "New"}
        badge={isEdit && convertedLeadId ? "" : "Draft"}
        actions={
          <>
            <CancelButton onClick={() => router.push("/sales/customers")} />

            {convertedLeadId ? (
              <SubmitButton formId="customer-form" disabled={Boolean(saving) || loading}>
                {saving === "save" ? "Saving..." : "Save Changes"}
              </SubmitButton>
            ) : (
              <>
                <DraftButton disabled={Boolean(saving) || loading} onClick={() => save("draft")}>
                  {saving === "draft" ? "Saving..." : "Save as Draft"}
                </DraftButton>

                <SubmitButton formId="customer-form" disabled={Boolean(saving) || loading}>
                  {saving === "lead" ? "Creating..." : "Create Lead"}
                </SubmitButton>
              </>
            )}
          </>
        }
      />

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-white text-slate-400 dark:bg-[#071929]">
          <CgSpinner className="animate-spin text-3xl" />
        </div>
      ) : (
        <form
          id="customer-form"
          noValidate
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_372px]"
        >
          {/* LEFT */}
          <FormCard>
            <FormSectionBlock first icon={<LuBuilding2 />} title="Organization Details">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Customer Type"
                  required
                  placeholder="Select the customer type"
                  value={form.customerType}
                  options={customerTypes}
                  error={errors.customerType}
                  onChange={(value) => update("customerType", value)}
                />

                <TextField
                  label="Organization Name"
                  required
                  placeholder="Enter name here"
                  value={form.organizationName}
                  error={errors.organizationName}
                  onChange={(value) => update("organizationName", value)}
                />

                <div className="md:col-span-2">
                  <TextField
                    label="Organization Website"
                    required
                    placeholder="www.company.com"
                    value={form.website}
                    error={errors.website}
                    onChange={(value) => update("website", value)}
                  />
                </div>
              </div>
            </FormSectionBlock>

            <FormSectionBlock icon={<LuMapPin />} title="Location Information">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField
                  label="Street Address"
                  required
                  placeholder="Street Address, Building, Suite"
                  value={form.address}
                  error={errors.address}
                  onChange={(value) => update("address", value)}
                />

                <TextField
                  label="State / Province"
                  required
                  placeholder="State"
                  list="customer-states"
                  value={form.state}
                  error={errors.state}
                  onChange={(value) => update("state", value)}
                />
                <datalist id="customer-states">
                  {states.map((state) => (
                    <option key={state} value={state} />
                  ))}
                </datalist>

                <TextField
                  label="City"
                  required
                  placeholder="Type or select"
                  value={form.city}
                  error={errors.city}
                  onChange={(value) => update("city", value)}
                />

                <SelectField
                  label="Country"
                  required
                  placeholder="Select here"
                  value={form.country}
                  options={COUNTRIES}
                  error={errors.country}
                  onChange={(value) => update("country", value)}
                />

                <div className="md:col-span-2">
                  <TextField
                    label="PIN / ZIP Code"
                    required
                    placeholder="Pin Code"
                    value={form.pinCode}
                    error={errors.pinCode}
                    onChange={(value) => update("pinCode", value)}
                  />
                </div>
              </div>
            </FormSectionBlock>

            <FormSectionBlock icon={<LuIdCard />} title="Primary Contact">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField
                  label="Full Name"
                  required
                  placeholder="Enter full name"
                  value={form.contactName}
                  error={errors.contactName}
                  onChange={(value) => update("contactName", value)}
                />

                <TextField
                  label="Designation"
                  required
                  placeholder="e.g. Procurement Manager"
                  value={form.designation}
                  error={errors.designation}
                  onChange={(value) => update("designation", value)}
                />

                <div>
                  <label className="mb-1.5 block">
                    Mobile Number<span className="ml-0.5">*</span>
                  </label>

                  <div className="flex gap-2">
                    <div className="relative w-[92px] shrink-0">
                      <select
                        value={form.dialCode}
                        onChange={(event) => update("dialCode", event.target.value)}
                        aria-label="Country code"
                        className="w-full appearance-none border bg-white pl-2.5 pr-6 outline-none focus:border-[#233353] dark:bg-[#071929]"
                      >
                        {DIAL_CODES.map((dial) => (
                          <option key={dial.code} value={dial.code}>
                            {dial.flag} {dial.code}
                          </option>
                        ))}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#141414] dark:text-slate-400" />
                    </div>

                    <input
                      inputMode="numeric"
                      value={form.mobile}
                      placeholder="XXXXXXXXXX"
                      onChange={(event) => update("mobile", event.target.value.replace(/[^0-9 ]/g, ""))}
                      aria-invalid={Boolean(errors.mobile)}
                      className={`min-w-0 flex-1 border bg-white px-3 outline-none focus:border-[#233353] dark:bg-[#071929] ${
                        errors.mobile ? "!border-rose-400" : ""
                      }`}
                    />
                  </div>

                  {errors.mobile && <p className="mt-1 text-[11px] text-rose-500">{errors.mobile}</p>}
                </div>

                <TextField
                  label="Email Address"
                  required
                  type="email"
                  placeholder="Enter email address"
                  value={form.email}
                  error={errors.email}
                  onChange={(value) => update("email", value)}
                />
              </div>
            </FormSectionBlock>
          </FormCard>

          {/* RIGHT */}
          <FormCard className="h-fit">
            <FormSectionBlock first icon={<LuSquareUser />} title="Sales Information">
              <div className="space-y-4">
                <SelectField
                  label="Lead Source"
                  required
                  placeholder="Select here"
                  value={form.leadSource}
                  options={leadSources}
                  error={errors.leadSource}
                  onChange={(value) => update("leadSource", value)}
                />

                <div>
                  <label className="mb-1.5 block">
                    Assigned to<span className="ml-0.5">*</span>
                  </label>

                  <div className="relative">
                    <select
                      value={form.assignedToId}
                      onChange={(event) => update("assignedToId", event.target.value)}
                      aria-invalid={Boolean(errors.assignedToId)}
                      className={`w-full appearance-none border bg-white px-3 pr-9 outline-none focus:border-[#233353] dark:bg-[#071929] ${
                        errors.assignedToId ? "!border-rose-400" : ""
                      }`}
                    >
                      <option value="">Select here</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {userName(user)}
                        </option>
                      ))}
                    </select>

                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#141414] dark:text-slate-400" />
                  </div>

                  {errors.assignedToId && (
                    <p className="mt-1 text-[11px] text-rose-500">{errors.assignedToId}</p>
                  )}
                </div>
              </div>
            </FormSectionBlock>

            <FormSectionBlock icon={<LuFileText />} title="Requirements & Files">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block">Remarks</label>
                  <textarea
                    rows={5}
                    value={form.remarks}
                    onChange={(event) => update("remarks", event.target.value)}
                    placeholder="Enter specific hardware requirements or customization requests..."
                    className="w-full resize-none border p-3 outline-none focus:border-[#233353]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block">Attachments</label>

                  <label
                    onDragOver={(event) => event.preventDefault()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event: DragEvent<HTMLLabelElement>) => {
                      event.preventDefault();
                      setDragging(false);
                      addFiles(event.dataTransfer.files);
                    }}
                    className={`flex min-h-[112px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition ${
                      dragging
                        ? "border-[#233353] bg-[#233353]/5"
                        : "border-[#bdbdbd] hover:bg-slate-50 dark:border-[#17304a] dark:hover:bg-[#0b2034]"
                    }`}
                  >
                    <LuFileUp className="mb-2 text-[18px] text-[#777777]" />
                    <span className="text-[12px] text-[#777777]">Drop files or click to upload</span>
                    <span className="mt-0.5 text-[10px] text-[#a9a9a9]">PDF, DOC, XLS up to 10MB</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>

                  {form.attachments.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {form.attachments.map((name) => (
                        <li
                          key={name}
                          className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 dark:bg-[#0b2034] dark:text-slate-300"
                        >
                          <span className="truncate">{name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${name}`}
                            onClick={() =>
                              update(
                                "attachments",
                                form.attachments.filter((item) => item !== name),
                              )
                            }
                            className="shrink-0 text-slate-400 hover:text-rose-500"
                          >
                            <FiX size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </FormSectionBlock>
          </FormCard>
        </form>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
  error,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  error?: string;
  list?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block">
        {label}
        {required && <span className="ml-0.5">*</span>}
      </label>

      <input
        type={type}
        list={list}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`w-full border bg-white px-3 outline-none focus:border-[#233353] dark:bg-[#071929] ${
          error ? "!border-rose-400" : ""
        }`}
      />

      {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  /* Keep a stored value selectable even if it is not in today's list. */
  const choices = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <div>
      <label className="mb-1.5 block">
        {label}
        {required && <span className="ml-0.5">*</span>}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className={`w-full appearance-none border bg-white px-3 pr-9 outline-none focus:border-[#233353] dark:bg-[#071929] ${
            value ? "" : "!text-[#a9a9a9]"
          } ${error ? "!border-rose-400" : ""}`}
        >
          <option value="">{placeholder || `Select ${label}`}</option>
          {choices.map((option) => (
            <option key={option} value={option} className="text-[#141414]">
              {option}
            </option>
          ))}
        </select>

        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#141414] dark:text-slate-400" />
      </div>

      {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}
