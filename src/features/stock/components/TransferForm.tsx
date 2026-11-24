"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { MyWarehouse } from "@/features/locations/api/locations.api";
import { StockBalanceRow, getStockBalancesApi } from "@/features/stock/api/stock.api";
import {
  Destination,
  Transfer,
  createTransferApi,
  getTransferDestinationsApi,
  updateTransferApi,
} from "@/features/stock/api/transfers.api";
import { errorText, qty, splitSerials } from "@/features/stock/components/stockUi";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const FIELD =
  "w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:bg-[#071929]";
const LABEL = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider";

/** A line as typed. The stock row is "sku|bin"; numbers stay text until saved. */
interface LineDraft {
  key: number;
  row: string;
  quantity: string;
  serials: string;
}

let nextKey = 1;
const blankLine = (): LineDraft => ({ key: nextKey++, row: "", quantity: "", serials: "" });
const rowKey = (sku: string, binId: string) => `${sku}|${binId}`;

/**
 * Request a transfer from one of your warehouses to another warehouse of
 * the same company. Only what is available (not reserved) in the sending
 * warehouse's store bins can be picked. Saved as a draft: nothing moves
 * until it is approved by someone else and shipped.
 */
export default function TransferForm({
  warehouses,
  editing,
  onClose,
  onSaved,
}: {
  warehouses: MyWarehouse[];
  editing: Transfer | null;
  onClose: () => void;
  onSaved: (transfer: Transfer) => void;
}) {
  const { addToast } = useUIStore();
  const [fromId, setFromId] = useState(editing?.from_warehouse_id || (warehouses.length === 1 ? warehouses[0].id : ""));
  const [toId, setToId] = useState(editing?.to_warehouse_id || "");
  const [date, setDate] = useState(toDateInput(editing?.transfer_date || new Date()));
  const [reason, setReason] = useState(editing?.reason || "");
  const [remarks, setRemarks] = useState(editing?.remarks || "");
  const [lines, setLines] = useState<LineDraft[]>(
    editing
      ? editing.lines.map((l) => ({
          key: nextKey++,
          row: rowKey(l.sku, l.from_bin_id),
          quantity: String(l.qty),
          serials: (l.serials || []).join("\n"),
        }))
      : [blankLine()],
  );
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [stock, setStock] = useState<StockBalanceRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const snapshot = JSON.stringify({ fromId, toId, date, reason, remarks, lines: lines.map(({ key: _key, ...rest }) => rest) });
  const [initial] = useState(snapshot);
  const dirty = snapshot !== initial;

  /* Where goods can go and what is on the shelf both follow the sending warehouse. */
  useEffect(() => {
    if (!fromId) return;
    let cancelled = false;
    Promise.all([
      getTransferDestinationsApi(fromId),
      getStockBalancesApi({ warehouse_id: fromId, status: "UNRESTRICTED", size: 200 }),
    ])
      .then(([places, balances]) => {
        if (cancelled) return;
        setLoadError(null);
        setDestinations(places);
        setStock(balances.data.filter((b) => b.qty_available > 0 || (editing && editing.lines.some((l) => l.sku === b.sku))));
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorText(err, "Could not load this warehouse's stock and sister warehouses."));
      });
    return () => {
      cancelled = true;
    };
  }, [fromId, editing]);

  const stockByRow = useMemo(() => new Map(stock.map((b) => [rowKey(b.sku, b.bin_id), b])), [stock]);

  const update = (key: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId) return addToast("Choose the warehouse the goods leave from.", "warning");
    if (!toId) return addToast("Choose the warehouse the goods go to.", "warning");

    const payloadLines = [];
    for (const [index, line] of lines.entries()) {
      const label = `Line ${index + 1}`;
      const held = stockByRow.get(line.row);
      const quantity = line.quantity.trim() === "" ? null : Number(line.quantity);
      const serials = splitSerials(line.serials);
      if (!line.row) return addToast(`${label}: choose a product.`, "warning");
      if (quantity === null || !Number.isFinite(quantity) || quantity <= 0)
        return addToast(`${label}: enter a quantity above zero.`, "warning");
      if (held && quantity > held.qty_available)
        return addToast(`${label}: only ${qty(held.qty_available)} is available in bin ${held.bin_code}.`, "warning");
      if (serials.length && serials.length !== quantity)
        return addToast(`${label}: ${serials.length} serial(s) for a quantity of ${quantity}. Enter one per unit.`, "warning");
      const [sku, binId] = line.row.split("|");
      payloadLines.push({ sku, bin_id: binId, quantity, serials });
    }

    try {
      setSaving(true);
      const body = {
        to_warehouse_id: toId,
        transfer_date: date || undefined,
        reason: reason.trim() || undefined,
        remarks: remarks.trim() || undefined,
        lines: payloadLines,
      };
      const saved = editing ? await updateTransferApi(editing.id, body) : await createTransferApi({ from_warehouse_id: fromId, ...body });
      addToast(editing ? "Draft updated." : `Saved as draft ${saved.transfer_number}.`, "success");
      onSaved(saved);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not save the transfer."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? `Edit ${editing.transfer_number}` : "New Stock Transfer"}
      size="xl"
      hasUnsavedChanges={dirty && !saving}
    >
      <form onSubmit={save} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="trf-from" className={LABEL}>
              From Warehouse *
            </label>
            <select
              id="trf-from"
              className={FIELD}
              disabled={!!editing}
              value={fromId}
              onChange={(e) => {
                setFromId(e.target.value);
                setToId("");
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
          <div className="space-y-1.5">
            <label htmlFor="trf-to" className={LABEL}>
              To Warehouse *
            </label>
            <select id="trf-to" className={FIELD} disabled={!fromId} value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">{fromId && destinations.length === 0 ? "No other warehouse in this company" : "Select warehouse..."}</option>
              {destinations.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.location_name} ({w.location_code})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">Same company only. Goods for another company are a sale, not a transfer.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Transfer Date *" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Reason" placeholder="e.g. Rebalance stock for Lucknow orders" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        {loadError && (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600">
            {loadError}
          </p>
        )}

        <div className="space-y-3">
          <p className={LABEL}>Products</p>
          {lines.map((line, index) => {
            const held = stockByRow.get(line.row);
            return (
              <div
                key={line.key}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-[#0d2336] dark:bg-[#071929]/40"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="space-y-1.5 sm:col-span-8">
                    <label htmlFor={`trf-row-${line.key}`} className={LABEL}>
                      Product and Bin *
                    </label>
                    <select
                      id={`trf-row-${line.key}`}
                      className={FIELD}
                      disabled={!fromId}
                      value={line.row}
                      onChange={(e) => update(line.key, { row: e.target.value })}
                    >
                      <option value="">{fromId ? (stock.length ? "Select product..." : "Nothing available here") : "Choose a warehouse first"}</option>
                      {stock.map((b) => (
                        <option key={b.id} value={rowKey(b.sku, b.bin_id)}>
                          {b.product_name || b.sku} · {b.sku} · bin {b.bin_code} · {qty(b.qty_available)} available
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <label htmlFor={`trf-qty-${line.key}`} className={LABEL}>
                      Qty *
                    </label>
                    <input
                      id={`trf-qty-${line.key}`}
                      type="number"
                      min="0"
                      max={held?.qty_available}
                      step="any"
                      inputMode="decimal"
                      className={FIELD}
                      value={line.quantity}
                      onChange={(e) => update(line.key, { quantity: e.target.value })}
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
                <div className="space-y-1.5">
                  <label htmlFor={`trf-serials-${line.key}`} className={LABEL}>
                    Serial Numbers, for serial-numbered goods ({splitSerials(line.serials).length} of {line.quantity || 0})
                  </label>
                  <textarea
                    id={`trf-serials-${line.key}`}
                    rows={2}
                    className={`${FIELD} font-mono text-xs`}
                    placeholder="One per line, or separated by commas. Leave empty for goods counted by quantity."
                    value={line.serials}
                    onChange={(e) => update(line.key, { serials: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<FiPlus />}
            disabled={!fromId}
            onClick={() => setLines((current) => [...current, blankLine()])}
          >
            Add Product
          </Button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="trf-remarks" className={LABEL}>
            Remarks
          </label>
          <textarea id="trf-remarks" rows={2} className={FIELD} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
          <p className="text-xs text-slate-500">Saved as a draft. Stock moves only when the approved transfer ships.</p>
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
