"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import {
  ListPage,
  ListToolbar,
  PrimaryAction,
} from "@/components/crm/ListPageShell";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { FiPlus, FiTrash2, FiSliders } from "react-icons/fi";

export default function UnitsPage() {
  const { addToast } = useUIStore();
  /* Master data is maintained by the super admin; other roles given
     this page see it read-only. */
  const superAdmin = useAuthStore((state) => state.user?.is_super_admin === true);
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");

  const fetchUnits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/v1/inventory/units/");
      if (res.data?.success) {
        setUnits(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch units.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Unit name is required.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/api/v1/inventory/units/", {
        name: name.trim(),
      });
      if (res.data?.success) {
        addToast("Unit created successfully!", "success");
        setName("");
        setShowAddModal(false);
        fetchUnits();
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to create unit.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return;
    try {
      setDeleting(true);
      const res = await api.delete(`/api/v1/inventory/units/${unitToDelete}`);
      if (res.data?.success) {
        addToast("Unit deleted successfully.", "success");
        setShowDeleteModal(false);
        setUnitToDelete(null);
        fetchUnits();
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to delete unit.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = units.filter((u) =>
    u.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ListPage>
      <PageHeader
        title="Units Master"
        description="Manage stock units specifications (e.g. Kg, Ltr, Box)."
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search units"
        trailing={
          superAdmin ? (
            <PrimaryAction
              onClick={() => setShowAddModal(true)}
              icon={<FiPlus size={14} />}
            >
              Add Unit
            </PrimaryAction>
          ) : undefined
        }
      />

      {/* Table draws its own card, spinner and empty state, so there is
          no second container or page-level ternary around it. */}
      <Table headers={["Unit Name", "Actions"]} loading={loading}>
            {filtered.map((u) => (
              <tr
                key={u}
                className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
              >
                <td className="py-4 px-5 font-bold text-slate-800 dark:text-white text-sm">
                  <div className="flex items-center gap-2">
                    <FiSliders className="text-primary" />
                    <span>{u}</span>
                  </div>
                </td>
                <td className="py-4 px-5 text-right">
                  <div className="flex justify-end gap-1.5">
                    {superAdmin && (
                      <button
                        onClick={() => {
                          setUnitToDelete(u);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                        title="Delete Unit"
                      >
                        <FiTrash2 className="text-sm" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
      </Table>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Unit"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Unit Name *"
            required
            placeholder="e.g. Kg"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save Unit
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && unitToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setUnitToDelete(null);
          }}
          title="Delete Unit"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete unit <span className="font-bold text-slate-800 dark:text-white">{unitToDelete}</span>? This is permanent.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUnitToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} loading={deleting}>
                Delete Unit
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
