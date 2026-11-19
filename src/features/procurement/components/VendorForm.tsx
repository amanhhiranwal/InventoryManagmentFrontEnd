"use client";

/* The vendor master form, for a new vendor and for editing one. Vendors
 * are entered by the procurement team; there is no vendor self-service.
 * Formats (mobile, email, PIN, GSTIN, PAN, IFSC) are checked again on the
 * server, and changing bank or GST details there sends the vendor back
 * through verification. */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiBriefcase, FiCheckCircle, FiCreditCard, FiFileText, FiPercent, FiUpload, FiUser, FiX } from "react-icons/fi";

import { FormCard, FormSectionBlock } from "@/components/crm/FormCard";
import FormPageHeader, { CancelButton, DraftButton, SubmitButton } from "@/components/crm/FormPageHeader";
import { AttachmentList } from "@/features/attachments/AttachmentList";
import { ATTACHMENT_ACCEPT, uploadAttachment, type StoredAttachment } from "@/features/attachments/attachments.api";
import { gstinError } from "@/lib/fieldChecks";
import { useUIStore } from "@/lib/store/ui.store";

import {
  errorDetail,
  getProductCategoriesApi,
  lookupIfscApi,
  saveVendorApi,
  verifyGstinApi,
  type GstinCheck,
  type IfscBranch,
  type Vendor,
} from "../api/procurement.api";
import { AttachmentsField } from "./shared";

const LABEL = "mb-1.5 block";
const FIELD = "w-full rounded-lg border bg-white px-3 outline-none focus:border-[#233353] dark:bg-[#071929]";
const AREA = "w-full rounded-lg border px-3 py-2 outline-none focus:border-[#233353]";

/** An IFSC: four letters for the bank, a 0, then six for the branch. The
    server checks the same (vendors.IFSC). */
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** The bank details the IFSC lookup fills in. */
const LOOKUP_FIELDS = ["bank_name", "branch", "bank_address", "micr"] as const;
type LookupField = (typeof LOOKUP_FIELDS)[number];

/** The lookup's answer as form values. The bank address takes the city
    and state too when the branch's own address does not already say them. */
const fromLookup = (found: IfscBranch): Record<LookupField, string> => {
  const address = found.address.trim();
  const upper = address.toUpperCase();
  const extra = [found.city, found.state].filter((part) => part && !upper.includes(part.toUpperCase()));
  return {
    bank_name: found.bank,
    branch: found.branch,
    bank_address: [address, ...extra].filter(Boolean).join(", "),
    micr: /^\d{9}$/.test(found.micr) ? found.micr : "",
  };
};

/** A vendor's bank account: current, cash credit or overdraft. */
const ACCOUNT_TYPES = [
  { value: "Current", label: "Current" },
  { value: "CC", label: "CC (Cash Credit)" },
  { value: "OD", label: "OD (Overdraft)" },
];

const VENDOR_TYPES = ["Manufacturer", "Distributor", "Dealer", "Service Provider", "Contractor", "Other"];

type Docs = Vendor["documents"];
type SingleDoc = "gst" | "pan" | "bank" | "msme";

const TEXT_FIELDS = [
  "name", "vendor_type", "contact_person", "designation", "mobile", "email", "address", "city", "state",
  "pin_code", "gstin", "pan", "bank_name", "account_holder", "account_number", "ifsc", "branch",
  "bank_address", "account_type", "micr",
  "payment_terms", "credit_days", "freight_terms", "lead_time_days", "warranty_terms", "remarks",
] as const;

type Form = Record<(typeof TEXT_FIELDS)[number], string> & { product_categories: string[]; brands: string };

const fromVendor = (v?: Vendor | null): Form => {
  const form = {} as Form;
  TEXT_FIELDS.forEach((key) => {
    const value = v?.[key as keyof Vendor];
    form[key] = value === null || value === undefined ? "" : String(value);
  });
  form.vendor_type = form.vendor_type || "Distributor";
  form.product_categories = [...(v?.product_categories || [])];
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

  const set = (key: Exclude<keyof Form, "product_categories">, value: string) => setForm((c) => ({ ...c, [key]: value }));
  const setCategories = (product_categories: string[]) => setForm((c) => ({ ...c, product_categories }));

  /* The GSTIN, checked as it is typed (format, state code, check digit),
     and on request by the server, which also names the state and PAN. */
  const [gstTouched, setGstTouched] = useState(false);
  const [gstCheck, setGstCheck] = useState<GstinCheck | null>(null);
  const [checkingGst, setCheckingGst] = useState(false);
  const gstProblem = gstTouched ? gstinError(form.gstin) : null;

  const checkGstin = async () => {
    setGstTouched(true);
    setCheckingGst(true);
    try {
      setGstCheck(await verifyGstinApi(form.gstin));
    } catch (failure) {
      addToast(errorDetail(failure, "The GSTIN could not be checked."), "error");
    } finally {
      setCheckingGst(false);
    }
  };

  /* The bank branch behind the IFSC, looked up as soon as a whole code is
     typed (or on Find Bank), filling Bank Name and Branch. A reply for a
     code that has since been changed is dropped. */
  const [ifscBranch, setIfscBranch] = useState<IfscBranch | null>(null);
  const [ifscProblem, setIfscProblem] = useState<string | null>(null);
  const [findingBank, setFindingBank] = useState(false);
  const ifscAsked = useRef("");
  /* What the last lookup wrote, so changing the IFSC clears it - but not a
     bank detail somebody typed themselves. */
  const ifscFilled = useRef<Partial<Record<LookupField, string>> | null>(null);

  const findBank = async (code: string) => {
    if (!IFSC_PATTERN.test(code)) {
      setIfscProblem("An IFSC is four letters, 0, then six characters.");
      return;
    }
    ifscAsked.current = code;
    setIfscProblem(null);
    setFindingBank(true);
    try {
      const branch = await lookupIfscApi(code);
      if (ifscAsked.current !== code) return;
      setIfscBranch(branch);
      const found = fromLookup(branch);
      setForm((c) => {
        const next = { ...c };
        const filled: Partial<Record<LookupField, string>> = {};
        LOOKUP_FIELDS.forEach((key) => {
          if (found[key]) next[key] = filled[key] = found[key];
        });
        ifscFilled.current = filled;
        return next;
      });
    } catch (failure) {
      if (ifscAsked.current !== code) return;
      setIfscBranch(null);
      setIfscProblem(errorDetail(failure, "The IFSC could not be looked up. Enter the bank details by hand."));
    } finally {
      if (ifscAsked.current === code) setFindingBank(false);
    }
  };

  const setDoc = (key: SingleDoc, file?: StoredAttachment) =>
    setDocs((c) => {
      const next = { ...c };
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });

  const save = async (submit: boolean) => {
    if (!form.name.trim()) return addToast("Enter the vendor's name.", "error");
    const gstSaveProblem = gstinError(form.gstin);
    if (gstSaveProblem) {
      setGstTouched(true);
      return addToast(`GSTIN: ${gstSaveProblem}`, "error");
    }
    const payload = {
      ...form,
      credit_days: form.credit_days === "" ? null : Number(form.credit_days),
      lead_time_days: form.lead_time_days === "" ? null : Number(form.lead_time_days),
      product_categories: form.product_categories,
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

  const input = (key: Exclude<keyof Form, "product_categories">, label: string, props: Record<string, unknown> = {}) => (
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
              <div className="sm:col-span-2 lg:col-span-3">
                <CategoryPicker value={form.product_categories} onChange={setCategories} />
              </div>
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

          <FormSectionBlock icon={<FiPercent />} title="Tax Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="v-gstin">GSTIN</label>
                <div className="flex gap-2">
                  <input
                    id="v-gstin"
                    className={FIELD}
                    value={form.gstin}
                    maxLength={15}
                    aria-invalid={Boolean(gstProblem)}
                    onChange={(e) => {
                      set("gstin", e.target.value.toUpperCase().replace(/\s/g, ""));
                      setGstCheck(null);
                    }}
                    onBlur={() => setGstTouched(true)}
                  />
                  <button
                    type="button"
                    onClick={checkGstin}
                    disabled={!form.gstin.trim() || checkingGst}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 text-[12px] font-medium text-[#233353] hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:text-sky-300"
                  >
                    {checkingGst ? "Checking..." : "Check"}
                  </button>
                </div>
                {gstProblem ? (
                  <p className="mt-1 text-[11px] text-rose-500">{gstProblem}</p>
                ) : gstCheck?.valid ? (
                  <p className="mt-1 flex items-start gap-1 text-[11px] text-emerald-700">
                    <FiCheckCircle className="mt-0.5 shrink-0" />
                    <span>
                      Valid GSTIN{gstCheck.state ? ` · ${gstCheck.state}` : ""}{gstCheck.pan ? ` · PAN ${gstCheck.pan}` : ""}.{" "}
                      <span className="text-slate-400">{gstCheck.live.detail}</span>
                    </span>
                  </p>
                ) : gstCheck && !gstCheck.valid ? (
                  <p className="mt-1 text-[11px] text-rose-500">{gstCheck.reason}</p>
                ) : null}
              </div>
              {input("pan", "PAN")}
            </div>
            {existing && (
              <p className="mt-3 text-[11px] text-amber-700">Changing the GSTIN sends the vendor back for verification.</p>
            )}
          </FormSectionBlock>

          {/* The bank details, each in its own field, in the order of the
              vendor's bank details sheet. A whole IFSC fills the bank name,
              branch, bank address and MICR from Razorpay's IFSC lookup. */}
          <FormSectionBlock icon={<FiCreditCard />} title="Bank Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {input("account_holder", "Account Holder Name")}
              {input("bank_name", "Bank Name")}
              {input("branch", "Branch")}
              <div className="sm:col-span-2 lg:col-span-3">{input("bank_address", "Bank Address")}</div>
              {input("account_number", "Account Number", { inputMode: "numeric", autoComplete: "off" })}
              <div>
                <label className={LABEL} htmlFor="v-account_type">Account Type</label>
                <select id="v-account_type" className={FIELD} value={form.account_type} onChange={(e) => set("account_type", e.target.value)}>
                  <option value="">Select</option>
                  {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="v-ifsc">IFSC Code</label>
                <div className="flex gap-2">
                  <input
                    id="v-ifsc"
                    className={FIELD}
                    value={form.ifsc}
                    maxLength={11}
                    aria-invalid={Boolean(ifscProblem)}
                    aria-describedby="v-ifsc-note"
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase().replace(/\s/g, "");
                      const filled = ifscFilled.current;
                      ifscFilled.current = null;
                      setForm((c) => {
                        const next = { ...c, ifsc: code };
                        LOOKUP_FIELDS.forEach((key) => {
                          if (filled?.[key] !== undefined && c[key] === filled[key]) next[key] = "";
                        });
                        return next;
                      });
                      setIfscBranch(null);
                      setIfscProblem(null);
                      ifscAsked.current = "";
                      setFindingBank(false);
                      if (IFSC_PATTERN.test(code)) findBank(code);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => findBank(form.ifsc)}
                    disabled={!form.ifsc.trim() || findingBank}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 text-[12px] font-medium text-[#233353] hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:text-sky-300"
                  >
                    {findingBank ? "Finding..." : "Find Bank"}
                  </button>
                </div>
                <div id="v-ifsc-note" aria-live="polite">
                  {ifscProblem ? (
                    <p className="mt-1 text-[11px] text-rose-500">{ifscProblem}</p>
                  ) : ifscBranch ? (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-emerald-700">
                      <FiCheckCircle className="mt-0.5 shrink-0" />
                      <span>
                        {ifscBranch.bank} · {ifscBranch.branch}
                        {ifscBranch.city || ifscBranch.state ? ` · ${[ifscBranch.city, ifscBranch.state].filter(Boolean).join(", ")}` : ""}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">Fills the bank name, branch, address and MICR.</p>
                  )}
                </div>
              </div>
              {input("micr", "MICR Code", { inputMode: "numeric", maxLength: 9 })}
            </div>
            {existing && (
              <p className="mt-3 text-[11px] text-amber-700">Changing the account number or IFSC sends the vendor back for verification.</p>
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

/** Pick what the vendor supplies from Masters > Product Categories.
 *  Names already on the vendor that the list no longer has (older free
 *  text) stay as they are until removed. */
function CategoryPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [options, setOptions] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    getProductCategoriesApi(true)
      .then((rows) => live && setOptions(rows.map((row) => row.name)))
      .catch((failure) => live && setFailed(errorDetail(failure, "Could not load product categories.")));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const chosen = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);
  const term = query.trim().toLowerCase();
  const matches = useMemo(
    () => options.filter((name) => !chosen.has(name.toLowerCase()) && (!term || name.toLowerCase().includes(term))).slice(0, 50),
    [options, chosen, term],
  );

  const add = (name: string) => {
    onChange([...value, name]);
    setQuery("");
  };

  return (
    <div ref={box} className="relative">
      <label className={LABEL} htmlFor="v-categories">Product Categories</label>
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 focus-within:border-[#233353] dark:bg-[#071929]">
        {value.map((name) => (
          <span key={name} className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 dark:bg-[#0d2336] dark:text-slate-200">
            {name}
            <button type="button" aria-label={`Remove ${name}`} onClick={() => onChange(value.filter((v) => v !== name))} className="text-slate-400 hover:text-rose-500">
              <FiX size={11} />
            </button>
          </span>
        ))}
        <input
          id="v-categories"
          role="combobox"
          aria-expanded={open}
          aria-controls="v-categories-list"
          className="min-w-[160px] flex-1 border-none bg-transparent px-1 py-1 text-[13px] outline-none"
          placeholder={value.length ? "Add another..." : "Search and pick categories"}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) add(matches[0]);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && !query && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
      </div>
      {failed && <p className="mt-1 text-[11px] text-rose-500">{failed}</p>}
      {open && !failed && (
        <ul id="v-categories-list" role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-[#17304a] dark:bg-[#071929]">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-slate-400">
              {options.length ? "No matching category. Add it under Masters > Product Categories." : "Loading categories..."}
            </li>
          ) : (
            matches.map((name) => (
              <li key={name} role="option" aria-selected={false}>
                <button type="button" onClick={() => add(name)} className="w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0d2336]">
                  {name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
