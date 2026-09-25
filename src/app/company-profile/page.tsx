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
import { LuBuilding2, LuFileText, LuImage, LuPenLine, LuSave } from "react-icons/lu";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import {
  CompanyProfile,
  getCompanyProfileApi,
  removeCompanyCoverApi,
  saveCompanyProfileApi,
  uploadCompanyCoverApi,
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
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            Company Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            What appears on every proposal and every email you send: the name
            on the cover, the About panel, the range, and the signature.
          </p>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#233353] px-5 text-xs font-bold text-white transition hover:bg-[#18243a] disabled:opacity-50"
        >
          {saving ? <CgSpinner className="animate-spin" size={14} /> : <LuSave size={14} />}
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

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
    </div>
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
