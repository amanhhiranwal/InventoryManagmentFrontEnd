"use client";

/* The vendor master form, for a new vendor and for editing one. Vendors
 * are entered by the procurement team; there is no vendor self-service.
 * Formats (mobile, email, PIN, GSTIN, PAN, IFSC) are checked again on the
 * server, and changing bank or GST details there sends the vendor back
 * through verification. */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FiBriefcase, FiCreditCard, FiFileText, FiUpload, FiUser } from "react-icons/fi";

import { FormCard, FormSectionBlock } from "@/components/crm/FormCard";
import FormPageHeader, { CancelButton, DraftButton, SubmitButton } from "@/components/crm/FormPageHeader";
import { AttachmentList } from "@/features/attachments/AttachmentList";
import { ATTACHMENT_ACCEPT, uploadAttachment, type StoredAttachment } from "@/features/attachments/attachments.api";
import { useUIStore } from "@/lib/store/ui.store";

import { saveVendorApi, type Vendor } from "../api/procurement.api";
import { AttachmentsField } from "./shared";

const LABEL = "mb-1.5 block";
const FIELD = "w-full rounded-lg border bg-white px-3 outline-none focus:border-[#233353] dark:bg-[#071929]";
const AREA = "w-full rounded-lg border px-3 py-2 outline-none focus:border-[#233353]";

const VENDOR_TYPES = ["Manufacturer", "Distributor", "Dealer", "Service Provider", "Contractor", "Other"];

type Docs = Vendor["documents"];
type SingleDoc = "gst" | "pan" | "bank" | "msme";

const TEXT_FIELDS = [
  "name", "vendor_type", "contact_person", "designation", "mobile", "email", "address", "city", "state",
  "pin_code", "gstin", "pan", "bank_name", "account_holder", "account_number", "ifsc", "branch",
  "payment_terms", "credit_days", "freight_terms", "lead_time_days", "warranty_terms", "remarks",
] as const;

type Form = Record<(typeof TEXT_FIELDS)[number], string> & { product_categories: string; brands: string };

const fromVendor = (v?: Vendor | null): Form => {
  const form = {} as Form;
  TEXT_FIELDS.forEach((key) => {
    const value = v?.[key as keyof Vendor];
    form[key] = value === null || value === undefined ? "" : String(value);
  });
  form.vendor_type = form.vendor_type || "Distributor";
  form.product_categories = (v?.product_categories || []).join(", ");
  form.brands = (v?.brands || []).join(", ");
  return form;
};

const list = (value: string) => value.split(",").map((s) => s.trim()).filter(Boolean);

function DocSlot({ label, file, onChange }: { label: string; file?: StoredAttachment; onChange: (f?: StoredAttachment) => void }) {
  const { addToast } = useUIStore();
  const input = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (files: FileList | null) => {
    const chosen = files?.[0];
    if (!chosen) return;
    setUploading(true);
    try {
      onChange(await uploadAttachment(chosen));
    } catch (failure) {
      addToast(
        (failure as { response?: { data?: { detail?: string } } })?.response?.data?.detail || `${chosen.name} could not be uploaded.`,
        "error",
      );
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] text-[#777777]">{label}</span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-[12px] font-medium text-[#233353] hover:underline disabled:opacity-50 dark:text-sky-300"
        >
          <FiUpload size={11} /> {file ? "Replace" : "Upload"}
        </button>
        <input ref={input} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" aria-label={`Upload ${label}`} onChange={(e) => pick(e.target.files)} />
      </div>
      <AttachmentList
        files={file ? [file] : []}
        uploadingCount={uploading ? 1 : 0}
        onRemove={() => onChange(undefined)}
        empty="Not uploaded."
      />
    </div>
  );
}

export default function VendorForm({ existing }: { existing?: Vendor | null }) {
  const router = useRouter();
  const { addToast } = useUIStore();
  const [form, setForm] = useState<Form>(() => fromVendor(existing));
  const [docs, setDocs] = useState<Docs>(existing?.documents || {});
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

  const set = (key: keyof Form, value: string) => setForm((c) => ({ ...c, [key]: value }));
  const setDoc = (key: SingleDoc, file?: StoredAttachment) =>
    setDocs((c) => {
      const next = { ...c };
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });

  const save = async (submit: boolean) => {
    if (!form.name.trim()) return addToast("Enter the vendor's name.", "error");
    const payload = {
      ...form,
      credit_days: form.credit_days === "" ? null : Number(form.credit_days),
      lead_time_days: form.lead_time_days === "" ? null : Number(form.lead_time_days),
      product_categories: list(form.product_categories),
      brands: list(form.brands),
      documents: docs,
      status: !existing && submit ? "PENDING_VERIFICATION" : undefined,
    };
    setSaving(submit ? "submit" : "draft");
    try {
      const answer = await saveVendorApi(payload, existing?.id);
      addToast(answer.message || "Vendor saved.", "success");
      router.push(`/procurement/vendors/${answer.data.id}`);
    } catch {
      /* reported by the API client; the form keeps its input */
    } finally {
      setSaving(null);
    }
  };

  const input = (key: keyof Form, label: string, props: Record<string, unknown> = {}) => (
    <div>
      <label className={LABEL} htmlFor={`v-${key}`}>{label}</label>
      <input id={`v-${key}`} className={FIELD} value={form[key]} onChange={(e) => set(key, e.target.value)} {...props} />
    </div>
  );

  return (
    <div className="space-y-5 pb-8">
      <FormPageHeader
        title={existing ? `Edit ${existing.name}` : "New Vendor"}
        parentLabel="Vendors"
        currentLabel={existing ? existing.vendor_code : "New"}
        badge={existing ? "" : "Draft"}
        actions={
          <>
            <CancelButton onClick={() => router.push(existing ? `/procurement/vendors/${existing.id}` : "/procurement/vendors")} />
            {existing ? (
              <SubmitButton onClick={() => save(false)} disabled={saving !== null}>{saving ? "Saving..." : "Save Vendor"}</SubmitButton>
            ) : (
              <>
                <DraftButton onClick={() => save(false)} disabled={saving !== null}>{saving === "draft" ? "Saving..." : "Save as Draft"}</DraftButton>
                <SubmitButton withIcon onClick={() => save(true)} disabled={saving !== null}>
                  {saving === "submit" ? "Submitting..." : "Submit for Verification"}
                </SubmitButton>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FormCard>
          <FormSectionBlock first icon={<FiBriefcase />} title="Vendor">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">{input("name", "Vendor Name *")}</div>
              <div>
                <label className={LABEL} htmlFor="v-vendor_type">Vendor Type</label>
                <select id="v-vendor_type" className={FIELD} value={form.vendor_type} onChange={(e) => set("vendor_type", e.target.value)}>
                  {VENDOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">{input("product_categories", "Product Categories (comma separated)")}</div>
              <div className="sm:col-span-2 lg:col-span-3">{input("brands", "Brands (comma separated)")}</div>
            </div>
          </FormSectionBlock>

          <FormSectionBlock icon={<FiUser />} title="Contact and Address">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {input("contact_person", "Contact Person")}
              {input("designation", "Designation")}
              {input("mobile", "Mobile", { inputMode: "tel" })}
              {input("email", "Email", { type: "email" })}
              <div className="sm:col-span-2">{input("address", "Address")}</div>
              {input("city", "City")}
              {input("state", "State")}
              {input("pin_code", "PIN Code", { inputMode: "numeric" })}
            </div>
          </FormSectionBlock>

          <FormSectionBlock icon={<FiCreditCard />} title="Tax and Bank">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {input("gstin", "GSTIN")}
              {input("pan", "PAN")}
              {input("bank_name", "Bank Name")}
              {input("account_holder", "Account Holder")}
              {input("account_number", "Account Number", { inputMode: "numeric", autoComplete: "off" })}
              {input("ifsc", "IFSC")}
              {input("branch", "Branch")}
            </div>
            {existing && (
              <p className="mt-3 text-[11px] text-amber-700">Changing GSTIN or bank details sends the vendor back for verification.</p>
            )}
          </FormSectionBlock>

          <FormSectionBlock icon={<FiFileText />} title="Commercial Terms">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {input("payment_terms", "Payment Terms")}
              {input("credit_days", "Credit Days", { type: "number", min: 0 })}
              {input("lead_time_days", "Delivery Lead Time (days)", { type: "number", min: 0 })}
              {input("freight_terms", "Freight Terms")}
              <div className="sm:col-span-2">{input("warranty_terms", "Warranty Terms")}</div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={LABEL} htmlFor="v-remarks">Remarks</label>
                <textarea id="v-remarks" rows={2} className={AREA} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
              </div>
            </div>
          </FormSectionBlock>
        </FormCard>

        <div className="space-y-5 xl:sticky xl:top-[var(--form-header-offset,0px)] xl:self-start">
          <FormCard>
            <p className="mb-3 text-[13px] font-medium text-[#474747] dark:text-white">Documents</p>
            <p className="mb-3 text-[11px] text-[#999999]">GST, PAN and bank proof are needed before the vendor can be verified.</p>
            <div className="space-y-4">
              <DocSlot label="GST Certificate" file={docs.gst} onChange={(f) => setDoc("gst", f)} />
              <DocSlot label="PAN Card" file={docs.pan} onChange={(f) => setDoc("pan", f)} />
              <DocSlot label="Cancelled Cheque / Bank Proof" file={docs.bank} onChange={(f) => setDoc("bank", f)} />
              <DocSlot label="MSME Certificate" file={docs.msme} onChange={(f) => setDoc("msme", f)} />
              <AttachmentsField label="Other Documents" value={docs.other || []} onChange={(other) => setDocs((c) => ({ ...c, other }))} />
            </div>
          </FormCard>
        </div>
      </div>
    </div>
  );
}
