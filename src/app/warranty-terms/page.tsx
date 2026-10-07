"use client";

/**
 * Warranty Terms master.
 *
 * How long the cover runs. One term is the standard one: it is the cover
 * already included in the price, and every line falls back to it when
 * nobody picks another.
 *
 * What each term costs is not here. Five years on a panel and five years
 * on a camera are different undertakings, so the rate is held against
 * each product, on the product record, and applied on the server when a
 * document is saved.
 */

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiShield, FiTrash2 } from "react-icons/fi";

import PageHeader from "@/components/ui/PageHeader";
import { ListPage, ListToolbar, PrimaryAction } from "@/components/crm/ListPageShell";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";

export interface WarrantyTerm {
  id: string;
  name: string;
  years: number;
  is_default: boolean;
  description?: string | null;
  is_active: boolean;
}

export default function WarrantyTermsPage() {
  const { addToast } = useUIStore();

  /* Master data is maintained by the super admin; other roles given this
     page see it read-only. */
  const superAdmin = useAuthStore((state) => state.user?.is_super_admin === true);

  const [terms, setTerms] = useState<WarrantyTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WarrantyTerm | null>(null);
  const [toDelete, setToDelete] = useState<WarrantyTerm | null>(null);

  const [name, setName] = useState("");
  const [years, setYears] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [description, setDescription] = useState("");

  const fetchTerms = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/v1/warranty-terms");
      setTerms(data?.data || []);
    } catch (error) {
      console.error(error);
      addToast("Could not load the warranty terms.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setYears("");
    setIsDefault(false);
    setDescription("");
    setShowForm(true);
  };

  const openEdit = (term: WarrantyTerm) => {
    setEditing(term);
    setName(term.name || "");
    setYears(String(term.years ?? ""));
    setIsDefault(term.is_default);
    setDescription(term.description || "");
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      addToast("A name is required.", "warning");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        years: Number(years) || 0,
        is_default: isDefault,
        description: description.trim() || undefined,
      };

      if (editing) {
        await api.put(`/api/v1/warranty-terms/${editing.id}`, payload);
        addToast("Warranty term updated.", "success");
      } else {
        await api.post("/api/v1/warranty-terms/", payload);
        addToast("Warranty term added.", "success");
      }

      setShowForm(false);
      fetchTerms();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That warranty term could not be saved.";
      addToast(detail, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;

    setDeleting(true);

    try {
      await api.delete(`/api/v1/warranty-terms/${toDelete.id}`);
      addToast("Warranty term removed.", "success");
      setToDelete(null);
      fetchTerms();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That warranty term could not be removed.";
      addToast(detail, "error");
    } finally {
      setDeleting(false);
    }
  };

  const term = search.trim().toLowerCase();

  const filtered = terms.filter((row) =>
    [row.name, row.description, String(row.years)]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term)),
  );

  return (
    <ListPage>
      <PageHeader
        title="Warranty Terms Master"
        description="How long the cover runs. Offered against every product line on a proposal; what each term costs is set per product, on the product."
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search warranty terms"
        trailing={
          superAdmin ? (
            <PrimaryAction onClick={openAdd} icon={<FiPlus size={14} />}>
              Add Warranty Term
            </PrimaryAction>
          ) : undefined
        }
      />

      <Table
        headers={["Term", "Years", "Priced", "Description", "Actions"]}
        loading={loading}
      >
        {filtered.map((row) => (
          <tr
            key={row.id}
            className="transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-[#071929]/20"
          >
            <td className="px-5 py-4 text-sm font-bold text-slate-800 dark:text-white">
              <div className="flex items-center gap-2">
                <FiShield className="text-primary" />
                <span>{row.name}</span>

                {row.is_default && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/30">
                    Standard
                  </span>
                )}
              </div>
            </td>

            <td className="px-5 py-4 text-sm text-slate-500">{row.years}</td>

            <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
              {row.is_default ? "Included in the price" : "On each product"}
            </td>

            <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
              {row.description || "-"}
            </td>

            <td className="px-5 py-4 text-right">
              <div className="flex justify-end gap-1.5">
                {superAdmin && (
                  <>
                    <button
                      onClick={() => openEdit(row)}
                      className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#233353] dark:hover:bg-[#0d2336]"
                      title={`Edit ${row.name}`}
                    >
                      <FiEdit2 className="text-sm" />
                    </button>

                    {/* The standard term is what every line falls back to,
                        so it cannot be the one that is removed. */}
                    {!row.is_default && (
                      <button
                        onClick={() => setToDelete(row)}
                        className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-[#0d2336]"
                        title={`Delete ${row.name}`}
                      >
                        <FiTrash2 className="text-sm" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Warranty Term" : "Add Warranty Term"}
      >
        <form onSubmit={save} className="space-y-4">
          <Input
            label="Term Name *"
            required
            placeholder="e.g. 5 Years"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <Input
            label="Years of cover"
            type="number"
            min={0}
            placeholder="5"
            value={years}
            onChange={(event) => setYears(event.target.value)}
          />

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-[#233353]"
            />
            This is the standard term
          </label>

          <p className="-mt-2 text-[11px] text-slate-400">
            Every product line falls back to the standard term. Setting this
            one unsets whichever term holds it now.
          </p>

          <Input
            label="Description"
            placeholder="What this cover includes"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editing ? "Save Changes" : "Save Warranty Term"}
            </Button>
          </div>
        </form>
      </Modal>

      {toDelete && (
        <Modal isOpen onClose={() => setToDelete(null)} title="Delete Warranty Term">
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Remove{" "}
              <span className="font-bold text-slate-800 dark:text-white">
                {toDelete.name}
              </span>
              ? Documents already quoting it keep the figure they were saved
              with, and it stops being offered on new ones.
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleting}>
                Delete Warranty Term
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
