"use client";

import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { createUserApi } from "@/features/users/api/users.api";
import { getRolesApi, Role } from "@/features/rbac/api/rbac.api";
import { getCompaniesApi, Company } from "@/features/companies/api/companies.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import { FiArrowLeft, FiUser, FiMail, FiLock, FiPhone, FiCreditCard, FiTag, FiBriefcase } from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import Link from "next/link";
import SearchableMultiSelect from "@/components/ui/SearchableMultiSelect";

export default function AddUserPage() {
  const router = useRouter();
  const { addToast } = useUIStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone_number: "",
    employee_id: "",
    role_ids: [] as string[],
    company_ids: [] as string[],
  });

  const user = useAuthStore((state) => state.user);
  const superAdmin = user?.is_super_admin === true;

  useEffect(() => {
    if (!superAdmin) return;

    const fetchData = async () => {
      try {
        setLoadingRoles(true);
        setLoadingCompanies(true);
        const [rolesData, companiesResponse] = await Promise.all([
          getRolesApi(),
          getCompaniesApi(),
        ]);
        setRoles(rolesData);
        setCompanies(companiesResponse.data);
      } catch (err: unknown) {
        console.error(err);
        const axiosError = err as AxiosError<{ message?: string }>;
        addToast(axiosError.response?.data?.message || "Failed to fetch setup data.", "error");
      } finally {
        setLoadingRoles(false);
        setLoadingCompanies(false);
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/users"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#0d2336] transition-all cursor-pointer"
        >
          <FiArrowLeft className="text-lg" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Add New User
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a new administrative or member account for your organization.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* First Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                First Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <FiUser className="text-sm" />
                </span>
                <input
                  type="text"
                  name="first_name"
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929]"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Last Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <FiUser className="text-sm" />
                </span>
                <input
                  type="text"
                  name="last_name"
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929]"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <FiMail className="text-sm" />
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929]"
                  placeholder="john.doe@company.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <FiLock className="text-sm" />
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929]"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <FiPhone className="text-sm" />
                </span>
                <input
                  type="tel"
                  name="phone_number"
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929]"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone_number}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Employee ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Employee ID
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <FiCreditCard className="text-sm" />
                </span>
                <input
                  type="text"
                  name="employee_id"
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929]"
                  placeholder="EMP-12345"
                  value={formData.employee_id}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Role selection dropdown */}
          <SearchableMultiSelect
            label="Assigned Roles"
            placeholder={loadingRoles ? "Loading available roles..." : "Select roles..."}
            options={roles.map((r) => ({ id: r.id, name: r.name }))}
            selectedIds={formData.role_ids}
            onChange={(ids) => setFormData({ ...formData, role_ids: ids })}
          />

          {/* Company selection dropdown */}
          <SearchableMultiSelect
            label="Assigned Companies"
            placeholder={loadingCompanies ? "Loading available companies..." : "Select companies..."}
            options={companies.map((c) => ({ id: c.id, name: c.company_name }))}
            selectedIds={formData.company_ids}
            onChange={(ids) => setFormData({ ...formData, company_ids: ids })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-[#0d2336]">
            <Link
              href="/users"
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#0d2336] text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#0d2336] transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <CgSpinner className="animate-spin text-base" />
                  <span>Creating Account...</span>
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
