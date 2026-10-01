"use client";

/**
 * Company Profile.
 *
 * Who the proposals and emails come from: the name on the cover, the
 * paragraphs in the About panel, the range listed under it, the footer's
 * website and the signature at the end. Previously these only existed as
 * environment variables, so changing a phone number meant a deployment.
 *
 * Super admin only, like the rest of Masters.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";

import PageHeader from "@/components/ui/PageHeader";
import { ListPage, PrimaryAction } from "@/components/crm/ListPageShell";
import {
  LuBuilding2,
  LuFileText,
  LuImage,
  LuLandmark,
  LuPenLine,
  LuQrCode,
  LuReceiptText,
  LuSave,
} from "react-icons/lu";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import {
  CompanyProfile,
  getCompanyProfileApi,
  removeCompanyCoverApi,
  saveCompanyProfileApi,
  removeUpiQrApi,
  uploadCompanyCoverApi,
  uploadUpiQrApi,
  uploadCompanyLogoApi,
} from "@/features/settings/api/companyProfile.api";

const INPUT =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-[13px] text-slate-800 outline-none transition focus:border-[#233353] focus:bg-white dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

const AREA =
  "w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[13px] leading-6 text-slate-800 outline-none transition focus:border-[#233353] focus:bg-white dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

export default function CompanyProfilePage() {
  const { addToast } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const superAdmin = user?.is_super_admin === true;

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const qrInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setProfile(await getCompanyProfileApi());
    } catch (error) {
      console.error(error);
      addToast("Could not load the company profile.", "error");
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
      const saved = await saveCompanyProfileApi({
        company_legal_name: profile.company_legal_name,
        company_address: profile.company_address,
        company_gstin: profile.company_gstin,
        company_website: profile.company_website,
        company_email: profile.company_email,
        company_phone: profile.company_phone,
        company_about: profile.company_about,
        company_offerings: profile.company_offerings,
        signatory_name: profile.signatory_name,
        signatory_title: profile.signatory_title,

        company_state_name: profile.company_state_name,
        company_state_code: profile.company_state_code,

        bank_account_name: profile.bank_account_name,
        bank_name: profile.bank_name,
        bank_account_number: profile.bank_account_number,
        bank_branch: profile.bank_branch,
        bank_ifsc: profile.bank_ifsc,
        bank_swift: profile.bank_swift,
        upi_vpa: profile.upi_vpa,
      });

      setProfile(saved);
      addToast("Company profile saved. New proposals use it straight away.", "success");
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "The company profile could not be saved.";
      addToast(detail, "error");
    } finally {
      setSaving(false);
    }
  };

  const sendImage = async (
    file: File,
    send: (file: File) => Promise<CompanyProfile>,
    done: string,
  ) => {
    try {
      setProfile(await send(file));
      addToast(done, "success");
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

  const clearCover = async () => {
    try {
      setProfile(await removeCompanyCoverApi());
      addToast("Cover image removed.", "info");
    } catch (error) {
      console.error(error);
      addToast("The cover image could not be removed.", "error");
    }
  };

  if (!superAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-[#17304a] dark:bg-[#071929]">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
          Access Denied
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Only a super administrator can change the company profile.
        </p>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-2 text-slate-400">
        <CgSpinner className="animate-spin text-2xl text-[#233353]" />
        <span className="text-xs">Loading the company profile...</span>
      </div>
    );
  }

  return (
    <ListPage>
      <PageHeader
        title="Company Profile"
        description="What appears on every proposal and every email you send: the name on the cover, the About panel, the range, and the signature."
        action={
          <PrimaryAction onClick={save}>
            {saving ? (
              <CgSpinner className="animate-spin" size={14} />
            ) : (
              <LuSave size={14} />
            )}
            {saving ? "Saving..." : "Save Profile"}
          </PrimaryAction>
        }
      />

      {/* The long-form copy on the left, the short settings beside it, so
          the screen fills the width the way every other page does. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section icon={<LuBuilding2 size={16} />} title="Identity">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Legal Name" hint="Printed on the cover and the signature.">
                <input
                  value={profile.company_legal_name}
                  onChange={(event) => set("company_legal_name", event.target.value)}
                  placeholder="Qonevo Technologies"
                  className={INPUT}
                />
              </Field>

              <Field label="Website" hint="Shown in the footer bar of every page.">
                <input
                  value={profile.company_website}
                  onChange={(event) => set("company_website", event.target.value)}
                  placeholder="www.qonevo.in"
                  className={INPUT}
                />
              </Field>

              <Field label="Email">
                <input
                  value={profile.company_email}
                  onChange={(event) => set("company_email", event.target.value)}
                  placeholder="sales@qonevo.in"
                  className={INPUT}
                />
              </Field>

              <Field label="Phone">
                <input
                  value={profile.company_phone}
                  onChange={(event) => set("company_phone", event.target.value)}
                  placeholder="9891818195"
                  className={INPUT}
                />
              </Field>

              <Field label="GSTIN">
                <input
                  value={profile.company_gstin}
                  onChange={(event) => set("company_gstin", event.target.value)}
                  placeholder="29ABCDE1234F1Z5"
                  className={INPUT}
                />
              </Field>

              <Field label="Address" hint="One line per row.">
                <textarea
                  rows={3}
                  value={profile.company_address.replace(/\|/g, "\n")}
                  onChange={(event) => set("company_address", event.target.value)}
                  placeholder={"Plot 12, Sector 63\nNoida, Uttar Pradesh 201301"}
                  className={AREA}
                />
              </Field>
            </div>
          </Section>

          <Section icon={<LuFileText size={16} />} title="About &amp; Range">
            <Field
              label="About"
              hint="One paragraph per row. Two or more set themselves in the proposal's two columns."
            >
              <textarea
                rows={6}
                value={profile.company_about.replace(/\|/g, "\n")}
                onChange={(event) => set("company_about", event.target.value)}
                placeholder="A technology hardware solution and business consulting company..."
                className={AREA}
              />
            </Field>

            <Field label="What you sell" hint="One per row. Listed under the About panel.">
              <textarea
                rows={5}
                value={profile.company_offerings.replace(/\|/g, "\n")}
                onChange={(event) => set("company_offerings", event.target.value)}
                placeholder={"Interactive Flat Panels\nOPS PC\nMovable stands"}
                className={AREA}
              />
            </Field>

            {profile.company_offering_list.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.company_offering_list.map((offering) => (
                  <span
                    key={offering}
                    className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-[#0b2034] dark:text-slate-300"
                  >
                    {offering}
                  </span>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section icon={<LuPenLine size={16} />} title="Signature">
            <div className="grid grid-cols-1 gap-4">
              <Field
                label="Signatory Name"
                hint="Only used where a proposal has no salesperson of its own — otherwise it is signed by whoever is sending it."
              >
                <input
                  value={profile.signatory_name}
                  onChange={(event) => set("signatory_name", event.target.value)}
                  placeholder="Authorised signatory"
                  className={INPUT}
                />
              </Field>

              <Field label="Signatory Title">
                <input
                  value={profile.signatory_title}
                  onChange={(event) => set("signatory_title", event.target.value)}
                  placeholder="Director"
                  className={INPUT}
                />
              </Field>
            </div>
          </Section>

          {/* WHERE THE MONEY GOES, AND WHAT TAX APPLIES

              Both printed on documents a customer pays against, which is
              exactly why they are edited here rather than set once in the
              deployment's environment: an account number changes, and a
              proforma invoice still carrying the old one is how a payment
              goes astray with nobody noticing for a month. */}
          <Section icon={<LuLandmark size={16} />} title="Banking Details">
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
                  placeholder="HDFC Bank"
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
                  placeholder="HDFC0000123"
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

              <Field label="UPI VPA">
                <input
                  value={profile.upi_vpa}
                  onChange={(event) => set("upi_vpa", event.target.value)}
                  placeholder="company@bank"
                  className={INPUT}
                />
              </Field>
            </div>

            {/* The bank's own image, not a code we draw from the VPA above:
                a QR generated from a mistyped VPA scans perfectly and pays
                nobody. */}
            <div className="mt-2 flex flex-wrap items-start gap-5 border-t border-slate-100 pt-4 dark:border-[#17304a]">
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
                    <LuQrCode size={13} />
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
                    if (file) {
                      void sendImage(file, uploadUpiQrApi, "UPI QR uploaded.");
                    }
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

          <Section icon={<LuImage size={16} />} title="Logo">
            <div className="flex flex-wrap items-center gap-5">
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/quotations/brand/logo?v=${profile.company_logo_path}`}
                alt="Brand logo"
                className="h-14 w-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-[#17304a]"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = "none";
                }}
              />

              <div>
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
                >
                  <LuImage size={13} />
                  Replace Logo
                </button>

                <p className="mt-1.5 text-[10px] text-slate-400">
                  PNG, JPG or WEBP. Appears on every page of the proposal.
                </p>

                <input
                  ref={logoInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void sendImage(file, uploadCompanyLogoApi, "Logo uploaded.");
                    }
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
          </Section>

          <Section icon={<LuImage size={16} />} title="Cover Image">
            <div className="flex flex-wrap items-start gap-5">
              {profile.company_cover_image ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/company-profile/cover/image?v=${encodeURIComponent(profile.company_cover_image)}`}
                  alt="Proposal cover"
                  className="h-28 w-auto rounded-lg border border-slate-200 object-cover dark:border-[#17304a]"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-28 w-44 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400 dark:border-[#17304a]">
                  No cover image
                </div>
              )}

              <div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => coverInput.current?.click()}
                    className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
                  >
                    <LuImage size={13} />
                    {profile.company_cover_image ? "Replace Cover" : "Upload Cover"}
                  </button>

                  {profile.company_cover_image && (
                    <button
                      type="button"
                      onClick={clearCover}
                      className="h-9 rounded-lg border border-rose-200 px-4 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <p className="mt-1.5 max-w-sm text-[10px] leading-relaxed text-slate-400">
                  Sits on the proposal cover under the addresses — a product
                  photo, as the printed proposal has. Without one the cover
                  simply runs without a picture.
                </p>

                <input
                  ref={coverInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void sendImage(
                        file,
                        uploadCompanyCoverApi,
                        "Cover image uploaded.",
                      );
                    }
                    event.target.value = "";
                  }}
                />
              </div>
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
