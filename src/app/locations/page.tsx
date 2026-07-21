"use client";

import { useEffect, useState, useCallback } from "react";
import { AxiosError } from "axios";
import {
  getLocationsApi,
  createLocationApi,
  updateLocationApi,
  deleteLocationApi,
  Location,
  CreateLocationPayload
} from "@/features/locations/api/locations.api";
import { getCompaniesApi, Company } from "@/features/companies/api/companies.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import { useUIStore } from "@/lib/store/ui.store";
import { FiPlus, FiMapPin, FiCheckCircle, FiBriefcase, FiEdit2, FiTrash2, FiMail, FiPhone } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";

export default function LocationsPage() {
  const { addToast } = useUIStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Filter state
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("");

  // Form states
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initialFormState: CreateLocationPayload = {
    location_name: "",
    location_code: "",
    company_id: "",
    email: "",
    phone_number: "",
    address_line_1: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
  };

  const [formData, setFormData] = useState<CreateLocationPayload>({ ...initialFormState });

  const user = useAuthStore((state) => state.user);
  const superAdmin = user?.is_super_admin === true;
  const canViewLocations = hasPermission("location.view");
  const canUpdateLocation = hasPermission("location.update");
  const canDeleteLocation = hasPermission("location.delete");
  const showAddLocation = superAdmin;

  const fetchLocationsAndCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const [locationsData, companiesResponse] = await Promise.all([
        getLocationsApi(currentPage, pageSize),
        getCompaniesApi(1, 100),
      ]);
      setLocations(locationsData.data);
      setTotalItems(locationsData.total);
      setCompanies(companiesResponse.data);
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to fetch locations dashboard data.", "error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, addToast]);

  useEffect(() => {
    if (canViewLocations) {
      fetchLocationsAndCompanies();
    }
  }, [canViewLocations, fetchLocationsAndCompanies]);

  const handleOpenCreateModal = () => {
    setFormData({ ...initialFormState, company_id: selectedCompanyFilter || "" });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (loc: Location) => {
    setSelectedLocation(loc);
    setFormData({
      location_name: loc.location_name,
      location_code: loc.location_code,
      company_id: loc.company_id,
      email: loc.email,
      phone_number: loc.phone_number || "",
      address_line_1: loc.address_line_1 || "",
      city: loc.city || "",
      state: loc.state || "",
      country: loc.country || "",
      postal_code: loc.postal_code || "",
    });
    setShowEditModal(true);
  };

  const handleOpenDeleteModal = (loc: Location) => {
    setSelectedLocation(loc);
    setShowDeleteModal(true);
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location_name || !formData.location_code || !formData.company_id || !formData.email) {
      addToast("Location name, code, company, and email are required.", "warning");
      return;
    }

    try {
      setCreating(true);
      await createLocationApi(formData);
      addToast("Location created successfully!", "success");
      setShowCreateModal(false);
      fetchLocationsAndCompanies();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to create location.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return;
    if (!formData.location_name || !formData.location_code || !formData.company_id || !formData.email) {
      addToast("Location name, code, company, and email are required.", "warning");
      return;
    }

    try {
      setUpdating(true);
      await updateLocationApi(selectedLocation.id, formData);
      addToast("Location updated successfully!", "success");
      setShowEditModal(false);
      fetchLocationsAndCompanies();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to update location.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!selectedLocation) return;
    try {
      setDeleting(true);
      await deleteLocationApi(selectedLocation.id);
      addToast("Location deleted successfully!", "success");
      setShowDeleteModal(false);
      fetchLocationsAndCompanies();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to delete location.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    return company ? company.company_name : "Unknown Company";
  };

  if (!canViewLocations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-[#051422] border border-slate-200 dark:border-[#0d2336] rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-3xl mb-4 animate-bounce">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
          You do not have permissions to view locations directory. Please contact your administrator.
        </p>
      </div>
    );
  }

  const filteredLocations = selectedCompanyFilter
    ? locations.filter((loc) => loc.company_id === selectedCompanyFilter)
    : locations;

  return (
    <div className="space-y-6 relative">
      <PageHeader
        title="Locations Directory"
        description="Monitor organizational warehouses, offices, and distribution nodes."
        action={
          showAddLocation && (
            <Button onClick={handleOpenCreateModal} icon={<FiPlus />}>
              Create Location
            </Button>
          )
        }
      />

      <Card className="p-0 overflow-visible" bodyClassName="p-0">
        {/* Filtering & Search Bar */}
        <div className="p-5 border-b border-slate-100 dark:border-[#0d2336]">
          <div className="w-full sm:w-72">
            <label className="block text-xs font-bold text-slate-405 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Filter by Company
            </label>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929] cursor-pointer"
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400 text-[10px]">
                ▼
              </span>
            </div>
          </div>
        </div>

        <Table
          headers={["Location", "Company Assignment", "Address", "Status", "Actions"]}
          loading={loading}
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        >
          {filteredLocations.map((loc) => (
            <tr
              key={loc.id}
              className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
            >
              <td className="py-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 text-lg font-bold">
                    <FiMapPin />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">
                      {loc.location_name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      Code: <span className="font-semibold text-slate-600 dark:text-slate-300">{loc.location_code}</span>
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-5">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <FiBriefcase className="text-slate-400 shrink-0 text-sm" />
                  <span>{getCompanyName(loc.company_id)}</span>
                </div>
              </td>
              <td className="py-4 px-5 text-xs space-y-1 text-slate-500 dark:text-slate-400">
                <p className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-xs">{loc.address_line_1 || <span className="italic text-slate-400 font-normal">No address</span>}</p>
                <p className="flex items-center gap-1">
                  <FiMail className="shrink-0 text-slate-400" />
                  <span>{loc.email}</span>
                </p>
                {loc.phone_number && (
                  <p className="flex items-center gap-1">
                    <FiPhone className="shrink-0 text-slate-400" />
                    <span>{loc.phone_number}</span>
                  </p>
                )}
              </td>
              <td className="py-4 px-5">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-500 px-2 py-0.5 text-xs font-semibold">
                  <FiCheckCircle className="text-xs" />
                  <span>Active</span>
                </span>
              </td>
              <td className="py-4 px-5 text-right">
                <div className="flex justify-end gap-2">
                  {canUpdateLocation && (
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(loc)} icon={<FiEdit2 />}>
                      Edit
                    </Button>
                  )}
                  {canDeleteLocation && (
                    <Button variant="danger" size="sm" onClick={() => handleOpenDeleteModal(loc)} icon={<FiTrash2 />}>
                      Delete
                    </Button>
                  )}
                  {!canUpdateLocation && !canDeleteLocation && (
                    <span className="text-xs text-slate-400 italic">No permissions</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Create & Edit Location Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
        }}
        title={showCreateModal ? "Create Location Node" : "Edit Location Node"}
      >
        <form onSubmit={showCreateModal ? handleCreateLocation : handleUpdateLocation} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Location Name *"
              required
              placeholder="Warehouse A"
              value={formData.location_name}
              onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
            />
            <Input
              label="Location Code *"
              required
              placeholder="WHA"
              value={formData.location_code}
              onChange={(e) => setFormData({ ...formData, location_code: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Enterprise Company *</label>
            <div className="relative">
              <select
                required
                className="w-full appearance-none rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-3.5 pr-8 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929] cursor-pointer"
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              >
                <option value="">Select Company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400 text-[10px]">
                ▼
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              required
              type="email"
              placeholder="warehouse@acme.com"
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

          <Input
            label="Physical Address Line 1"
            placeholder="e.g. 456 Industrial Blvd"
            value={formData.address_line_1}
            onChange={(e) => setFormData({ ...formData, address_line_1: e.target.value })}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="City"
              placeholder="Metropolis"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <Input
              label="State"
              placeholder="NY"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
            <Input
              label="Zip Code"
              placeholder="10002"
              value={formData.postal_code}
              onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
            />
          </div>

          <Input
            label="Country"
            placeholder="USA"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
          />

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
              {showCreateModal ? "Create Location" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Location?">
        {selectedLocation && (
          <div className="space-y-4">
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-white">{selectedLocation.location_name}</span>? This action is permanent and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" type="button" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteLocation} loading={deleting}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
