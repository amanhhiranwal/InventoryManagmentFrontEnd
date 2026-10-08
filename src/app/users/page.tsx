"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import { getUsersApi, createUserApi, updateUserApi, deleteUserApi, User } from "@/features/users/api/users.api";
import { getRolesApi, Role } from "@/features/rbac/api/rbac.api";
import { getCompaniesApi, Company } from "@/features/companies/api/companies.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import api from "@/lib/axios";
import { hasPermission } from "@/features/auth/utils/permissions";
import { FiPlus, FiUser, FiMail, FiCheckCircle, FiSlash, FiTrash2, FiEdit2 } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import {
  ListPage,
  ListToolbar,
  PrimaryAction,
} from "@/components/crm/ListPageShell";
import ListActionsMenu, {
  ExportColumn,
} from "@/components/crm/ListActions";
import Table from "@/components/ui/Table";
import SearchableMultiSelect from "@/components/ui/SearchableMultiSelect";
import { eligibleManagers, userLabel } from "@/features/users/utils/hierarchy";

/** The manager a user reports to. With the role hierarchy on the Workflows
    page it decides whose records each manager sees: a Zonal Head sees only
    the Area Managers who report to them.

    Only people above the chosen role are offered, so an Area Manager can be
    put under a Zonal Head but never under another Area Manager. */
function ReportsToSelect({
  value,
  onChange,
  users,
  roles,
  roleIds,
  excludeUserId,
}: {
  value: string;
  onChange: (id: string) => void;
  users: User[];
  roles: Role[];
  roleIds: string[];
  excludeUserId?: string;
}) {
  const options = eligibleManagers(users, roleIds, roles, excludeUserId);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Reports To
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary"
      >
        <option value="">No manager</option>
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {userLabel(u, roles)}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-400">
        {roleIds.length === 0
          ? "Pick a role first to see who this user can report to."
          : options.length === 0
            ? "Nobody holds a role above this one yet."
            : "Their manager sees every lead, opportunity and order this user works on."}
      </p>
    </div>
  );
}

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
    location: "",
    role_ids: [] as string[],
    company_ids: [] as string[],
    reports_to_id: "",
  });

  /* Everyone the Reports To picker can offer - the table only holds one
     page of users, so it is loaded separately. */
  const [managerOptions, setManagerOptions] = useState<User[]>([]);

  // Edit User Profile Modal States
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* Switching somebody off signs them out of a session they are in the
     middle of, so it is asked rather than done on one click - the same
     way deleting is. */
  const [toToggle, setToToggle] = useState<User | null>(null);

  /* Switching somebody off signs them out and stops the password working.
     Kept apart from delete: a person who has left still owns the leads
     they raised, and those have to keep pointing at somebody. */
  const toggleActive = async (u: User) => {
    setTogglingId(u.id);
    setToToggle(null);

    try {
      const { data } = await api.put(`/api/v1/users/${u.id}/status`, {
        is_active: !u.is_active,
      });

      addToast(data?.message || "Account updated.", "success");

      await fetchData();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That account could not be changed.";
      addToast(detail, "error");
    } finally {
      setTogglingId(null);
    }
  };
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editCompanyIds, setEditCompanyIds] = useState<string[]>([]);
  const [editReportsToId, setEditReportsToId] = useState("");
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

      const [usersResponse, rolesData, companiesData, everyone] = await Promise.all([
        getUsersApi(currentPage, pageSize),
        hasRoleRead ? getRolesApi() : Promise.resolve([]),
        hasCompanyView ? getCompaniesApi().then((res) => res.data) : Promise.resolve([]),
        getUsersApi(1, 500, { skipErrorToast: true }).catch(() => ({ data: [] as User[], total: 0 })),
      ]);
      setUsers(usersResponse.data);
      setManagerOptions(everyone.data);
      setTotalItems(usersResponse.total);
      setRoles(rolesData);
      setCompanies(companiesData);
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string; detail?: string }>;
      addToast(
        axiosError.response?.data?.detail || axiosError.response?.data?.message || "Failed to fetch users or roles dashboard data.",
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
    setEditEmail(u.email || "");
    setEditLocation(u.location || "");
    setEditRoleIds(u.role_ids || []);
    setEditCompanyIds(u.company_ids || []);
    setEditReportsToId(u.reports_to_id || "");
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
        email: editEmail,
        location: editLocation,
        role_ids: editRoleIds,
        company_ids: editCompanyIds,
        reports_to_id: editReportsToId || null,
      });
      addToast("User updated successfully!", "success");
      setEditUser(null);
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string; detail?: string }>;
      addToast(axiosError.response?.data?.detail || axiosError.response?.data?.message || "Failed to update user.", "error");
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
      const axiosError = err as AxiosError<{ message?: string; detail?: string }>;
      addToast(axiosError.response?.data?.detail || axiosError.response?.data?.message || "Failed to delete user.", "error");
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
      await createUserApi({
        ...formData,
        reports_to_id: formData.reports_to_id || null,
      });
      addToast("User created successfully!", "success");
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        phone_number: "",
        employee_id: "",
    location: "",
        role_ids: [],
        company_ids: [],
        reports_to_id: "",
      });
      setShowCreateModal(false);
      fetchData(); // Refresh list
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string; detail?: string }>;
      addToast(axiosError.response?.data?.detail || axiosError.response?.data?.message || "Failed to create user.", "error");
    } finally {
      setCreating(false);
    }
  };

  /* A user as a spreadsheet row. Built here rather than at module level
     because the company names come from the companies this page loaded. */
  const userColumns: ExportColumn<User>[] = useMemo(
    () => [
      {
        header: "Name",
        value: (u) => `${u.first_name || ""} ${u.last_name || ""}`.trim(),
      },
      { header: "Email", value: (u) => u.email },
      { header: "Employee ID", value: (u) => u.employee_id || "" },
      { header: "Phone", value: (u) => u.phone_number || "" },
      { header: "Roles", value: (u) => (u.role_names || []).join(" / ") },
      {
        header: "Companies",
        value: (u) =>
          companies
            .filter((c) => u.company_ids?.includes(c.id))
            .map((c) => c.company_name)
            .join(" / "),
      },
      { header: "Reports To", value: (u) => u.reports_to_name || "" },
      { header: "Super Admin", value: (u) => (u.is_super_admin ? "Yes" : "No") },
    ],
    [companies],
  );

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
    <ListPage>
      <PageHeader
        title="User Management"
        description="View profiles, register new team members, and manage roles and authorization policies."
        action={
          <ListActionsMenu
            name="Users"
            rows={filteredUsers}
            columns={userColumns}
          />
        }
      />

      <ListToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search users by name or email"
        trailing={
          showAddUser ? (
            <PrimaryAction
              onClick={() => setShowCreateModal(true)}
              icon={<FiPlus size={14} />}
            >
              Add User
            </PrimaryAction>
          ) : undefined
        }
      />

        <Table
          headers={[
            "User",
            "Role",
            "Location",
            "Reports To",
            "Emp ID",
            "Companies",
            "Status",
            "Actions",
          ]}
          loading={loading}
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        >
        {filteredUsers.map((u) => {
          /* The roles master is only loaded for someone allowed
             to read it. Without it, fall back to the names the
             user record carries, so the column reads "Area
             Manager" rather than claiming they have no role. */
          const userRoles = roles.length
            ? roles.filter((r) => u.role_ids?.includes(r.id))
            : (u.role_names || []).map((name, i) => ({
                id: `${u.id}-${i}`,
                name,
              }));

          const userCompanies = companies.filter((c) =>
            u.company_ids?.includes(c.id),
          );

          return (
            <tr
              key={u.id}
              className="border-t border-[#f0f0f0] transition hover:bg-slate-50/60 dark:border-[#0d2336] dark:hover:bg-[#071929]/30"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light/30 text-sm font-bold text-primary dark:bg-primary-light/5">
                    {u.first_name?.[0]?.toUpperCase() || <FiUser />}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white">
                      {u.first_name} {u.last_name}

                      {u.is_super_admin && (
                        <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Super Admin
                        </span>
                      )}
                    </p>

                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[#777777] dark:text-slate-400">
                      <FiMail className="shrink-0" size={10} />
                      {u.email}
                    </p>
                  </div>
                </div>
              </td>

              <td className="px-4 py-3">
                {userRoles.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {userRoles.map((r) => (
                      <span
                        key={r.id}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-[#0d2336] dark:text-slate-300"
                      >
                        {r.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">—</span>
                )}
              </td>

              <td className="px-4 py-3 text-[12px] text-slate-600 dark:text-slate-300">
                {u.location || "—"}
              </td>

              <td className="px-4 py-3 text-[12px] text-slate-600 dark:text-slate-300">
                {u.reports_to_name || "—"}
              </td>

              <td className="px-4 py-3 text-[12px] text-slate-600 dark:text-slate-300">
                {u.employee_id || "—"}
              </td>

              <td className="px-4 py-3">
                {userCompanies.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {userCompanies.map((c) => (
                      <span
                        key={c.id}
                        className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        {c.company_name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">All</span>
                )}
              </td>

              {/* The status is the switch: reading it and changing it
                  are the same gesture, so there is no second control in
                  Actions saying the same thing. A super admin's own row,
                  and anyone who may not update users, get the plain chip
                  because pressing it would do nothing. */}
              <td className="px-4 py-3">
                {canUpdateRole && !u.is_super_admin ? (
                  <button
                    type="button"
                    onClick={() => setToToggle(u)}
                    disabled={togglingId === u.id}
                    title={
                      u.is_active === false
                        ? `Switch ${u.first_name} back on`
                        : `Switch ${u.first_name} off`
                    }
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-full border-none px-2 py-0.5 text-[11px] font-semibold transition hover:ring-1 disabled:opacity-50 ${
                      u.is_active === false
                        ? "bg-slate-100 text-slate-500 hover:ring-slate-300 dark:bg-[#0d2336] dark:text-slate-400"
                        : "bg-emerald-50 text-emerald-600 hover:ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400"
                    }`}
                  >
                    {u.is_active === false ? <FiSlash size={10} /> : <FiCheckCircle size={10} />}
                    {u.is_active === false ? "Inactive" : "Active"}
                  </button>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      u.is_active === false
                        ? "bg-slate-100 text-slate-500 dark:bg-[#0d2336] dark:text-slate-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                    }`}
                  >
                    {u.is_active === false ? <FiSlash size={10} /> : <FiCheckCircle size={10} />}
                    {u.is_active === false ? "Inactive" : "Active"}
                  </span>
                )}
              </td>

              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-1">
                  {canUpdateRole && !u.is_super_admin && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        title={`Edit ${u.first_name}`}
                        className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-primary dark:hover:bg-[#0d2336]"
                      >
                        <FiEdit2 className="text-sm" />
                      </button>

                      <button
                        onClick={() => handleOpenDeleteModal(u)}
                        title={`Delete ${u.first_name}`}
                        className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-[#0d2336]"
                      >
                        <FiTrash2 className="text-sm" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
        </Table>

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

          {/* Where they are based. A city for most people, a state for
              those covering one - the staffing sheet records both, so it
              is typed rather than picked from the Locations master. */}
          <Input
            label="Location"
            placeholder="e.g. Delhi/NCR"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />

          <SearchableMultiSelect
            label="Assigned Roles"
            placeholder="Select roles..."
            options={roles.map((r) => ({ id: r.id, name: r.name }))}
            selectedIds={formData.role_ids}
            onChange={(ids) => setFormData({ ...formData, role_ids: ids })}
          />

          <ReportsToSelect
            value={formData.reports_to_id}
            onChange={(id) => setFormData({ ...formData, reports_to_id: id })}
            users={managerOptions}
            roles={roles}
            roleIds={formData.role_ids}
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

            {/* The address they sign in with, so correcting one does not
                mean deleting the account and losing everything it owns. */}
            <Input
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <p className="-mt-2 text-[11px] text-slate-400">
              This is their login. Changing it means they sign in with the
              new address from then on.
            </p>

            <Input
              label="Location"
              placeholder="e.g. Delhi/NCR"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
            />

            <SearchableMultiSelect
              label="Assigned Roles"
              placeholder="Select roles..."
              options={roles.map((r) => ({ id: r.id, name: r.name }))}
              selectedIds={editRoleIds}
              onChange={(ids) => setEditRoleIds(ids)}
            />

            <ReportsToSelect
              value={editReportsToId}
              onChange={setEditReportsToId}
              users={managerOptions}
              roles={roles}
              roleIds={editRoleIds}
              excludeUserId={editUser.id}
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

      {/* Switching an account off signs somebody out mid-session and
          stops their password working, so it is asked for rather than
          done on one click. */}
      {toToggle && (
        <Modal
          isOpen
          onClose={() => setToToggle(null)}
          title={
            toToggle.is_active === false
              ? "Switch this account back on"
              : "Switch this account off"
          }
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {toToggle.is_active === false ? (
                <>
                  Switch{" "}
                  <span className="font-bold text-slate-800 dark:text-white">
                    {toToggle.first_name} {toToggle.last_name}
                  </span>{" "}
                  back on? Their password will work again and they will be
                  able to sign in.
                </>
              ) : (
                <>
                  Switch{" "}
                  <span className="font-bold text-slate-800 dark:text-white">
                    {toToggle.first_name} {toToggle.last_name}
                  </span>{" "}
                  off? They are signed out straight away, even if they are
                  working now, and their password stops working. Everything
                  they raised stays where it is, and you can switch them
                  back on at any time.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setToToggle(null)}>
                Cancel
              </Button>

              <Button
                variant={toToggle.is_active === false ? "primary" : "danger"}
                loading={togglingId === toToggle.id}
                onClick={() => toggleActive(toToggle)}
              >
                {toToggle.is_active === false ? "Switch On" : "Switch Off"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
    </ListPage>
  );
}
