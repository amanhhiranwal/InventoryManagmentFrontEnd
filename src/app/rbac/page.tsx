"use client";

import { useEffect, useState, useCallback } from "react";
import { AxiosError } from "axios";
import {
  getRolesApi,
  getPermissionsApi,
  createRoleApi,
  createPermissionApi,
  deleteRoleApi,
  deletePermissionApi,
  assignPermissionToRoleApi,
  removePermissionFromRoleApi,
  getRolePermissionsApi,
  Role,
  Permission,
} from "@/features/rbac/api/rbac.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import { useUIStore } from "@/lib/store/ui.store";
import { FiPlus, FiTrash2, FiShield, FiLock, FiSearch, FiLayers } from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";

export default function RBACPage() {
  const { addToast } = useUIStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingRole, setCreatingRole] = useState(false);
  const [creatingPerm, setCreatingPerm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [roleForm, setRoleForm] = useState({ name: "", description: "" });
  const [permForm, setPermForm] = useState({ name: "", description: "" });

  // Selected role & permissions mapping state
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<Permission[]>([]);
  const [loadingRolePerms, setLoadingRolePerms] = useState(false);
  const [permSearchQuery, setPermSearchQuery] = useState("");
  const [togglingPermId, setTogglingPermId] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [permissionToDelete, setPermissionToDelete] = useState<Permission | null>(null);

  const user = useAuthStore((state) => state.user);
  const superAdmin = user?.is_super_admin === true;
  const canReadRBAC = hasPermission("role.read");

  const fetchRolePermissions = useCallback(async (roleId: string) => {
    try {
      setLoadingRolePerms(true);
      const data = await getRolePermissionsApi(roleId);
      setSelectedRolePermissions(data);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch role permissions.", "error");
    } finally {
      setLoadingRolePerms(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (selectedRoleId) {
      fetchRolePermissions(selectedRoleId);
    } else {
      setSelectedRolePermissions([]);
    }
  }, [selectedRoleId, fetchRolePermissions]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesData, permsData] = await Promise.all([
        getRolesApi(),
        getPermissionsApi(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to fetch RBAC configuration.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (canReadRBAC) {
      fetchData();
    }
  }, [canReadRBAC, fetchData]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name) {
      addToast("Role name is required.", "warning");
      return;
    }

    try {
      setCreatingRole(true);
      await createRoleApi(roleForm.name, roleForm.description);
      addToast("Role created successfully!", "success");
      setRoleForm({ name: "", description: "" });
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to create role.", "error");
    } finally {
      setCreatingRole(false);
    }
  };

  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permForm.name) {
      addToast("Permission name is required.", "warning");
      return;
    }

    try {
      setCreatingPerm(true);
      await createPermissionApi(permForm.name, permForm.description);
      addToast("Permission created successfully!", "success");
      setPermForm({ name: "", description: "" });
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to create permission.", "error");
    } finally {
      setCreatingPerm(false);
    }
  };

  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    const id = roleToDelete.id;
    try {
      setDeletingId(id);
      await deleteRoleApi(id);
      addToast("Role deleted successfully!", "success");
      if (selectedRoleId === id) {
        setSelectedRoleId(null);
      }
      setRoleToDelete(null);
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to delete role.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmDeletePermission = async () => {
    if (!permissionToDelete) return;
    const id = permissionToDelete.id;
    try {
      setDeletingId(id);
      await deletePermissionApi(id);
      addToast("Permission deleted successfully!", "success");
      setPermissionToDelete(null);
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to delete permission.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePermission = async (permissionId: string) => {
    if (!selectedRoleId) return;
    const isAssigned = selectedRolePermissions.some(p => p.id === permissionId);
    
    try {
      setTogglingPermId(permissionId);
      if (isAssigned) {
        await removePermissionFromRoleApi(selectedRoleId, permissionId);
        addToast("Permission removed from role successfully.", "success");
      } else {
        await assignPermissionToRoleApi(selectedRoleId, permissionId);
        addToast("Permission assigned to role successfully.", "success");
      }
      const updatedPerms = await getRolePermissionsApi(selectedRoleId);
      setSelectedRolePermissions(updatedPerms);
    } catch (err) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to update role permission.", "error");
    } finally {
      setTogglingPermId(null);
    }
  };

  if (!canReadRBAC) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-[#051422] border border-slate-200 dark:border-[#0d2336] rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-3xl mb-4 animate-bounce">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
          You do not have the required permissions to read authorization policies (RBAC configurations).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage security roles, operations permissions, and policy mappings across the system."
      />

      {loading ? (
        <Card className="p-20 flex flex-col items-center justify-center gap-3">
          <CgSpinner className="animate-spin text-4xl text-primary" />
          <p className="text-sm font-semibold text-slate-500">Loading security parameters...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Roles List */}
          <div className="space-y-6">
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                    <FiShield className="text-primary text-lg" />
                    <span>Security Roles</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold bg-slate-100 dark:bg-[#0d2336] px-2.5 py-1 rounded-full">
                    {roles.length} Roles
                  </span>
                </div>
              }
              className="h-full"
            >
              {superAdmin && (
                <form onSubmit={handleCreateRole} className="p-4 mb-4 rounded-xl border border-dashed border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/20 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Add New Security Role
                  </p>
                  <div className="space-y-2">
                    <Input
                      placeholder="Role Name (e.g. Manager)"
                      required
                      value={roleForm.name}
                      onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
                    />
                    <Input
                      placeholder="Role Description"
                      value={roleForm.description}
                      onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" loading={creatingRole} size="sm" className="w-full" icon={<FiPlus />}>
                    Save Role
                  </Button>
                </form>
              )}

              <div className="divide-y divide-slate-100 dark:divide-[#0d2336] max-h-[450px] overflow-y-auto pr-1">
                {roles.map((role) => (
                  <div 
                    key={role.id} 
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`py-3 px-3 -mx-2 rounded-xl flex items-center justify-between group cursor-pointer transition-all ${
                      selectedRoleId === role.id 
                        ? "bg-primary/5 dark:bg-primary/10 border-l-4 border-primary shadow-sm" 
                        : "hover:bg-slate-50 dark:hover:bg-[#071929]/30"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className={`font-bold text-sm ${selectedRoleId === role.id ? "text-primary dark:text-sky-400" : "text-slate-800 dark:text-white"}`}>
                        {role.name}
                      </p>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {role.description || <span className="italic">No description</span>}
                      </p>
                    </div>

                    {superAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoleToDelete(role);
                        }}
                        disabled={deletingId === role.id}
                        className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        title="Delete Role"
                      >
                        {deletingId === role.id ? (
                          <CgSpinner className="animate-spin text-sm" />
                        ) : (
                          <FiTrash2 className="text-sm" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Column 2: Role Permissions Configuration */}
          <div className="space-y-6">
            <Card
              title={
                selectedRoleId ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                        <FiLock className="text-primary text-lg" />
                        <span>Role Permissions</span>
                      </h3>
                      <p className="text-xs font-semibold text-primary dark:text-sky-400">
                        Configuring: {roles.find(r => r.id === selectedRoleId)?.name}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold bg-slate-100 dark:bg-[#0d2336] px-2.5 py-1 rounded-full">
                      {selectedRolePermissions.length} Active
                    </span>
                  </div>
                ) : (
                  <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                    <FiLock className="text-primary text-lg" />
                    <span>Role Permissions</span>
                  </h3>
                )
              }
              className="h-full flex flex-col"
            >
              {!selectedRoleId ? (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500 py-20">
                  <FiLayers className="text-5xl mb-3 text-slate-300 dark:text-slate-700 animate-pulse" />
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">No Role Selected</h4>
                  <p className="text-xs max-w-[200px] mt-1 text-slate-400">
                    Select a role from the left list to configure its active permissions.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-2.5 text-slate-400 text-sm" />
                    <input
                      type="text"
                      placeholder="Filter permissions..."
                      className="w-full rounded-lg border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#071929]/50 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all"
                      value={permSearchQuery}
                      onChange={(e) => setPermSearchQuery(e.target.value)}
                    />
                  </div>

                  {loadingRolePerms ? (
                    <div className="flex-grow flex flex-col items-center justify-center py-10 gap-2">
                      <CgSpinner className="animate-spin text-2xl text-primary" />
                      <p className="text-xs text-slate-400">Loading mappings...</p>
                    </div>
                  ) : (
                    <div className="flex-grow max-h-[350px] overflow-y-auto pr-1 space-y-2">
                      {permissions
                        .filter(perm => perm.name.toLowerCase().includes(permSearchQuery.toLowerCase()))
                        .map((perm) => {
                          const isAssigned = selectedRolePermissions.some(p => p.id === perm.id);
                          const isToggling = togglingPermId === perm.id;
                          
                          return (
                            <div 
                              key={perm.id} 
                              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all select-none ${
                                isAssigned 
                                  ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20" 
                                  : "bg-slate-50/50 dark:bg-[#071929]/20 border-slate-100 dark:border-[#0d2336]"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <p className={`font-bold text-xs ${isAssigned ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}>
                                  {perm.name}
                                </p>
                                <p className="text-[10px] text-slate-400 line-clamp-1">
                                  {perm.description || <span className="italic">No description</span>}
                                </p>
                              </div>

                              <Switch
                                checked={isAssigned}
                                loading={isToggling}
                                disabled={!superAdmin}
                                onChange={() => handleTogglePermission(perm.id)}
                              />
                            </div>
                          );
                        })}
                      
                      {permissions.filter(perm => perm.name.toLowerCase().includes(permSearchQuery.toLowerCase())).length === 0 && (
                        <div className="text-center py-6 text-xs text-slate-400">
                          No matching permissions found.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Column 3: System Permissions */}
          <div className="space-y-6">
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                    <FiLock className="text-sky-500 text-lg" />
                    <span>Permissions Registry</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold bg-slate-100 dark:bg-[#0d2336] px-2.5 py-1 rounded-full">
                    {permissions.length} Reg.
                  </span>
                </div>
              }
              className="h-full"
            >
              {superAdmin && (
                <form onSubmit={handleCreatePermission} className="p-4 mb-4 rounded-xl border border-dashed border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/20 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Register New Permission
                  </p>
                  <div className="space-y-2">
                    <Input
                      placeholder="Permission Key (e.g. user.write)"
                      required
                      value={permForm.name}
                      onChange={(e) => setPermForm((p) => ({ ...p, name: e.target.value }))}
                    />
                    <Input
                      placeholder="Permission Description"
                      value={permForm.description}
                      onChange={(e) => setPermForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" loading={creatingPerm} size="sm" className="w-full" icon={<FiPlus />}>
                    Save Permission
                  </Button>
                </form>
              )}

              <div className="divide-y divide-slate-100 dark:divide-[#0d2336] max-h-[450px] overflow-y-auto pr-1">
                {permissions.map((perm) => (
                  <div key={perm.id} className="py-3 flex items-center justify-between group">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800 dark:text-white text-xs">
                        {perm.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {perm.description || <span className="italic">No description</span>}
                      </p>
                    </div>

                    {superAdmin && (
                      <button
                        onClick={() => setPermissionToDelete(perm)}
                        disabled={deletingId === perm.id}
                        className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        title="Delete Permission"
                      >
                        {deletingId === perm.id ? (
                          <CgSpinner className="animate-spin text-sm" />
                        ) : (
                          <FiTrash2 className="text-xs" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Delete Role Modal */}
      {roleToDelete && (
        <Modal
          isOpen={!!roleToDelete}
          onClose={() => setRoleToDelete(null)}
          title="Delete Role"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to delete the role <span className="font-bold text-slate-800 dark:text-white">{roleToDelete.name}</span>? This will detach all associated permissions.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setRoleToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDeleteRole} loading={deletingId === roleToDelete.id}>
                Delete Role
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Permission Modal */}
      {permissionToDelete && (
        <Modal
          isOpen={!!permissionToDelete}
          onClose={() => setPermissionToDelete(null)}
          title="Delete Permission"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to delete the permission <span className="font-bold text-slate-800 dark:text-white">{permissionToDelete.name}</span>? This is permanent.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setPermissionToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDeletePermission} loading={deletingId === permissionToDelete.id}>
                Delete Permission
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
