"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useUIStore } from "@/lib/store/ui.store";
import { FiPlus, FiTrash2, FiSearch, FiUser } from "react-icons/fi";
import {
  getCustomerTypesApi,
  createCustomerTypeApi,
  deleteCustomerTypeApi,
  CustomerTypeModel,
} from "@/features/inventory/api/inventory.api";
import { CgSpinner } from "react-icons/cg";

export default function CustomerTypesPage() {
  const { addToast } = useUIStore();
  const [types, setTypes] = useState<CustomerTypeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<CustomerTypeModel | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const fetchCustomerTypes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCustomerTypesApi();
      setTypes(data);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch customer types.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCustomerTypes();
  }, [fetchCustomerTypes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      addToast("Name and Code are required.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      await createCustomerTypeApi({
        name: name.trim(),
        code: code.toUpperCase().trim(),
        description: description.trim() || undefined,
      });
      addToast("Customer Type created successfully!", "success");
      setName("");
      setCode("");
      setDescription("");
      setShowAddModal(false);
      fetchCustomerTypes();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to create customer type.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!typeToDelete) return;
    try {
      setDeleting(true);
      await deleteCustomerTypeApi(typeToDelete.id);
      addToast("Customer Type deleted successfully.", "success");
      setShowDeleteModal(false);
      setTypeToDelete(null);
      fetchCustomerTypes();
    } catch (err) {
      console.error(err);
      addToast("Failed to delete customer type.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = types.filter(
    (t) =>
      (t.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Customer Types Master"
          description="Manage classifications and profiles for lead segmentation."
        />
        <Button
          onClick={() => setShowAddModal(true)}
          icon={<FiPlus />}
          className="shrink-0"
        >
          Add Customer Type
        </Button>
      </div>

      <div className="flex items-center gap-3 max-w-md bg-white dark:bg-[#051422] rounded-xl border border-slate-200 dark:border-[#0d2336] px-3.5 py-2">
        <FiSearch className="text-slate-400 text-sm" />
        <input
          type="text"
          placeholder="Search customer classifications..."
          className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-primary" />
            <span className="text-xs">Fetching Customer Types...</span>
          </div>
        ) : filtered.length > 0 ? (
          <Table headers={["Type Name", "Identifier Code", "Description", "Actions"]}>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
              >
                <td className="py-4 px-5 font-bold text-slate-800 dark:text-white text-sm">
                  <div className="flex items-center gap-2">
                    <FiUser className="text-primary" />
                    <span>{t.name}</span>
                  </div>
                </td>
                <td className="py-4 px-5">
                  <span className="inline-flex items-center rounded bg-primary-light/30 dark:bg-primary-light/5 text-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
                    {t.code}
                  </span>
                </td>
                <td className="py-4 px-5 text-xs text-slate-500 dark:text-slate-450">
                  {t.description || <span className="italic">No description</span>}
                </td>
                <td className="py-4 px-5 text-right">
                  <button
                    onClick={() => {
                      setTypeToDelete(t);
                      setShowDeleteModal(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                    title="Delete Customer Type"
                  >
                    <FiTrash2 className="text-sm" />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            No customer types match your filter query.
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Customer Type"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Type Name"
            required
            placeholder="e.g. Retail Outlets"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Identifier Code"
            required
            placeholder="e.g. RTL"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none min-h-[80px]"
              placeholder="Detail scope of trade..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save Master
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && typeToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setTypeToDelete(null);
          }}
          title="Delete Customer Type"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-white">{typeToDelete.name}</span>? This action is permanent and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setTypeToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} loading={deleting}>
                Delete Type
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
