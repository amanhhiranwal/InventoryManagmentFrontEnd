"use client";

/**
 * Cost Centers master, under Masters.
 *
 * What a purchase requisition is charged to. A cost center may belong to a
 * department, and the PR form then offers it only under that department.
 * Changes need procurement_masters.manage, which the server checks; one in
 * use cannot be deleted, so switch it off instead.
 */

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiHash, FiPlus, FiTrash2 } from "react-icons/fi";

import { ListPage, ListToolbar, PrimaryAction } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  deleteCostCenterApi,
  errorDetail,
  getCostCentersApi,
  getDepartmentsApi,
  saveCostCenterApi,
  type CostCenter,
  type Department,
} from "@/features/procurement/api/procurement.api";
import { ErrorState, INPUT, LABEL } from "@/features/procurement/components/shared";
import { useUIStore } from "@/lib/store/ui.store";

export default function CostCentersPage() {
  const { addToast } = useUIStore();
  const canManage = hasPermission("procurement_masters.manage");

  const [rows, setRows] = useState<CostCenter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<CostCenter | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [centers, depts] = await Promise.all([getCostCentersApi(), getDepartmentsApi()]);
      setRows(centers);
      setDepartments(depts);
    } catch (failure) {
      setError(errorDetail(failure, "Could not load cost centers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (center: CostCenter | null) => {
    setEditing(center);
    setCode(center?.code || "");
    setName(center?.name || "");
    setDepartmentId(center?.department_id ? String(center.department_id) : "");
    setActive(center?.is_active ?? true);
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !name.trim()) return addToast("A cost center needs a code and a name.", "warning");
    setSaving(true);
    try {
      await saveCostCenterApi(
        { code: code.trim(), name: name.trim(), department_id: departmentId ? Number(departmentId) : null, is_active: active },
        editing?.id,
      );
      addToast(editing ? "Cost center updated." : "Cost center added.", "success");
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
      await deleteCostCenterApi(toDelete.id);
      addToast("Cost center removed.", "success");
      setToDelete(null);
      load();
    } catch {
      /* the server says why */
    } finally {
      setDeleting(false);
    }
  };

  const term = search.trim().toLowerCase();
  const shown = rows.filter((c) => [c.code, c.name, c.department_name].filter(Boolean).some((f) => String(f).toLowerCase().includes(term)));

  return (
    <ListPage>
      <PageHeader title="Cost Centers Master" description="What purchase requisitions are charged to, optionally grouped under a department." />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search cost centers"
        trailing={canManage ? <PrimaryAction onClick={() => openForm(null)} icon={<FiPlus size={14} />}>Add Cost Center</PrimaryAction> : undefined}
      />

      {error ? (
        <ErrorState text={error} onRetry={load} />
      ) : (
        <Table headers={["Code", "Name", "Department", "Status", "Actions"]} loading={loading}>
          {shown.length === 0 && !loading ? (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-[#777777]">
                {term ? "No cost centers match." : "No cost centers yet. Until one exists, the PR form does not ask for a cost center."}
              </td>
            </tr>
          ) : (
            shown.map((c) => (
              <tr key={c.id} className="transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-[#071929]/20">
                <td className="px-5 py-4 font-mono text-sm font-bold text-slate-800 dark:text-white">
                  <div className="flex items-center gap-2"><FiHash className="text-primary" />{c.code}</div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{c.name}</td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{c.department_name || "Any"}</td>
                <td className="px-5 py-4 text-sm">{c.is_active ? <span className="text-emerald-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                <td className="px-5 py-4 text-right">
                  {canManage && (
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => openForm(c)} aria-label={`Edit ${c.code}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#233353] dark:hover:bg-[#0d2336]">
                        <FiEdit2 className="text-sm" />
                      </button>
                      <button type="button" onClick={() => setToDelete(c)} aria-label={`Delete ${c.code}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-[#0d2336]">
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

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Cost Center" : "Add Cost Center"}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Code *" required placeholder="e.g. CC-SCM-01" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input label="Name *" required value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className={LABEL} htmlFor="cc-dept">Department</label>
            <select id="cc-dept" className={INPUT} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Any department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#233353]" />
            Active
          </label>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Save Cost Center"}</Button>
          </div>
        </form>
      </Modal>

      {toDelete && (
        <Modal isOpen onClose={() => setToDelete(null)} title="Delete Cost Center">
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Remove <span className="font-bold text-slate-800 dark:text-white">{toDelete.code}</span>? This is permanent, and refused while requisitions use it — switch it off instead.
            </p>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={remove} loading={deleting}>Delete Cost Center</Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
