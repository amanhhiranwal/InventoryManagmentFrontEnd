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
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { FiPlus, FiTrash2, FiTag } from "react-icons/fi";
import {
  getCategoryGroupsApi,
  createCategoryGroupApi,
  deleteCategoryGroupApi,
  CategoryGroupModel,
} from "@/features/inventory/api/inventory.api";

export default function CategoryGroupsPage() {
  const { addToast } = useUIStore();
  /* Master data is maintained by the super admin; other roles given
     this page see it read-only. */
  const superAdmin = useAuthStore((state) => state.user?.is_super_admin === true);
  const [groups, setGroups] = useState<CategoryGroupModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<CategoryGroupModel | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const fetchCategoryGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCategoryGroupsApi();
      setGroups(data);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch category groups.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCategoryGroups();
  }, [fetchCategoryGroups]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      addToast("Name and Code are required.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      await createCategoryGroupApi({
        name: name.trim(),
        code: code.toUpperCase().trim(),
      });
      addToast("Category Group created successfully!", "success");
      setName("");
      setCode("");
      setShowAddModal(false);
      fetchCategoryGroups();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to create category group.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    try {
      setDeleting(true);
      await deleteCategoryGroupApi(groupToDelete.id);
      addToast("Category Group deleted successfully.", "success");
      setShowDeleteModal(false);
      setGroupToDelete(null);
      fetchCategoryGroups();
    } catch (err) {
      console.error(err);
      addToast("Failed to delete category group.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = groups.filter(
    (g) =>
      (g.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (g.code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ListPage>
      <PageHeader
        title="Category Groups Master"
        description="Manage main category groupings for products."
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search category groups"
        trailing={
          superAdmin ? (
            <PrimaryAction
              onClick={() => setShowAddModal(true)}
              icon={<FiPlus size={14} />}
            >
              Add Category Group
            </PrimaryAction>
          ) : undefined
        }
      />

      {/* Table draws its own card, spinner and empty state, so there is
          no second container or page-level ternary around it. */}
      <Table headers={["Category Group", "Code", "Actions"]} loading={loading}>
            {filtered.map((g) => (
              <tr
                key={g.id}
                className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
              >
                <td className="py-4 px-5 font-bold text-slate-800 dark:text-white text-sm">
                  <div className="flex items-center gap-2">
                    <FiTag className="text-primary" />
                    <span>{g.name}</span>
                  </div>
                </td>
                <td className="py-4 px-5">
                  <span className="inline-flex items-center rounded bg-primary-light/30 dark:bg-primary-light/5 text-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
                    {g.code}
                  </span>
                </td>
                <td className="py-4 px-5 text-right">
                  <div className="flex justify-end gap-1.5">
                    {superAdmin && (
                      <button
                        onClick={() => {
                          setGroupToDelete(g);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                        title="Delete Category Group"
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
        title="Add Category Group"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Category Group Name"
            required
            placeholder="e.g. Hardware"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Category Group Code"
            required
            placeholder="e.g. HARDWARE"
            value={code}
            onChange={(e) => setCode(e.target.value)}
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
              Save Group
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && groupToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setGroupToDelete(null);
          }}
          title="Delete Category Group"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete category group <span className="font-bold text-slate-800 dark:text-white">{groupToDelete.name}</span>? This is permanent.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setGroupToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} loading={deleting}>
                Delete Group
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
