"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { MyWarehouse } from "@/features/locations/api/locations.api";
import { Grn, getGrnApi, getGrnsApi } from "@/features/stock/api/grn.api";
import { OpeningDocument, OpeningPayloadLine, createStockDocumentApi } from "@/features/stock/api/stock.api";
import { errorText, qty } from "@/features/stock/components/stockUi";
import { useUIStore } from "@/lib/store/ui.store";

const FIELD =
  "w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:bg-[#071929]";
const LABEL = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider";

type Status = "REJECTED" | "BLOCKED" | "UNRESTRICTED";
const STATUSES: { key: Status; label: string; field: "qty_rejected" | "qty_damaged" | "qty_accepted" }[] = [
  { key: "REJECTED", label: "Rejected", field: "qty_rejected" },
  { key: "BLOCKED", label: "Damaged", field: "qty_damaged" },
  { key: "UNRESTRICTED", label: "Accepted", field: "qty_accepted" },
];

/**
 * Send received goods back to the vendor, against the GRN they came in on.
 * Each line offers what that GRN accepted, rejected and marked damaged; the
 * server also subtracts what other returns already take, and refuses more.
 */
export default function VendorReturnForm({
  warehouses,
  onClose,
  onSaved,
}: {
  warehouses: MyWarehouse[];
  onClose: () => void;
  onSaved: (doc: OpeningDocument) => void;
}) {
  const { addToast } = useUIStore();
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : "");
  const [grns, setGrns] = useState<Grn[]>([]);
  const [grnId, setGrnId] = useState<number | null>(null);
  const [grn, setGrn] = useState<Grn | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [serials, setSerials] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!warehouseId) return;
    getGrnsApi({ warehouse_id: warehouseId, status: "POSTED", size: 100 })
      .then((page) => {
        setGrns(page.data);
        setLoadError(null);
      })
      .catch((err: unknown) => setLoadError(errorText(err, "Could not load this warehouse's GRNs.")));
  }, [warehouseId]);

  useEffect(() => {
    if (!grnId) return;
    getGrnApi(grnId)
      .then((answer) => setGrn(answer.grn))
      .catch((err: unknown) => setLoadError(errorText(err, "Could not open the GRN.")));
  }, [grnId]);

  const dirty = useMemo(() => Object.values(amounts).some((v) => v.trim() !== ""), [amounts]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grn) return addToast("Choose the GRN the goods came in on.", "warning");
    const lines: OpeningPayloadLine[] = [];
    for (const line of grn.lines) {
      for (const status of STATUSES) {
        const text = (amounts[`${line.id}:${status.key}`] || "").trim();
        if (text === "") continue;
        const quantity = Number(text);
        const most = Number(line[status.field] || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) return addToast(`${line.sku}: enter a quantity above zero.`, "warning");
        if (quantity > most) return addToast(`${line.sku}: the GRN only had ${most} ${status.label.toLowerCase()}.`, "warning");
        const lineSerials =
          status.key === "UNRESTRICTED"
            ? (serials[line.id] || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
            : [];
        lines.push({ grn_line_id: line.id, stock_status: status.key, quantity, serials: lineSerials });
      }
    }
    if (lines.length === 0) return addToast("Enter how many of something go back.", "warning");

    try {
      setSaving(true);
      const saved = await createStockDocumentApi("vendor-returns", {
        warehouse_id: grn.warehouse_id,
        grn_id: grn.id,
        reason: reason.trim() || undefined,
        lines,
      });
      addToast(`Saved as draft ${saved.doc_number}.`, "success");
      onSaved(saved);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not save the vendor return."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="New Vendor Return" size="xl" hasUnsavedChanges={dirty && !saving}>
      <form onSubmit={save} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="vr-warehouse" className={LABEL}>
              Warehouse *
            </label>
            <select
              id="vr-warehouse"
              className={FIELD}
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setGrnId(null);
                setGrn(null);
              }}
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.location_name} ({w.location_code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="vr-grn" className={LABEL}>
              Against GRN *
            </label>
            <select
              id="vr-grn"
              className={FIELD}
              disabled={!warehouseId}
              value={grnId ?? ""}
              onChange={(e) => {
                setGrnId(e.target.value ? Number(e.target.value) : null);
                setGrn(null);
                setAmounts({});
              }}
            >
              <option value="">{grns.length ? "Select GRN..." : "No posted GRNs"}</option>
              {grns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.grn_number} · {g.supplier_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="vr-reason" className={LABEL}>
              Reason
            </label>
            <input id="vr-reason" className={FIELD} placeholder="e.g. Faulty, replacement due" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        {loadError && (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600">
            {loadError}
          </p>
        )}

        {grn && (
          <div className="space-y-3">
            <p className={LABEL}>
              Goods on {grn.grn_number} from {grn.supplier_name}
            </p>
            {grn.lines.map((line) => (
              <div key={line.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-[#0d2336] dark:bg-[#071929]/40">
                <p className="text-sm font-semibold">
                  {line.description || line.sku} <span className="font-mono text-[11px] font-normal text-slate-500">{line.sku}</span>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {STATUSES.map((status) => {
                    const most = Number(line[status.field] || 0);
                    return (
                      <label key={status.key} className="space-y-1">
                        <span className="text-[12px] text-slate-500">
                          {status.label} to return (GRN had {qty(most)})
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={most}
                          step="any"
                          disabled={most <= 0}
                          className={FIELD}
                          value={amounts[`${line.id}:${status.key}`] || ""}
                          onChange={(e) => setAmounts({ ...amounts, [`${line.id}:${status.key}`]: e.target.value })}
                        />
                      </label>
                    );
                  })}
                </div>
                {Number(amounts[`${line.id}:UNRESTRICTED`] || 0) > 0 && line.serials.length > 0 && (
                  <label className="block space-y-1">
                    <span className="text-[12px] text-slate-500">Serials of the accepted units going back</span>
                    <textarea
                      rows={2}
                      className={`${FIELD} font-mono text-xs`}
                      placeholder={line.serials.join(", ")}
                      value={serials[line.id] || ""}
                      onChange={(e) => setSerials({ ...serials, [line.id]: e.target.value })}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
          <p className="text-xs text-slate-500">Saved as a draft. The goods leave stock only after it is approved.</p>
          <div className="flex gap-3">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save as Draft
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
