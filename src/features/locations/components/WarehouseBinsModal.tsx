"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { FiEdit2, FiPlus, FiSlash, FiCheckCircle } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Table from "@/components/ui/Table";
import { useUIStore } from "@/lib/store/ui.store";
import {
  BinType,
  WarehouseBin,
  createBinApi,
  getBinsApi,
  updateBinApi,
  Location,
} from "@/features/locations/api/locations.api";

const BIN_TYPE_LABEL: Record<BinType, string> = {
  STORE: "Store",
  QC: "Quality Check",
  REJECT: "Rejected",
};

const BIN_TYPE_STYLE: Record<BinType, string> = {
  STORE: "bg-sky-500/10 text-sky-600",
  QC: "bg-amber-500/10 text-amber-600",
  REJECT: "bg-rose-500/10 text-rose-600",
};

interface BinForm {
  code: string;
  name: string;
  bin_type: BinType;
  zone: string;
  rack: string;
  shelf: string;
}

const EMPTY_FORM: BinForm = { code: "", name: "", bin_type: "STORE", zone: "", rack: "", shelf: "" };

const selectClass =
  "w-full appearance-none rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-3.5 pr-8 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929] cursor-pointer";

const errorText = (err: unknown, fallback: string) => {
  const axiosError = err as AxiosError<{ message?: string; detail?: string }>;
  const detail = axiosError.response?.data?.detail;
  return (typeof detail === "string" && detail) || axiosError.response?.data?.message || fallback;
};

/**
 * The bins inside one warehouse. Everyone who can see locations can see
 * them; only a super admin adds, edits or switches them off (the server
 * enforces the same). Bins are switched off, never deleted, because stock
 * history will point at them.
 */
export default function WarehouseBinsModal({
  warehouse,
  canManage,
  onClose,
}: {
  warehouse: Location;
  canManage: boolean;
  onClose: () => void;
}) {
  const { addToast } = useUIStore();
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<BinForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<WarehouseBin | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setBins(await getBinsApi(warehouse.id));
    } catch (err: unknown) {
      setLoadError(errorText(err, "Could not load the bins for this warehouse."));
    } finally {
      setLoading(false);
    }
  }, [warehouse.id]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (bin: WarehouseBin) => {
    setEditing(bin);
    setForm({
      code: bin.code,
      name: bin.name,
      bin_type: bin.bin_type,
      zone: bin.zone || "",
      rack: bin.rack || "",
      shelf: bin.shelf || "",
    });
  };

  const resetForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      addToast("Bin code and name are required.", "warning");
      return;
    }
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      bin_type: form.bin_type,
      zone: form.zone.trim() || null,
      rack: form.rack.trim() || null,
      shelf: form.shelf.trim() || null,
    };
    try {
      setSaving(true);
      if (editing) {
        await updateBinApi(warehouse.id, editing.id, payload);
        addToast("Bin updated.", "success");
      } else {
        await createBinApi(warehouse.id, payload);
        addToast("Bin added.", "success");
      }
      resetForm();
      load();
    } catch (err: unknown) {
      addToast(errorText(err, editing ? "Failed to update bin." : "Failed to add bin."), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (bin: WarehouseBin) => {
    try {
      setToggling(bin.id);
      await updateBinApi(warehouse.id, bin.id, { is_active: !bin.is_active });
      addToast(bin.is_active ? `${bin.code} switched off.` : `${bin.code} switched on.`, "success");
      load();
    } catch (err: unknown) {
      addToast(errorText(err, "Failed to change the bin."), "error");
    } finally {
      setToggling(null);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Bins · ${warehouse.location_name}`} size="xl">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Code <span className="font-mono font-semibold">{warehouse.location_code}</span>. Store, Quality Check and
          Rejected bins are created with every warehouse; each kind always keeps at least one active bin.
        </p>

        {canManage && (
          <form
            onSubmit={submit}
            className="space-y-3 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/40 p-4"
          >
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {editing ? `Edit bin ${editing.code}` : "Add a bin"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Bin Code *"
                required
                placeholder="A-01-03"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <Input
                label="Bin Name *"
                required
                placeholder="Rack A, shelf 3"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="space-y-1.5">
                <label htmlFor="bin-type" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Bin Type *
                </label>
                <div className="relative">
                  <select
                    id="bin-type"
                    className={selectClass}
                    value={form.bin_type}
                    onChange={(e) => setForm({ ...form, bin_type: e.target.value as BinType })}
                  >
                    {(Object.keys(BIN_TYPE_LABEL) as BinType[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {BIN_TYPE_LABEL[kind]}
                      </option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400 text-[10px]">▼</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input label="Zone" placeholder="Ground floor" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
              <Input label="Rack" placeholder="A" value={form.rack} onChange={(e) => setForm({ ...form, rack: e.target.value })} />
              <Input label="Shelf" placeholder="3" value={form.shelf} onChange={(e) => setForm({ ...form, shelf: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {editing && (
                <Button variant="outline" type="button" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
              <Button type="submit" loading={saving} icon={editing ? <FiEdit2 /> : <FiPlus />}>
                {editing ? "Save Bin" : "Add Bin"}
              </Button>
            </div>
          </form>
        )}

        {loadError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 flex flex-wrap items-center justify-between gap-3">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={load}>
              Try Again
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table headers={["Bin", "Type", "Location In Warehouse", "Status", "Actions"]} loading={loading}>
              {bins.map((bin) => (
                <tr key={bin.id} className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150">
                  <td className="py-3 px-5">
                    <p className="font-bold text-slate-800 dark:text-white text-sm font-mono">{bin.code}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{bin.name}</p>
                  </td>
                  <td className="py-3 px-5">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${BIN_TYPE_STYLE[bin.bin_type]}`}>
                      {BIN_TYPE_LABEL[bin.bin_type]}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-xs text-slate-500 dark:text-slate-400">
                    {[bin.zone && `Zone ${bin.zone}`, bin.rack && `Rack ${bin.rack}`, bin.shelf && `Shelf ${bin.shelf}`]
                      .filter(Boolean)
                      .join(" · ") || <span className="italic">Not set</span>}
                  </td>
                  <td className="py-3 px-5">
                    {bin.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-500 px-2 py-0.5 text-xs font-semibold">
                        <FiCheckCircle className="text-xs" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-500/10 text-slate-500 px-2 py-0.5 text-xs font-semibold">
                        <FiSlash className="text-xs" /> Off
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right">
                    {canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(bin)} icon={<FiEdit2 />}>
                          Edit
                        </Button>
                        <Button
                          variant={bin.is_active ? "danger" : "success"}
                          size="sm"
                          loading={toggling === bin.id}
                          onClick={() => toggle(bin)}
                        >
                          {bin.is_active ? "Switch Off" : "Switch On"}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </div>
    </Modal>
  );
}
