"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { getBinsApi, MyWarehouse, WarehouseBin } from "@/features/locations/api/locations.api";
import {
  CatalogueProduct,
  ADJUSTMENT_REASONS,
  OpeningDocument,
  createStockDocumentApi,
  getStockCatalogueApi,
  updateStockDocumentApi,
} from "@/features/stock/api/stock.api";
import { errorText } from "@/features/stock/components/stockUi";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

/** One editable line. Numbers stay as typed text until saved, so an empty
    box is empty - never silently 0. */
interface LineDraft {
  key: number;
  sku: string;
  bin_id: string;
  quantity: string;
  unit_cost: string;
  serials: string;
}

const FIELD =
  "w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:bg-[#071929]";
const LABEL = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider";

let nextKey = 1;
const blankLine = (bin = ""): LineDraft => ({
  key: nextKey++,
  sku: "",
  bin_id: bin,
  quantity: "",
  unit_cost: "",
  serials: "",
});

const splitSerials = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Prepare opening stock for one warehouse: a line per product with its
 * bin, quantity, unit cost and - for serial-numbered products - one serial
 * per unit. Saving keeps it as a draft; nothing reaches stock until it is
 * submitted and someone else approves it.
 */
export default function OpeningStockForm({
  kind = "opening",
  warehouses,
  editing,
  onClose,
  onSaved,
}: {
  /** Opening stock, or a stock adjustment (in or out, with a reason). */
  kind?: "opening" | "adjustments";
  warehouses: MyWarehouse[];
  editing: OpeningDocument | null;
  onClose: () => void;
  onSaved: (doc: OpeningDocument) => void;
}) {
  const { addToast } = useUIStore();
  const adjusting = kind === "adjustments";
  const [direction, setDirection] = useState<"IN" | "OUT">(editing?.doc_type === "ADJUSTMENT_IN" ? "IN" : "OUT");
  const [reasonCode, setReasonCode] = useState(editing?.reason_code || "");
  const [warehouseId, setWarehouseId] = useState(editing?.warehouse_id || (warehouses.length === 1 ? warehouses[0].id : ""));
  const [movementDate, setMovementDate] = useState(toDateInput(editing?.movement_date || new Date()));
  const [reason, setReason] = useState(editing?.reason || (adjusting ? "" : "Opening stock"));
  const [remarks, setRemarks] = useState(editing?.remarks || "");
  const [lines, setLines] = useState<LineDraft[]>(
    editing
      ? editing.lines.map((l) => ({
          key: nextKey++,
          sku: l.sku,
          bin_id: l.bin_id,
          quantity: String(l.quantity),
          unit_cost: l.unit_cost === null || l.unit_cost === undefined ? "" : String(l.unit_cost),
          serials: (l.serials || []).join("\n"),
        }))
      : [blankLine()],
  );
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* What the form held when it opened, to tell whether closing it loses work. */
  const snapshot = JSON.stringify({ warehouseId, movementDate, reason, remarks, direction, reasonCode, lines: lines.map(({ key: _key, ...rest }) => rest) });
  const [initial] = useState(snapshot);
  const dirty = snapshot !== initial;

  /* The bins and products depend on the warehouse chosen. */
  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    Promise.all([getBinsApi(warehouseId), getStockCatalogueApi(warehouseId)])
      .then(([binRows, products]) => {
        if (cancelled) return;
        setLoadError(null);
        setBins(binRows.filter((b) => b.is_active));
        setCatalogue(products);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorText(err, "Could not load the bins and products for this warehouse."));
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  const storeBin = useMemo(() => bins.find((b) => b.code === "STORE") || bins.find((b) => b.bin_type === "STORE"), [bins]);
  const productBySku = useMemo(() => new Map(catalogue.map((p) => [p.sku, p])), [catalogue]);

  const update = (key: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      addToast("Choose the warehouse.", "warning");
      return;
    }

    const payloadLines = [];
    for (const [index, line] of lines.entries()) {
      const label = `Line ${index + 1}`;
      const sku = line.sku.trim().toUpperCase();
      const quantity = line.quantity.trim() === "" ? null : Number(line.quantity);
      const unitCost = line.unit_cost.trim() === "" ? null : Number(line.unit_cost);
      const serials = splitSerials(line.serials);

      if (!sku) return addToast(`${label}: choose a product.`, "warning");
      if (quantity === null || !Number.isFinite(quantity) || quantity <= 0)
        return addToast(`${label}: enter a quantity above zero.`, "warning");
      if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0))
        return addToast(`${label}: the unit cost cannot be negative.`, "warning");
      if (serials.length && serials.length !== quantity)
        return addToast(`${label}: ${serials.length} serial(s) for a quantity of ${quantity}. Enter one per unit.`, "warning");

      payloadLines.push({
        sku,
        bin_id: line.bin_id || storeBin?.id,
        quantity,
        unit_cost: unitCost,
        serials,
      });
    }

    if (adjusting && !reasonCode) {
      addToast("Choose why stock is being adjusted.", "warning");
      return;
    }

    try {
      setSaving(true);
      const body = {
        movement_date: movementDate || undefined,
        reason: reason.trim() || undefined,
        remarks: remarks.trim() || undefined,
        reason_code: adjusting ? reasonCode : undefined,
        lines: payloadLines,
      };
      const saved = editing
        ? await updateStockDocumentApi(kind, editing.id, body)
        : await createStockDocumentApi(kind, { warehouse_id: warehouseId, direction: adjusting ? direction : undefined, ...body });
      addToast(editing ? "Draft updated." : `Saved as draft ${saved.doc_number}.`, "success");
      onSaved(saved);
    } catch (err: unknown) {
      addToast(errorText(err, adjusting ? "Could not save the adjustment." : "Could not save the opening stock."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={editing ? `Edit ${editing.doc_number}` : adjusting ? "New Stock Adjustment" : "New Opening Stock"} size="xl" hasUnsavedChanges={dirty && !saving}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="opening-warehouse" className={LABEL}>
              Warehouse *
            </label>
            <select
              id="opening-warehouse"
              required
              disabled={!!editing}
              className={FIELD}
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setLines([blankLine()]);
              }}
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.location_name} ({w.location_code}){w.company_name ? ` · ${w.company_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <Input label="Stock As On *" type="date" required value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
          <Input
            label={adjusting ? "Details" : "Reason"}
            placeholder={adjusting ? "What happened" : "Opening stock"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {adjusting && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="adjust-direction" className={LABEL}>
                Stock Goes *
              </label>
              <select
                id="adjust-direction"
                className={FIELD}
                disabled={!!editing}
                value={direction}
                onChange={(e) => setDirection(e.target.value === "IN" ? "IN" : "OUT")}
              >
                <option value="OUT">Out (damage, loss, expiry...)</option>
                <option value="IN">In (found, correction...)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="adjust-reason" className={LABEL}>
                Reason *
              </label>
              <select id="adjust-reason" className={FIELD} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                <option value="">Select reason...</option>
                {ADJUSTMENT_REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {loadError && (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600">
            {loadError}
          </p>
        )}

        <datalist id="opening-catalogue">
          {catalogue.map((p) => (
            <option key={p.sku} value={p.sku}>
              {p.name || p.sku}
            </option>
          ))}
        </datalist>

        <div className="space-y-3">
          <p className={LABEL}>Products</p>
          {lines.map((line, index) => {
            const product = productBySku.get(line.sku.trim().toUpperCase());
            return (
              <div
                key={line.key}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-[#0d2336] dark:bg-[#071929]/40"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="space-y-1.5 sm:col-span-7">
                    <label htmlFor={`sku-${line.key}`} className={LABEL}>
                      Product (SKU) *
                    </label>
                    <input
                      id={`sku-${line.key}`}
                      list="opening-catalogue"
                      className={FIELD}
                      placeholder={warehouseId ? "Type to search the catalogue" : "Choose a warehouse first"}
                      disabled={!warehouseId}
                      value={line.sku}
                      onChange={(e) => update(line.key, { sku: e.target.value })}
                    />
                    <p className="min-h-[16px] truncate text-[11px] text-slate-500">
                      {line.sku ? product?.name || "Not in this company's catalogue" : ""}
                    </p>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor={`qty-${line.key}`} className={LABEL}>
                      Qty *
                    </label>
                    <input
                      id={`qty-${line.key}`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      className={FIELD}
                      value={line.quantity}
                      onChange={(e) => update(line.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor={`cost-${line.key}`} className={LABEL}>
                      Unit Cost
                    </label>
                    <input
                      id={`cost-${line.key}`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className={FIELD}
                      value={line.unit_cost}
                      onChange={(e) => update(line.key, { unit_cost: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end sm:col-span-1">
                    <button
                      type="button"
                      aria-label={`Remove line ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                      className="flex h-[38px] w-full items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-30"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                {(product?.has_serials || line.serials) && (
                  <div className="space-y-1.5">
                    <label htmlFor={`serials-${line.key}`} className={LABEL}>
                      Serial Numbers ({splitSerials(line.serials).length} of {line.quantity || 0})
                    </label>
                    <textarea
                      id={`serials-${line.key}`}
                      rows={2}
                      className={`${FIELD} font-mono text-xs`}
                      placeholder="One per line, or separated by commas. Leave empty for products counted by quantity."
                      value={line.serials}
                      onChange={(e) => update(line.key, { serials: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<FiPlus />}
            disabled={!warehouseId}
            onClick={() => setLines((current) => [...current, blankLine(storeBin?.id)])}
          >
            Add Product
          </Button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="opening-remarks" className={LABEL}>
            Remarks
          </label>
          <textarea
            id="opening-remarks"
            rows={2}
            className={FIELD}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
          <p className="text-xs text-slate-500">Saved as a draft. Stock changes only after it is approved.</p>
          <div className="flex gap-3">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save Draft" : "Save as Draft"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
