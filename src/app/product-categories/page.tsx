"use client";

/**
 * Product Categories master, under Masters.
 *
 * What a vendor can be said to supply, picked from this list on the vendor
 * form. It starts from the stock item list and is kept here. Changes need
 * procurement_masters.manage, which the server checks. A category a vendor
 * carries cannot be deleted - the server refuses and says why - so switch
 * it off instead: it then leaves the picker but stays on those vendors.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiTag, FiTrash2 } from "react-icons/fi";

import { ListPage, ListToolbar, PrimaryAction } from "@/components/crm/ListPageShell";
import Pagination from "@/components/crm/Pagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  deleteProductCategoryApi,
  errorDetail,
  getProductCategoriesApi,
  saveProductCategoryApi,
  type ProductCategory,
} from "@/features/procurement/api/procurement.api";
import { ErrorState } from "@/features/procurement/components/shared";
import { useUIStore } from "@/lib/store/ui.store";

const PAGE_SIZE = 25;

export default function ProductCategoriesPage() {
  const { addToast } = useUIStore();
  const canManage = hasPermission("procurement_masters.manage");

  const [rows, setRows] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ProductCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getProductCategoriesApi(false));
    } catch (failure) {
      setError(errorDetail(failure, "Could not load product categories."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (category: ProductCategory | null) => {
    setEditing(category);
    setName(category?.name || "");
    setActive(category?.is_active ?? true);
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return addToast("A product category needs a name.", "warning");
    setSaving(true);
    try {
      await saveProductCategoryApi({ name: name.trim(), is_active: active }, editing?.id);
      addToast(editing ? "Product category updated." : "Product category added.", "success");
      setShowForm(false);
      load();
    } catch {
      /* the server's reason (a duplicate name) is shown by the API client */
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteProductCategoryApi(toDelete.id);
      addToast("Product category removed.", "success");
      setToDelete(null);
      load();
    } catch {
      /* the server says why (vendors supply it) */
    } finally {
      setDeleting(false);
    }
  };

  const term = search.trim().toLowerCase();
  const shown = useMemo(
    () => (term ? rows.filter((row) => row.name.toLowerCase().includes(term)) : rows),
    [rows, term],
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <ListPage>
      <PageHeader
        title="Product Categories Master"
        description="What vendors supply. Picked from this list on the vendor form; switch one off to take it out of the picker."
      />
      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search product categories"
        trailing={canManage ? <PrimaryAction onClick={() => openForm(null)} icon={<FiPlus size={14} />}>Add Product Category</PrimaryAction> : undefined}
      />

      {error ? (
        <ErrorState text={error} onRetry={load} />
      ) : (
        <>
          <Table headers={["Product Category", "Status", "Actions"]} loading={loading}>
            {pageRows.length === 0 && !loading ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-[#777777]">
                  {term ? "No product categories match." : "No product categories yet."}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id} className="transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-[#071929]/20">
                  <td className="px-5 py-3.5 text-sm font-semibold text-slate-800 dark:text-white">
                    <div className="flex items-center gap-2"><FiTag className="shrink-0 text-primary" />{row.name}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm">{row.is_active ? <span className="text-emerald-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                  <td className="px-5 py-3.5 text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => openForm(row)} aria-label={`Edit ${row.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#233353] dark:hover:bg-[#0d2336]">
                          <FiEdit2 className="text-sm" />
                        </button>
                        <button type="button" onClick={() => setToDelete(row)} aria-label={`Delete ${row.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-[#0d2336]">
                          <FiTrash2 className="text-sm" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </Table>
          {!loading && shown.length > 0 && (
            <Pagination page={current} pageSize={PAGE_SIZE} totalItems={shown.length} totalPages={totalPages} onPageChange={setPage} noun="categories" />
          )}
        </>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Product Category" : "Add Product Category"}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Product Category *" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#233353]" />
            Active (offered on the vendor form)
          </label>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Save Product Category"}</Button>
          </div>
        </form>
      </Modal>

      {toDelete && (
        <Modal isOpen onClose={() => setToDelete(null)} title="Delete Product Category">
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Remove <span className="font-bold text-slate-800 dark:text-white">{toDelete.name}</span>? This is permanent, and refused while a vendor supplies it — switch it off instead.
            </p>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={remove} loading={deleting}>Delete Product Category</Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
