"use client";

import { useEffect, useState, useCallback } from "react";
import { AxiosError } from "axios";
import {
  getCompaniesApi,
  createCompanyApi,
  updateCompanyApi,
  deleteCompanyApi,
  uploadCompanyLogoApi,
  Company,
  CreateCompanyPayload
} from "@/features/companies/api/companies.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import { FiPlus, FiBriefcase, FiCheckCircle, FiEdit2, FiTrash2, FiGlobe, FiPhone, FiMail, FiMapPin } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";

export default function CompaniesPage() {
  const { addToast } = useUIStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Form states
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initialFormState: CreateCompanyPayload = {
    company_name: "",
    company_code: "",
    email: "",
    phone_number: "",
    website: "",
    gst_number: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    is_active: true,
  };

  const [formData, setFormData] = useState<CreateCompanyPayload>({ ...initialFormState });

  const user = useAuthStore((state) => state.user);
  const superAdmin = user?.is_super_admin === true;
  const canViewCompanies = hasPermission("company.view");
  const canUpdateCompany = hasPermission("company.update");
  const canDeleteCompany = hasPermission("company.delete");
  const showAddCompany = superAdmin;

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCompaniesApi(currentPage, pageSize);
      setCompanies(data.data);
      setTotalItems(data.total);
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to fetch companies list.", "error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, addToast]);

  useEffect(() => {
    if (canViewCompanies) {
      fetchCompanies();
    }
  }, [canViewCompanies, fetchCompanies]);

  const handleOpenCreateModal = () => {
    setFormData({ ...initialFormState });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      company_name: company.company_name,
      company_code: company.company_code,
      email: company.email,
      phone_number: company.phone_number || "",
      website: company.website || "",
      gst_number: company.gst_number || "",
      address_line_1: company.address_line_1 || "",
      address_line_2: company.address_line_2 || "",
      city: company.city || "",
      state: company.state || "",
      country: company.country || "",
      postal_code: company.postal_code || "",
      is_active: company.is_active,
    });
    setShowEditModal(true);
  };

  const handleOpenDeleteModal = (company: Company) => {
    setSelectedCompany(company);
    setShowDeleteModal(true);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name || !formData.company_code || !formData.email) {
      addToast("Company name, code, and email are required.", "warning");
      return;
    }

    try {
      setCreating(true);
      const newCompany = await createCompanyApi(formData);
      if (logoFile && newCompany?.id) {
        await uploadCompanyLogoApi(newCompany.id, logoFile);
      }
      addToast("Company created successfully!", "success");
      setLogoFile(null);
      setShowCreateModal(false);
      fetchCompanies();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to create company.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    if (!formData.company_name || !formData.company_code || !formData.email) {
      addToast("Company name, code, and email are required.", "warning");
      return;
    }

    try {
      setUpdating(true);
      await updateCompanyApi(selectedCompany.id, formData);
      if (logoFile) {
        await uploadCompanyLogoApi(selectedCompany.id, logoFile);
      }
      addToast("Company updated successfully!", "success");
      setLogoFile(null);
      setShowEditModal(false);
      fetchCompanies();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to update company.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    try {
      setDeleting(true);
      await deleteCompanyApi(selectedCompany.id);
      addToast("Company deleted successfully!", "success");
      setShowDeleteModal(false);
      fetchCompanies();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to delete company.", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!canViewCompanies) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-[#051422] border border-slate-200 dark:border-[#0d2336] rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-3xl mb-4 animate-bounce">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
          You do not have permissions to view companies directory. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <PageHeader
        title="Companies Directory"
        description="Manage enterprise companies, system registrations, and tax configurations."
        action={
          showAddCompany && (
            <Button onClick={handleOpenCreateModal} icon={<FiPlus />}>
              Create Company
            </Button>
          )
        }
      />

      <Card className="p-0 overflow-visible" bodyClassName="p-0">
        <Table
          headers={["Company Details", "Tax Code / Website", "Location / Address", "Status", "Actions"]}
          loading={loading}
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        >
          {companies.map((company) => (
            <tr
              key={company.id}
              className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
            >
              <td className="py-4 px-5">
                <div className="flex items-center gap-3">
                  {company.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.company_name}
                      className="h-10 w-10 shrink-0 object-contain rounded-xl border border-slate-200 bg-white p-0.5"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 text-lg font-bold">
                      <FiBriefcase />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">
                      {company.company_name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      Code: <span className="font-semibold text-slate-600 dark:text-slate-300">{company.company_code}</span>
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-5 text-xs space-y-1">
                {company.gst_number && (
                  <p className="text-slate-500 dark:text-slate-400 font-mono">
                    GST: <span className="font-semibold">{company.gst_number}</span>
                  </p>
                )}
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 font-semibold"
                  >
                    <FiGlobe className="shrink-0" />
                    <span>{company.website}</span>
                  </a>
                )}
              </td>
              <td className="py-4 px-5 text-xs space-y-1 text-slate-500 dark:text-slate-400">
                <p className="flex items-center gap-1">
                  <FiMail className="shrink-0 text-slate-400" />
                  <span>{company.email}</span>
                </p>
                {company.phone_number && (
                  <p className="flex items-center gap-1">
                    <FiPhone className="shrink-0 text-slate-400" />
                    <span>{company.phone_number}</span>
                  </p>
                )}
                {(company.city || company.country) && (
                  <p className="flex items-center gap-1 text-[10px] text-slate-400">
                    <FiMapPin className="shrink-0" />
                    <span>{[company.city, company.state, company.country].filter(Boolean).join(", ")}</span>
                  </p>
                )}
              </td>
              <td className="py-4 px-5">
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${company.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                  <FiCheckCircle className="text-xs" />
                  <span>{company.is_active ? "Active" : "Inactive"}</span>
                </span>
              </td>
              <td className="py-4 px-5 text-right">
                <div className="flex justify-end gap-2">
                  {canUpdateCompany && (
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(company)} icon={<FiEdit2 />}>
                      Edit
                    </Button>
                  )}
                  {canDeleteCompany && (
                    <Button variant="danger" size="sm" onClick={() => handleOpenDeleteModal(company)} icon={<FiTrash2 />}>
                      Delete
                    </Button>
                  )}
                  {!canUpdateCompany && !canDeleteCompany && (
                    <span className="text-xs text-slate-400 italic">No permissions</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Create & Edit Company Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
        }}
        title={showCreateModal ? "Create Enterprise Company" : "Edit Enterprise Company"}
      >
        <form onSubmit={showCreateModal ? handleCreateCompany : handleUpdateCompany} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Company Name *"
              required
              placeholder="Acme Corp"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
            <Input
              label="Company Code *"
              required
              placeholder="ACM"
              value={formData.company_code}
              onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              required
              type="email"
              placeholder="info@acme.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="Phone Number"
              placeholder="1234567890"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Website URL"
              type="url"
              placeholder="https://acme.com"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
            <Input
              label="GST Number"
              placeholder="GST123456"
              value={formData.gst_number}
              onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Company Logo (PNG, JPG, WEBP, SVG)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              {formData.logo_url && !logoFile && (
                <img
                  src={formData.logo_url}
                  alt="Company Logo"
                  className="h-8 w-auto object-contain rounded border border-slate-200"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Address Line 1"
              placeholder="123 Main St"
              value={formData.address_line_1}
              onChange={(e) => setFormData({ ...formData, address_line_1: e.target.value })}
            />
            <Input
              label="Address Line 2"
              placeholder="Suite 100"
              value={formData.address_line_2}
              onChange={(e) => setFormData({ ...formData, address_line_2: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <Input
                label="City"
                placeholder="Metropolis"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <Input
              label="State"
              placeholder="NY"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
            <Input
              label="Zip Code"
              placeholder="10001"
              value={formData.postal_code}
              onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Country"
              placeholder="USA"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</label>
              <div className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  id="is_active"
                  className="h-4 w-4 rounded border-slate-350 text-primary focus:ring-primary cursor-pointer"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Company Active
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={creating || updating}>
              {showCreateModal ? "Create Company" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Company?">
        {selectedCompany && (
          <div className="space-y-4">
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-white">{selectedCompany.company_name}</span>? This action is permanent and cannot be undone. All locations mapped to this company may become unreachable.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" type="button" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteCompany} loading={deleting}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
