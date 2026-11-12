"use client";

/**
 * Departments master, under Masters.
 *
 * The departments people work in. A department's head is the second
 * approver on mid-value purchase requisitions, and a person's department
 * (set on Users) fills the PR form. Changes need procurement_masters.manage,
 * which the server checks; a department in use cannot be deleted - the
 * server refuses and says why - so switch it off instead.
 */

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiGrid, FiPlus, FiTrash2 } from "react-icons/fi";

import { ListPage, ListToolbar, PrimaryAction } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  deleteDepartmentApi,
  errorDetail,
  getDepartmentsApi,
  saveDepartmentApi,
  type Department,
} from "@/features/procurement/api/procurement.api";
import { ErrorState, INPUT, LABEL } from "@/features/procurement/components/shared";
import { getUsersApi, type User } from "@/features/users/api/users.api";
import { useUIStore } from "@/lib/store/ui.store";

export default function DepartmentsPage() {
  const { addToast } = useUIStore();
  const canManage = hasPermission("procurement_masters.manage");

  const [rows, setRows] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<User[]>([]);

  const [editing, setEditing] = useState<Department | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [head, setHead] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getDepartmentsApi());
    } catch (failure) {
      setError(errorDetail(failure, "Could not load departments."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (department: Department | null) => {
    setEditing(department);
    setName(department?.name || "");
    setCode(department?.code || "");
    setHead(department?.head_user_id || "");
    setActive(department?.is_active ?? true);
    setShowForm(true);
    if (!people.length) {
      getUsersApi(1, 500, { skipErrorToast: true })
        .then((answer) => setPeople(answer.data.filter((u) => u.is_active !== false)))
        .catch(() => addToast("Could not load people for the department head list.", "error"));
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return addToast("A department needs a name.", "warning");
    setSaving(true);
    try {
      await saveDepartmentApi(
        { name: name.trim(), code: code.trim() || null, head_user_id: head || null, is_active: active },
        editing?.id,
      );
      addToast(editing ? "Department updated." : "Department added.", "success");
      setShowForm(false);
      load();
    } catch {
      /* the server's reason is shown by the API client */
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteDepartmentApi(toDelete.id);
      addToast("Department removed.", "success");
      setToDelete(null);
      load();
    } catch {
      /* the server says why (people or requisitions use it) */
    } finally {
      setDeleting(false);
    }
  };

  const term = search.trim().toLowerCase();
  const shown = rows.filter((d) => [d.name, d.code, d.head_name].filter(Boolean).some((f) => String(f).toLowerCase().includes(term)));

  return (
    <ListPage>
      <PageHeader
        title="Departments Master"
        description="Where people work. The department head approves purchase requisitions in the middle amount band; a person's department is set on Users."
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search departments"
        trailing={canManage ? <PrimaryAction onClick={() => openForm(null)} icon={<FiPlus size={14} />}>Add Department</PrimaryAction> : undefined}
      />

      {error ? (
        <ErrorState text={error} onRetry={load} />
      ) : (
        <Table headers={["Department", "Code", "Head", "People", "Status", "Actions"]} loading={loading}>
          {shown.length === 0 && !loading ? (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-[13px] text-[#777777]">
                {term ? "No departments match." : "No departments yet. Until one exists, the PR form does not ask for a department."}
              </td>
            </tr>
          ) : (
            shown.map((d) => (
              <tr key={d.id} className="transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-[#071929]/20">
                <td className="px-5 py-4 text-sm font-bold text-slate-800 dark:text-white">
                  <div className="flex items-center gap-2"><FiGrid className="text-primary" />{d.name}</div>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-slate-500">{d.code || "-"}</td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{d.head_name || "-"}</td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{d.members ?? 0}</td>
                <td className="px-5 py-4 text-sm">{d.is_active ? <span className="text-emerald-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                <td className="px-5 py-4 text-right">
                  {canManage && (
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => openForm(d)} aria-label={`Edit ${d.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#233353] dark:hover:bg-[#0d2336]">
                        <FiEdit2 className="text-sm" />
                      </button>
                      <button type="button" onClick={() => setToDelete(d)} aria-label={`Delete ${d.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-[#0d2336]">
                        <FiTrash2 className="text-sm" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Department" : "Add Department"}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Department Name *" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Code" placeholder="e.g. SCM" value={code} onChange={(e) => setCode(e.target.value)} />
          <div>
            <label className={LABEL} htmlFor="dept-head">Department Head</label>
            <select id="dept-head" className={INPUT} value={head} onChange={(e) => setHead(e.target.value)}>
              <option value="">Not set — a super admin approves instead</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{`${p.first_name} ${p.last_name}`.trim()}{p.role_names?.length ? ` (${p.role_names.join(", ")})` : ""}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#233353]" />
            Active
          </label>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Save Department"}</Button>
          </div>
        </form>
      </Modal>

      {toDelete && (
        <Modal isOpen onClose={() => setToDelete(null)} title="Delete Department">
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Remove <span className="font-bold text-slate-800 dark:text-white">{toDelete.name}</span>? This is permanent, and refused while people, cost centers or requisitions use it — switch it off instead.
            </p>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={remove} loading={deleting}>Delete Department</Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
