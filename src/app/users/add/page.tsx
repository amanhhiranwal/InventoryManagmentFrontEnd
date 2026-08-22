"use client";

import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { createUserApi } from "@/features/users/api/users.api";
import { getRolesApi, Role } from "@/features/rbac/api/rbac.api";
import { getCompaniesApi, Company } from "@/features/companies/api/companies.api";
import { getLocationsApi, Location } from "@/features/locations/api/locations.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import { FiArrowLeft, FiUser, FiMail, FiLock, FiPhone, FiCreditCard, FiMapPin, FiBriefcase, FiShield } from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import Link from "next/link";
import SearchableMultiSelect from "@/components/ui/SearchableMultiSelect";

export default function AddUserPage() {
  const router = useRouter();
  const { addToast } = useUIStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone_number: "",
    employee_id: "",
    location_id: "",
    status: "active",
    role_ids: [] as string[],
    company_ids: [] as string[],
  });

  const user = useAuthStore((state) => state.user);
  const superAdmin = user?.is_super_admin === true;

  useEffect(() => {
    if (!superAdmin) return;

    const fetchData = async () => {
      try {
        setLoadingSetup(true);
        const [rolesData, companiesResponse, locationsResponse] = await Promise.all([
          getRolesApi(),
          getCompaniesApi(1, 100),
          getLocationsApi(1, 100),
        ]);
        setRoles(rolesData);
        setCompanies(companiesResponse.data);
        setLocations(locationsResponse.data);
      } catch (err: unknown) {
        console.error(err);
        const axiosError = err as AxiosError<{ message?: string }>;
        addToast(axiosError.response?.data?.message || "Failed to fetch setup data.", "error");
      } finally {
        setLoadingSetup(false);
      }
    };

    fetchData();
  }, [superAdmin, addToast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      addToast("Please fill in all required fields.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      await createUserApi(formData);
      addToast("User created successfully!", "success");
      router.push("/users");
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to create user.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!superAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-[#051422] border border-slate-200 dark:border-[#0d2336] rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-3xl mb-4 animate-bounce">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
          Only Super Administrators can register new user profiles. If you need assistance, please contact your systems manager.
        </p>
        <Link
          href="/users"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0d2336] dark:hover:bg-[#0d2336]/80 px-4 py-2 text-sm font-semibold transition-all"
        >
          <FiArrowLeft />
          <span>Back to User List</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/users"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#0d2336] transition-all cursor-pointer"
        >
          <FiArrowLeft className="text-lg" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight font-sans">
            Add New User Account
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Guide user onboarding by assigning personal details, enterprise master entities, and security roles.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal Details */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-[#0d2336]">
            <FiUser className="text-[#233353] dark:text-sky-400 text-base" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm font-sans">
              1. Personal & Contact Information
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                required
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#233353] dark:focus:border-sky-400"
                placeholder="Rahul"
                value={formData.first_name}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="last_name"
                required
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#233353] dark:focus:border-sky-400"
                placeholder="Sharma"
                value={formData.last_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#233353] dark:focus:border-sky-400"
                placeholder="rahul.sharma@company.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#233353] dark:focus:border-sky-400"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone_number"
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#233353] dark:focus:border-sky-400"
                placeholder="+91 98765 43210"
                value={formData.phone_number}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Employee Code / ID
              </label>
              <input
                type="text"
                name="employee_id"
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#233353] dark:focus:border-sky-400"
                placeholder="EMP-1002"
                value={formData.employee_id}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Enterprise Masters Assignment */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-[#0d2336]">
            <FiBriefcase className="text-[#233353] dark:text-sky-400 text-base" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm font-sans">
              2. Enterprise Masters & Location Assignment
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Primary Location Node
              </label>
              <div className="relative">
                <select
                  name="location_id"
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-[#233353] dark:focus:border-sky-400 cursor-pointer"
                  value={formData.location_id}
                  onChange={handleChange}
                >
                  <option value="">Select Location Zone...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.location_name} ({loc.location_code})
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400 text-[10px]">
                  ▼
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Account Status
              </label>
              <div className="relative">
                <select
                  name="status"
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-[#233353] dark:focus:border-sky-400 cursor-pointer"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
                <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400 text-[10px]">
                  ▼
                </span>
              </div>
            </div>
          </div>

          <SearchableMultiSelect
            label="Assigned Enterprise Companies"
            placeholder={loadingSetup ? "Loading available companies..." : "Select companies..."}
            options={companies.map((c) => ({ id: c.id, name: c.company_name }))}
            selectedIds={formData.company_ids}
            onChange={(ids) => setFormData({ ...formData, company_ids: ids })}
          />
        </div>

        {/* Section 3: Role & Hierarchy Selection */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-[#0d2336]">
            <FiShield className="text-[#233353] dark:text-sky-400 text-base" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm font-sans">
              3. Security Role & Hierarchy Role Assignment
            </h3>
          </div>

          <SearchableMultiSelect
            label="Assigned Security Roles (Determines Menu Permissions & Reporting Hierarchy)"
            placeholder={loadingSetup ? "Loading available security roles..." : "Select roles (e.g. Area Head)..."}
            options={roles.map((r) => ({ id: r.id, name: r.name }))}
            selectedIds={formData.role_ids}
            onChange={(ids) => setFormData({ ...formData, role_ids: ids })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/users"
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#0d2336] text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#0d2336] transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#233353] hover:bg-[#162238] dark:bg-sky-500 dark:hover:bg-sky-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <CgSpinner className="animate-spin text-base" />
                <span>Registering Account...</span>
              </>
            ) : (
              "Save & Register User"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
