"use client";

/**
 * Bank Details master.
 *
 * Where customers remit, and the GST registration the tax is worked out
 * against. Both are printed on documents money moves against, which is why
 * they are edited on a screen a super admin can reach rather than set once
 * in the deployment's environment file: an account number changes, and a
 * proforma invoice still carrying the old one sends a payment to the wrong
 * place with nobody noticing for a month.
 *
 * They lived on the Company Profile screen before, under a heading about
 * proposals and emails, which is not where anyone looks for an account
 * number - and that page is long enough that they sat below the fold.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { LuImage, LuLandmark, LuQrCode, LuReceiptText, LuSave } from "react-icons/lu";

import PageHeader from "@/components/ui/PageHeader";
import { ListPage, PrimaryAction } from "@/components/crm/ListPageShell";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import {
  getCompanyProfileApi,
  removeUpiQrApi,
  saveCompanyProfileApi,
  uploadUpiQrApi,
  type CompanyProfile,
} from "@/features/settings/api/companyProfile.api";

const INPUT =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

export default function BankDetailsPage() {
  const { addToast } = useUIStore();
  const superAdmin = useAuthStore((state) => state.user?.is_super_admin === true);

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const qrInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setProfile(await getCompanyProfileApi());
    } catch (error) {
      console.error(error);
      addToast("Could not load the bank details.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof CompanyProfile, value: string) =>
    setProfile((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!profile) return;

    setSaving(true);

    try {
      /* Only the fields this screen owns. Sending the whole profile back
         would let a stale copy of the About text or the signatory - loaded
         before somebody else edited them - overwrite theirs. */
      const saved = await saveCompanyProfileApi({
        bank_account_name: profile.bank_account_name,
        bank_name: profile.bank_name,
        bank_account_number: profile.bank_account_number,
        bank_branch: profile.bank_branch,
        bank_ifsc: profile.bank_ifsc,
        bank_swift: profile.bank_swift,
        upi_vpa: profile.upi_vpa,
        company_state_name: profile.company_state_name,
        company_state_code: profile.company_state_code,
      });

      setProfile(saved);
      addToast("Bank details saved. New invoices use them straight away.", "success");
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "The bank details could not be saved.";
      addToast(detail, "error");
    } finally {
      setSaving(false);
    }
  };

  const sendQr = async (file: File) => {
    try {
      setProfile(await uploadUpiQrApi(file));
      addToast("UPI QR uploaded.", "success");
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That image could not be uploaded.";
      addToast(detail, "error");
    }
  };

  const clearQr = async () => {
    try {
      setProfile(await removeUpiQrApi());
      addToast("UPI QR removed.", "info");
    } catch (error) {
      console.error(error);
      addToast("The UPI QR could not be removed.", "error");
    }
  };

  if (!superAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-[#17304a] dark:bg-[#071929]">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
          Access Denied
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Only a super administrator can change the bank details.
        </p>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-2 text-slate-400">
        <CgSpinner className="animate-spin text-2xl text-[#233353]" />
        <span className="text-xs">Loading the bank details...</span>
      </div>
    );
  }

  return (
    <ListPage>
      <PageHeader
        title="Bank Details"
        description="Where customers remit, and the registration the tax is worked out against. Both are printed on every proforma invoice."
        action={
          <PrimaryAction onClick={save}>
            {saving ? (
              <CgSpinner className="animate-spin" size={14} />
            ) : (
              <LuSave size={14} />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </PrimaryAction>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section icon={<LuLandmark size={16} />} title="Settlement & Remittance">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Beneficiary Account Name"
              hint="The name the bank holds the account under. Blank falls back to the legal name."
            >
              <input
                value={profile.bank_account_name}
                onChange={(event) => set("bank_account_name", event.target.value)}
                placeholder={profile.company_legal_name || "Account name"}
                className={INPUT}
              />
            </Field>

            <Field label="Bank Name">
              <input
                value={profile.bank_name}
                onChange={(event) => set("bank_name", event.target.value)}
                placeholder="State Bank of India"
                className={INPUT}
              />
            </Field>

            <Field label="Account Number">
              <input
                value={profile.bank_account_number}
                onChange={(event) => set("bank_account_number", event.target.value)}
                placeholder="Current account"
                className={INPUT}
              />
            </Field>

            <Field label="Branch">
              <input
                value={profile.bank_branch}
                onChange={(event) => set("bank_branch", event.target.value)}
                placeholder="Branch and city"
                className={INPUT}
              />
            </Field>

            <Field label="IFSC Code">
              <input
                value={profile.bank_ifsc}
                onChange={(event) => set("bank_ifsc", event.target.value)}
                placeholder="SBIN0009837"
                className={INPUT}
              />
            </Field>

            <Field
              label="SWIFT Code"
              hint="Only needed for inward remittances. Left blank it is not printed."
            >
              <input
                value={profile.bank_swift}
                onChange={(event) => set("bank_swift", event.target.value)}
                placeholder="Optional"
                className={INPUT}
              />
            </Field>
          </div>
        </Section>

        <div className="space-y-6">
          <Section icon={<LuQrCode size={16} />} title="Virtual UPI Settlement">
            <Field label="UPI VPA">
              <input
                value={profile.upi_vpa}
                onChange={(event) => set("upi_vpa", event.target.value)}
                placeholder="company@bank"
                className={INPUT}
              />
            </Field>

            {/* The bank's own image, not a code drawn from the VPA above: a
                QR generated from a mistyped VPA scans perfectly and pays
                nobody. */}
            <div className="mt-4 flex flex-wrap items-start gap-5 border-t border-slate-100 pt-4 dark:border-[#17304a]">
              {profile.upi_qr_path ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/company-profile/upi-qr/image?v=${encodeURIComponent(profile.upi_qr_path)}`}
                  alt="UPI QR"
                  className="h-28 w-28 rounded-lg border border-slate-200 bg-white object-contain p-1.5 dark:border-[#17304a]"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-[10px] text-slate-400 dark:border-[#17304a]">
                  No UPI QR
                </div>
              )}

              <div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => qrInput.current?.click()}
                    className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
                  >
                    <LuImage size={13} />
                    {profile.upi_qr_path ? "Replace UPI QR" : "Upload UPI QR"}
                  </button>

                  {profile.upi_qr_path && (
                    <button
                      type="button"
                      onClick={clearQr}
                      className="h-9 rounded-lg border border-rose-200 px-4 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <p className="mt-1.5 max-w-sm text-[10px] leading-relaxed text-slate-400">
                  Upload the code your bank issued for the VPA above. It is
                  printed on every proforma invoice for the customer to scan.
                </p>

                <input
                  ref={qrInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void sendQr(file);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
          </Section>

          <Section icon={<LuReceiptText size={16} />} title="GST Registration">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="State Name"
                hint="Our place of business, as the GST registration records it."
              >
                <input
                  value={profile.company_state_name}
                  onChange={(event) => set("company_state_name", event.target.value)}
                  placeholder="Uttar Pradesh"
                  className={INPUT}
                />
              </Field>

              <Field
                label="State Code"
                hint="The two digits that open the GSTIN. Matched against the customer's state to decide CGST + SGST or IGST, so a wrong code taxes every invoice the wrong way."
              >
                <input
                  value={profile.company_state_code}
                  onChange={(event) => set("company_state_code", event.target.value)}
                  placeholder="09"
                  className={INPUT}
                />
              </Field>
            </div>
          </Section>
        </div>
      </div>
    </ListPage>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-[#17304a] dark:bg-[#071929]">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#17304a]">
        <span className="text-[#233353] dark:text-sky-400">{icon}</span>
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
          {title}
        </h2>
      </div>

      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </label>

      {children}

      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}
