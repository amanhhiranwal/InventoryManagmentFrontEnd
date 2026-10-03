"use client";

/**
 * Lead Sources master.
 *
 * Where an enquiry came from. The list has had an API and three seeded
 * rows since the beginning and no screen at all, so the only way to add a
 * channel was to insert a row by hand - and the Leads form offered
 * whatever happened to be in the table.
 *
 * A source a lead points at cannot be removed; the server refuses and
 * names how many are in the way, because a lead with no source can no
 * longer answer the one question the field exists to answer.
 */

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiRadio, FiTrash2 } from "react-icons/fi";

import PageHeader from "@/components/ui/PageHeader";
import { ListPage, ListToolbar, PrimaryAction } from "@/components/crm/ListPageShell";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";

interface LeadSource {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
}

export default function LeadSourcesPage() {
  const { addToast } = useUIStore();

  /* Master data is maintained by the super admin; other roles given this
     page see it read-only. */
  const superAdmin = useAuthStore((state) => state.user?.is_super_admin === true);

  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LeadSource | null>(null);
  const [toDelete, setToDelete] = useState<LeadSource | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/v1/lead-sources");
      setSources(data?.data || []);
    } catch (error) {
      console.error(error);
      addToast("Could not load the lead sources.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCode("");
    setDescription("");
    setShowForm(true);
  };

  const openEdit = (source: LeadSource) => {
    setEditing(source);
    setName(source.name || "");
    setCode(source.code || "");
    setDescription(source.description || "");
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
        /* Left to the server when blank - it derives one from the name,
           so a code is never half-set. */
        code: code.trim() || undefined,
        description: description.trim() || undefined,
      };

      if (editing) {
        await api.put(`/api/v1/lead-sources/${editing.id}`, payload);
        addToast("Lead source updated.", "success");
      } else {
        await api.post("/api/v1/lead-sources/", payload);
        addToast("Lead source added.", "success");
      }

      setShowForm(false);
      fetchSources();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That lead source could not be saved.";
      addToast(detail, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;

    setDeleting(true);

    try {
      await api.delete(`/api/v1/lead-sources/${toDelete.id}`);
      addToast("Lead source removed.", "success");
      setToDelete(null);
      fetchSources();
    } catch (error) {
      /* The server refuses when leads came in through it and says how
         many, which is more use than "could not delete". */
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That lead source could not be removed.";
      addToast(detail, "error");
    } finally {
      setDeleting(false);
    }
  };

  const term = search.trim().toLowerCase();

  const filtered = sources.filter((source) =>
    [source.name, source.code, source.description]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term)),
  );

  return (
    <ListPage>
      <PageHeader
        title="Lead Sources Master"
        description="Where enquiries come from. Offered on the Leads form, and what the source breakdown on Reports is grouped by."
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search lead sources"
        trailing={
          superAdmin ? (
            <PrimaryAction onClick={openAdd} icon={<FiPlus size={14} />}>
              Add Lead Source
            </PrimaryAction>
          ) : undefined
        }
      />

      <Table headers={["Source", "Code", "Description", "Actions"]} loading={loading}>
        {filtered.map((source) => (
          <tr
            key={source.id}
            className="transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-[#071929]/20"
          >
            <td className="px-5 py-4 text-sm font-bold text-slate-800 dark:text-white">
              <div className="flex items-center gap-2">
                <FiRadio className="text-primary" />
                <span>{source.name}</span>
              </div>
            </td>

            <td className="px-5 py-4 font-mono text-xs text-slate-500">
              {source.code || "-"}
            </td>

            <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
              {source.description || "-"}
            </td>

            <td className="px-5 py-4 text-right">
              <div className="flex justify-end gap-1.5">
                {superAdmin && (
                  <>
                    <button
                      onClick={() => openEdit(source)}
                      className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#233353] dark:hover:bg-[#0d2336]"
                      title={`Edit ${source.name}`}
                    >
                      <FiEdit2 className="text-sm" />
                    </button>

                    <button
                      onClick={() => setToDelete(source)}
                      className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-[#0d2336]"
                      title={`Delete ${source.name}`}
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
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
        title={editing ? "Edit Lead Source" : "Add Lead Source"}
      >
        <form onSubmit={save} className="space-y-4">
          <Input
            label="Source Name *"
            required
            placeholder="e.g. Exhibition"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <Input
            label="Code"
            placeholder="Left blank, one is made from the name"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />

          <Input
            label="Description"
            placeholder="What this channel covers"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editing ? "Save Changes" : "Save Lead Source"}
            </Button>
          </div>
        </form>
      </Modal>

      {toDelete && (
        <Modal
          isOpen
          onClose={() => setToDelete(null)}
          title="Delete Lead Source"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Remove{" "}
              <span className="font-bold text-slate-800 dark:text-white">
                {toDelete.name}
              </span>
              ? This is permanent. Leads already taken through it keep it, and
              the removal is refused while any do.
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleting}>
                Delete Lead Source
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
