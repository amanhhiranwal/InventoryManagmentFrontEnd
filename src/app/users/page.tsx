"use client";

import { useEffect, useState, useCallback } from "react";
import { AxiosError } from "axios";
import { getUsersApi, createUserApi, updateUserApi, deleteUserApi, User } from "@/features/users/api/users.api";
import { getRolesApi, Role } from "@/features/rbac/api/rbac.api";
import { getCompaniesApi, Company } from "@/features/companies/api/companies.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import { useUIStore } from "@/lib/store/ui.store";
import { FiPlus, FiSearch, FiUser, FiMail, FiPhone, FiTag, FiCheckCircle, FiLock, FiBriefcase, FiEdit3, FiTrash2, FiEdit2 } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import SearchableMultiSelect from "@/components/ui/SearchableMultiSelect";

export default function UserListPage() {
  const { addToast } = useUIStore();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  const [searchQuery, setSearchQuery] = useState("");

  // Create User Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
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

  // Edit User Profile Modal States
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editCompanyIds, setEditCompanyIds] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  // Delete User Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentUser = useAuthStore((state) => state.user);
  const superAdmin = currentUser?.is_super_admin === true;
  const canReadUsers = hasPermission("user.read");
  const canUpdateRole = hasPermission("user.update");
  const showAddUser = superAdmin;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const hasCompanyView = hasPermission("company.view");
      const hasRoleRead = hasPermission("role.read");

      const [usersResponse, rolesData, companiesData] = await Promise.all([
        getUsersApi(currentPage, pageSize),
        hasRoleRead ? getRolesApi() : Promise.resolve([]),
        hasCompanyView ? getCompaniesApi().then((res) => res.data) : Promise.resolve([]),
      ]);
      setUsers(usersResponse.data);
      setTotalItems(usersResponse.total);
      setRoles(rolesData);
      setCompanies(companiesData);
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(
        axiosError.response?.data?.message || "Failed to fetch users or roles dashboard data.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage, addToast]);

  useEffect(() => {
    if (canReadUsers) {
      fetchData();
    }
  }, [canReadUsers, fetchData]);

  const handleOpenEditModal = (u: User) => {
    setEditUser(u);
    setEditFirstName(u.first_name);
    setEditLastName(u.last_name);
    setEditPhoneNumber(u.phone_number || "");
    setEditEmployeeId(u.employee_id || "");
    setEditRoleIds(u.role_ids || []);
    setEditCompanyIds(u.company_ids || []);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    if (!editFirstName || !editLastName) {
      addToast("First name and Last name are required.", "warning");
      return;
    }

    try {
      setUpdating(true);
      await updateUserApi(editUser.id, {
        first_name: editFirstName,
        last_name: editLastName,
        phone_number: editPhoneNumber,
        employee_id: editEmployeeId,
        role_ids: editRoleIds,
        company_ids: editCompanyIds,
      });
      addToast("User updated successfully!", "success");
      setEditUser(null);
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to update user.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenDeleteModal = (u: User) => {
    setUserToDelete(u);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setDeleting(true);
      await deleteUserApi(userToDelete.id);
      addToast("User deleted successfully!", "success");
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to delete user.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.email || !formData.password) {
      addToast("First name, email, and password are required.", "warning");
      return;
    }

    try {
      setCreating(true);
      await createUserApi(formData);
      addToast("User created successfully!", "success");
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        phone_number: "",
        employee_id: "",
        role_ids: [],
        company_ids: [],
      });
      setShowCreateModal(false);
      fetchData(); // Refresh list
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to create user.", "error");
    } finally {
      setCreating(false);
    }
  };

  if (!canReadUsers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-[#051422] border border-slate-200 dark:border-[#0d2336] rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-3xl mb-4 animate-bounce">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
          You do not have permissions to read user profiles. If you believe this is an error, please contact your administrator.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="View profiles, register new team members, and manage roles and authorization policies."
        action={
          showAddUser && (
            <Button onClick={() => setShowCreateModal(true)} icon={<FiPlus />}>
              Add User
            </Button>
          )
        }
      />

      <Card className="p-0 overflow-visible" bodyClassName="p-0">
        <div className="p-5 border-b border-slate-100 dark:border-[#0d2336]">
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <FiSearch />
            </span>
            <input
              type="text"
              placeholder="Search users by name or email..."
              className="
                w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929]
              "
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Table
          headers={["User", "Roles", "Companies", "ID / Details", "Actions"]}
          loading={loading}
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        >
          {filteredUsers.map((u) => {
            const userRoles = roles.filter((r) => u.role_ids?.includes(r.id));
            const userCompanies = companies.filter((c) => u.company_ids?.includes(c.id));

            return (
              <tr
                key={u.id}
                className="group hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
              >
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light/30 dark:bg-primary-light/5 text-primary text-base font-bold">
                      {u.first_name?.[0]?.toUpperCase() || <FiUser />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white text-sm">
                        {u.first_name} {u.last_name}
                        {u.is_super_admin && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                            Super Admin
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <FiMail className="shrink-0" />
                        <span>{u.email}</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-5">
                  <div className="flex flex-wrap gap-1.5">
                    {userRoles.length > 0 ? (
                      userRoles.map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-[#0d2336] px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          <FiTag className="text-[10px]" />
                          {r.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No Roles</span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-5">
                  <div className="flex flex-wrap gap-1.5">
                    {userCompanies.length > 0 ? (
                      userCompanies.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                        >
                          {c.company_name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No Companies</span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-5">
                  <div className="text-xs space-y-0.5">
                    <p className="text-slate-400">
                      Emp ID: <span className="font-semibold text-slate-600 dark:text-slate-300">{u.employee_id || "N/A"}</span>
                    </p>
                    <p className="text-slate-400 flex items-center gap-1">
                      <FiPhone className="shrink-0 text-[10px]" />
                      <span>{u.phone_number || "N/A"}</span>
                    </p>
                  </div>
                </td>
                <td className="py-4 px-5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {canUpdateRole && !u.is_super_admin && (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-[#0d2336] rounded-lg transition-all border-none bg-transparent cursor-pointer"
                          title="Edit User Profile"
                        >
                          <FiEdit2 className="text-sm" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(u)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-[#0d2336] rounded-lg transition-all border-none bg-transparent cursor-pointer"
                          title="Delete User"
                        >
                          <FiTrash2 className="text-sm" />
                        </button>
                      </>
                    )}
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold text-xs ml-2">
                      <FiCheckCircle />
                      <span>Active</span>
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {/* User Creation Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New User">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              required
              placeholder="Jane"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            />
            <Input
              label="Last Name"
              placeholder="Doe"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            />
          </div>

          <Input
            label="Email Address"
            required
            type="email"
            placeholder="jane.doe@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            label="Password"
            required
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              placeholder="1234567890"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            />
            <Input
              label="Employee ID"
              placeholder="EMP-001"
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            />
          </div>

          <SearchableMultiSelect
            label="Assigned Roles"
            placeholder="Select roles..."
            options={roles.map((r) => ({ id: r.id, name: r.name }))}
            selectedIds={formData.role_ids}
            onChange={(ids) => setFormData({ ...formData, role_ids: ids })}
          />

          <SearchableMultiSelect
            label="Assigned Companies"
            placeholder="Select companies..."
            options={companies.map((c) => ({ id: c.id, name: c.company_name }))}
            selectedIds={formData.company_ids}
            onChange={(ids) => setFormData({ ...formData, company_ids: ids })}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Profile Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User Profile">
        {editUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                required
                placeholder="John"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
              />
              <Input
                label="Last Name"
                required
                placeholder="Doe"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                placeholder="1234567890"
                value={editPhoneNumber}
                onChange={(e) => setEditPhoneNumber(e.target.value)}
              />
              <Input
                label="Employee ID"
                placeholder="EMP-001"
                value={editEmployeeId}
                onChange={(e) => setEditEmployeeId(e.target.value)}
              />
            </div>

            <SearchableMultiSelect
              label="Assigned Roles"
              placeholder="Select roles..."
              options={roles.map((r) => ({ id: r.id, name: r.name }))}
              selectedIds={editRoleIds}
              onChange={(ids) => setEditRoleIds(ids)}
            />

            <SearchableMultiSelect
              label="Assigned Companies"
              placeholder="Select companies..."
              options={companies.map((c) => ({ id: c.id, name: c.company_name }))}
              selectedIds={editCompanyIds}
              onChange={(ids) => setEditCompanyIds(ids)}
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" type="button" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={updating}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete User Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setUserToDelete(null); }} title="Delete User Profile">
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-white">{userToDelete.first_name} {userToDelete.last_name}</span>? This action is permanent and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteUser} loading={deleting}>
                Delete User
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
