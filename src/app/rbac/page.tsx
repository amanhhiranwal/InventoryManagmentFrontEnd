"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AxiosError } from "axios";
import {
  getRolesApi,
  getPermissionsApi,
  createRoleApi,
  createPermissionApi,
  deleteRoleApi,
  assignPermissionToRoleApi,
  removePermissionFromRoleApi,
  getRolePermissionsApi,
  Role,
  Permission,
} from "@/features/rbac/api/rbac.api";
import { getMenuTreeApi, DBMenuItem } from "@/features/menus/api/menus.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import { useUIStore } from "@/lib/store/ui.store";
import {
  FiPlus,
  FiTrash2,
  FiShield,
  FiLock,
  FiSearch,
  FiChevronDown,
  FiChevronRight,
  FiCheck,
  FiMinus,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";

function CustomCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center cursor-pointer shrink-0 ${
        disabled
          ? "opacity-40 cursor-not-allowed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400"
          : checked || indeterminate
          ? "bg-[#233353] dark:bg-sky-500 border-[#233353] dark:border-sky-500 text-white shadow-sm"
          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-[#071929] hover:border-[#233353] dark:hover:border-sky-400"
      }`}
    >
      {checked && !indeterminate && <FiCheck className="text-xs stroke-[3] text-white" />}
      {indeterminate && <FiMinus className="text-xs stroke-[3] text-white" />}
    </button>
  );
}

export default function RBACPage() {
  const { addToast } = useUIStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [dbMenuTree, setDbMenuTree] = useState<DBMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingRole, setCreatingRole] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [roleForm, setRoleForm] = useState({ name: "", description: "" });

  // Selected role & permissions mapping state
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<Permission[]>([]);
  const [loadingRolePerms, setLoadingRolePerms] = useState(false);
  const [permSearchQuery, setPermSearchQuery] = useState("");
  const [togglingPermKey, setTogglingPermKey] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  // Group Expand / Collapse State
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
      const [rolesData, permsData, menusData] = await Promise.all([
        getRolesApi(),
        getPermissionsApi(),
        getMenuTreeApi(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
      setDbMenuTree(menusData || []);
      
      // Auto-expand all loaded groups
      const initialExp: Record<string, boolean> = {};
      (menusData || []).forEach((g) => { initialExp[g.id] = true; });
      setExpandedGroups(initialExp);

      if (rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id);
      }
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to fetch RBAC configuration.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, selectedRoleId]);

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

  // Helper to ensure a permission exists in system registry before assigning to role
  const ensurePermissionExists = async (permKey: string): Promise<Permission | null> => {
    const existing = permissions.find((p) => p.name === permKey);
    if (existing) return existing;

    try {
      const created = await createPermissionApi(permKey, `Auto-registered system permission for ${permKey}`);
      setPermissions((prev) => [...prev, created]);
      return created;
    } catch {
      const recheck = permissions.find((p) => p.name === permKey);
      return recheck || null;
    }
  };

  // Toggle single permission key for selected role
  const handleTogglePermissionByKey = async (permKey: string) => {
    if (!selectedRoleId || !permKey) return;
    try {
      setTogglingPermKey(permKey);
      const permObj = await ensurePermissionExists(permKey);
      if (!permObj) {
        addToast(`Permission key '${permKey}' could not be registered.`, "error");
        return;
      }

      const isAssigned = selectedRolePermissions.some((p) => p.id === permObj.id || p.name === permKey);

      if (isAssigned) {
        await removePermissionFromRoleApi(selectedRoleId, permObj.id);
        addToast(`Removed '${permKey}' from role.`, "info");
      } else {
        await assignPermissionToRoleApi(selectedRoleId, permObj.id);
        addToast(`Assigned '${permKey}' to role!`, "success");
      }

      const updatedPerms = await getRolePermissionsApi(selectedRoleId);
      setSelectedRolePermissions(updatedPerms);
    } catch (err) {
      console.error(err);
      addToast("Failed to update role permission.", "error");
    } finally {
      setTogglingPermKey(null);
    }
  };

  // Group Checkbox toggle handler: Select all or Deselect all submenus under a group
  const handleToggleGroup = async (group: DBMenuItem) => {
    if (!selectedRoleId) return;
    const children = group.children || [];
    const allChildKeys = children
      .map((c) => c.permission_key)
      .filter((k): k is string => Boolean(k))
      .concat(group.permission_key ? [group.permission_key] : []);
    
    if (allChildKeys.length === 0) return;

    const assignedKeys = allChildKeys.filter((key) =>
      selectedRolePermissions.some((p) => p.name === key)
    );

    const shouldAssignAll = assignedKeys.length < allChildKeys.length;

    try {
      setTogglingPermKey(group.id);
      for (const key of allChildKeys) {
        const permObj = await ensurePermissionExists(key);
        if (!permObj) continue;

        const isCurrentlyAssigned = selectedRolePermissions.some(
          (p) => p.id === permObj.id || p.name === key
        );

        if (shouldAssignAll && !isCurrentlyAssigned) {
          await assignPermissionToRoleApi(selectedRoleId, permObj.id);
        } else if (!shouldAssignAll && isCurrentlyAssigned) {
          await removePermissionFromRoleApi(selectedRoleId, permObj.id);
        }
      }

      const updated = await getRolePermissionsApi(selectedRoleId);
      setSelectedRolePermissions(updated);
      addToast(
        shouldAssignAll
          ? `Enabled all '${group.title}' menu options!`
          : `Disabled all '${group.title}' menu options.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      addToast("Failed to update group permissions.", "error");
    } finally {
      setTogglingPermKey(null);
    }
  };

  // Quick Select All / Deselect All for entire application
  const handleSelectAllAll = async (select: boolean) => {
    if (!selectedRoleId) return;
    const allKeys = dbMenuTree.flatMap((g) => [
      ...(g.permission_key ? [g.permission_key] : []),
      ...(g.children || []).map((c) => c.permission_key).filter((k): k is string => Boolean(k))
    ]);

    try {
      setLoadingRolePerms(true);
      for (const key of allKeys) {
        const permObj = await ensurePermissionExists(key);
        if (!permObj) continue;

        const isAssigned = selectedRolePermissions.some(
          (p) => p.id === permObj.id || p.name === key
        );

        if (select && !isAssigned) {
          await assignPermissionToRoleApi(selectedRoleId, permObj.id);
        } else if (!select && isAssigned) {
          await removePermissionFromRoleApi(selectedRoleId, permObj.id);
        }
      }

      const updated = await getRolePermissionsApi(selectedRoleId);
      setSelectedRolePermissions(updated);
      addToast(select ? "Granted all menu permissions to role!" : "Revoked all menu permissions from role.", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to bulk update permissions.", "error");
    } finally {
      setLoadingRolePerms(false);
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
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

  const selectedRoleObj = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Permissions & Menu Matrix"
        description="Configure role-based sidebar menu permissions and security privileges across your organization."
      />

      {loading ? (
        <Card className="p-20 flex flex-col items-center justify-center gap-3">
          <CgSpinner className="animate-spin text-4xl text-[#233353] dark:text-sky-400" />
          <p className="text-sm font-semibold text-slate-500">Loading menu matrix...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMN 1: SECURITY ROLES LIST */}
          <div className="space-y-6 lg:col-span-1">
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                    <FiShield className="text-[#233353] dark:text-sky-400 text-lg" />
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
                      placeholder="Role Name (e.g. Area Head)"
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

              <div className="divide-y divide-slate-100 dark:divide-[#0d2336] max-h-[500px] overflow-y-auto pr-1 space-y-1">
                {roles.map((role) => {
                  const isSelected = selectedRoleId === role.id;
                  return (
                    <div 
                      key={role.id} 
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`py-3 px-3 rounded-xl flex items-center justify-between group cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-[#233353]/10 dark:bg-sky-500/10 border-l-4 border-[#233353] dark:border-sky-400 shadow-xs" 
                          : "hover:bg-slate-50 dark:hover:bg-[#071929]/30"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <p className={`font-bold text-sm truncate ${isSelected ? "text-[#233353] dark:text-sky-400" : "text-slate-800 dark:text-white"}`}>
                          {role.name}
                        </p>
                        <p className="text-xs text-slate-400 line-clamp-1 truncate">
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
                          className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50 shrink-0"
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
                  );
                })}
              </div>
            </Card>
          </div>

          {/* COLUMN 2 & 3: ROLE MENU ACCESS PERMISSION MATRIX (100% DATABASE-DRIVEN) */}
          <div className="space-y-6 lg:col-span-2">
            <Card
              title={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                      <FiLock className="text-[#233353] dark:text-sky-400 text-lg" />
                      <span>Role Menu Access Matrix</span>
                    </h3>
                    <p className="text-xs font-semibold text-[#233353] dark:text-sky-400">
                      Target Role: {selectedRoleObj?.name || "Select a role..."}
                    </p>
                  </div>

                  {selectedRoleId && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectAllAll(true)}
                        className="px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllAll(false)}
                        className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#071929] hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  )}
                </div>
              }
              className="h-full"
            >
              {!selectedRoleId ? (
                <div className="py-20 text-center text-slate-400">
                  Select a role from the left list to configure its menu access permissions.
                </div>
              ) : loadingRolePerms ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <CgSpinner className="animate-spin text-3xl text-[#233353] dark:text-sky-400" />
                  <p className="text-xs font-semibold text-slate-400">Compiling permission tree...</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Search Filter Bar */}
                  <div className="relative">
                    <FiSearch className="absolute left-3.5 top-3 text-slate-400 text-sm" />
                    <input
                      type="text"
                      placeholder="Search menu groups and submenus..."
                      value={permSearchQuery}
                      onChange={(e) => setPermSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#233353] dark:focus:border-sky-400 transition-all"
                    />
                  </div>

                  {/* Hierarchical Tree Container */}
                  <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                    {dbMenuTree.filter((group) => {
                      if (!permSearchQuery) return true;
                      const query = permSearchQuery.toLowerCase();
                      return (
                        group.title.toLowerCase().includes(query) ||
                        (group.children || []).some((child) => child.title.toLowerCase().includes(query))
                      );
                    }).map((group) => {
                      const isExpanded = expandedGroups[group.id] ?? true;
                      const children = group.children || [];

                      // Check submenus assigned for this group
                      const childPermKeys = children
                        .map((c) => c.permission_key)
                        .filter((k): k is string => Boolean(k));
                      
                      const assignedChildCount = childPermKeys.filter((key) =>
                        selectedRolePermissions.some((p) => p.name === key)
                      ).length;

                      const isAllChecked = assignedChildCount === childPermKeys.length && childPermKeys.length > 0;
                      const isIndeterminate = assignedChildCount > 0 && assignedChildCount < childPermKeys.length;
                      const isGroupToggling = togglingPermKey === group.id;

                      return (
                        <div
                          key={group.id}
                          className="rounded-2xl border border-slate-200/80 dark:border-[#0d2336] bg-white dark:bg-[#051422] overflow-hidden shadow-xs"
                        >
                          {/* Group Header Row */}
                          <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 dark:bg-[#071929]/50 border-b border-slate-100 dark:border-[#0d2336]">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleGroupExpand(group.id)}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-none bg-transparent cursor-pointer"
                              >
                                {isExpanded ? (
                                  <FiChevronDown className="text-base" />
                                ) : (
                                  <FiChevronRight className="text-base" />
                                )}
                              </button>

                              <div className="flex items-center gap-2">
                                <CustomCheckbox
                                  checked={isAllChecked}
                                  indeterminate={isIndeterminate}
                                  disabled={!superAdmin || isGroupToggling}
                                  onChange={() => handleToggleGroup(group)}
                                />
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white font-sans">
                                  {group.title}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0d2336] px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                                {assignedChildCount} / {childPermKeys.length} Submenus Enabled
                              </span>
                            </div>
                          </div>

                          {/* Submenus Tree Body */}
                          {isExpanded && children.length > 0 && (
                            <div className="p-3 pl-11 space-y-2 bg-white dark:bg-[#051422]">
                              {children
                                .filter((child) =>
                                  !permSearchQuery ||
                                  child.title.toLowerCase().includes(permSearchQuery.toLowerCase())
                                )
                                .map((child) => {
                                  const isChildAssigned = child.permission_key
                                    ? selectedRolePermissions.some((p) => p.name === child.permission_key)
                                    : false;

                                  return (
                                    <div
                                      key={child.id}
                                      onClick={() => {
                                        if (superAdmin && child.permission_key && togglingPermKey !== child.permission_key) {
                                          handleTogglePermissionByKey(child.permission_key);
                                        }
                                      }}
                                      className={`flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-[#0d2336] hover:bg-slate-50/50 dark:hover:bg-[#071929]/30 transition-all select-none ${
                                        superAdmin && child.permission_key ? "cursor-pointer" : "cursor-not-allowed"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <CustomCheckbox
                                          checked={isChildAssigned}
                                          disabled={!superAdmin || !child.permission_key || togglingPermKey === child.permission_key}
                                          onChange={() => child.permission_key && handleTogglePermissionByKey(child.permission_key)}
                                        />
                                        <div>
                                          <p className="text-xs font-bold text-slate-800 dark:text-white">
                                            {child.title}
                                          </p>
                                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                            Route: {child.path || "N/A"} | Key: {child.permission_key || "None"}
                                          </p>
                                        </div>
                                      </div>

                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          isChildAssigned
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            : "bg-slate-100 dark:bg-[#071929] text-slate-400"
                                        }`}
                                      >
                                        {isChildAssigned ? "Access Granted" : "Hidden"}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
    </div>
  );
}
