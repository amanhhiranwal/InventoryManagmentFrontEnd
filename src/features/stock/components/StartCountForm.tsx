"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { MyWarehouse } from "@/features/locations/api/locations.api";
import { StockCount, createCountApi } from "@/features/stock/api/transfers.api";
import { errorText } from "@/features/stock/components/stockUi";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const FIELD =
  "w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:bg-[#071929]";
const LABEL = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider";

/**
 * Start a stock count: what the ledger says each store bin holds is copied
 * now, and the counter then enters what is really on the shelf.
 */
export default function StartCount({ warehouses, onClose, onStarted }: { warehouses: MyWarehouse[]; onClose: () => void; onStarted: (c: StockCount) => void }) {
  const { addToast } = useUIStore();
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : "");
  const [date, setDate] = useState(toDateInput(new Date()));
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) return addToast("Choose the warehouse to count.", "warning");
    try {
      setSaving(true);
      const started = await createCountApi({
        warehouse_id: warehouseId,
        count_date: date || undefined,
        remarks: remarks.trim() || undefined,
      });
      addToast(`${started.count_number} started with ${started.lines.length} line(s) to count.`, "success");
      onStarted(started);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not start the count."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Start a Stock Count" size="lg">
      <form onSubmit={start} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="count-warehouse" className={LABEL}>
              Warehouse *
            </label>
            <select
              id="count-warehouse"
              className={FIELD}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.location_name} ({w.location_code})
                </option>
              ))}
            </select>
          </div>
          <Input label="Count Date *" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Remarks" placeholder="e.g. Monthly count, rack A" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
          <p className="text-xs text-slate-500">Available stock is copied now. Avoid moving this stock until the count is approved.</p>
          <div className="flex gap-3">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Start Count
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
