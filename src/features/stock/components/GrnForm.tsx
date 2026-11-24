"use client";

import { useEffect, useMemo, useState } from "react";
import { FiInfo, FiPackage, FiPlus, FiTrash2 } from "react-icons/fi";

import Button from "@/components/ui/Button";
import { MyWarehouse } from "@/features/locations/api/locations.api";
import { CatalogueProduct, getStockCatalogueApi } from "@/features/stock/api/stock.api";
import {
  Grn,
  GrnSave,
  GrnType,
  ReceivableOrder,
  ReturnableDispatch,
  createGrnApi,
  getReceivableOrdersApi,
  getReturnableDispatchesApi,
  submitGrnApi,
  updateGrnApi,
} from "@/features/stock/api/grn.api";
import GrnProcess from "@/features/stock/components/GrnProcess";
import { GRN_TYPE_LABEL, GrnStatusPill, errorText, qty } from "@/features/stock/components/stockUi";
import { formatDate, toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const CARD = "rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]";
const FIELD =
  "w-full rounded-lg border border-[#cccccc] bg-white px-3 py-2 text-[13px] text-[#141414] outline-none transition focus:border-[#233353] disabled:bg-slate-50 disabled:text-slate-500 dark:border-[#17304a] dark:bg-[#071929] dark:text-white";
const LABEL = "text-[12px] text-[#777777] dark:text-slate-400";

/** One line as typed. Quantities stay text until saved, so empty is empty. */
interface Line {
  key: string;
  po_item_id: number | null;
  /** A customer return against a dispatch: the line that went out. */
  dispatch_line_id: number | null;
  sku: string;
  description: string;
  uom: string;
  qty_ordered: string;
  /** What this GRN already held on the line when it was opened for editing,
      which the PO's open quantity is net of. */
  orig: number;
  qty_received: string;
  remarks: string;
}

let counter = 1;
const blank = (): Line => ({
  key: `n${counter++}`,
  po_item_id: null,
  dispatch_line_id: null,
  sku: "",
  description: "",
  uom: "",
  qty_ordered: "",
  orig: 0,
  qty_received: "",
  remarks: "",
});

/**
 * Record goods received at a warehouse - the GRN sheet as a form. Against a
 * PO, its lines come in with what is still to come; a return or goods with
 * no documents take the supplier by hand. Saving keeps a draft; nothing
 * reaches stock until quality check posts it.
 */
export default function GrnForm({
  warehouses,
  editing,
  onSaved,
  onCancel,
}: {
  warehouses: MyWarehouse[];
  editing: Grn | null;
  onSaved: (grn: Grn) => void;
  onCancel: () => void;
}) {
  const { addToast } = useUIStore();
  const [warehouseId, setWarehouseId] = useState(editing?.warehouse_id || (warehouses.length === 1 ? warehouses[0].id : ""));
  const [type, setType] = useState<GrnType>(editing?.receipt_type || "PURCHASE");
  const [poId, setPoId] = useState<number | null>(editing?.purchase_order_id ?? null);
  const [supplierName, setSupplierName] = useState(editing && editing.receipt_type !== "PURCHASE" ? editing.supplier_name : "");
  const [supplierAddress, setSupplierAddress] = useState(editing && editing.receipt_type !== "PURCHASE" ? editing.supplier_address || "" : "");
  const [receiptDate, setReceiptDate] = useState(toDateInput(editing?.receipt_date || new Date()));
  const [noteNo, setNoteNo] = useState(editing?.delivery_note_no || "");
  const [noteDate, setNoteDate] = useState(toDateInput(editing?.delivery_note_date));
  const [transport, setTransport] = useState(editing?.transport_remarks || "");
  const [remarks, setRemarks] = useState(editing?.remarks || "");
  const [lines, setLines] = useState<Line[]>(
    editing
      ? editing.lines.map((l) => ({
          key: `e${l.id}`,
          po_item_id: l.po_item_id ?? null,
          dispatch_line_id: l.dispatch_line_id ?? null,
          sku: l.sku,
          description: l.description || "",
          uom: l.uom || "",
          qty_ordered: l.qty_ordered === null || l.qty_ordered === undefined ? "" : String(l.qty_ordered),
          orig: l.qty_received,
          qty_received: String(l.qty_received),
          remarks: l.remarks || "",
        }))
      : [],
  );
  const [orders, setOrders] = useState<ReceivableOrder[]>([]);
  const [dispatchId, setDispatchId] = useState<number | null>(editing?.dispatch_order_id ?? null);
  const [dispatches, setDispatches] = useState<ReturnableDispatch[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "qc" | null>(null);

  /* What can be received here: this warehouse's company's open POs and its
     product catalogue. */
  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    Promise.all([getReceivableOrdersApi(warehouseId), getStockCatalogueApi(warehouseId)])
      .then(([pos, products]) => {
        if (cancelled) return;
        setLoadError(null);
        setOrders(pos);
        setCatalogue(products);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorText(err, "Could not load purchase orders and products for this warehouse."));
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  /* A return can name the dispatch the goods went out on; only what went
     out, less earlier returns, can come back on it. */
  useEffect(() => {
    if (!warehouseId || type !== "RETURN") return;
    let cancelled = false;
    getReturnableDispatchesApi(warehouseId)
      .then((rows) => {
        if (!cancelled) setDispatches(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorText(err, "Could not load this company's dispatches."));
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId, type]);

  const po = useMemo(() => orders.find((o) => o.id === poId) || null, [orders, poId]);
  const dispatch = useMemo(() => dispatches.find((d) => d.id === dispatchId) || null, [dispatches, dispatchId]);
  /* What can still come back on a dispatch line; this GRN's own draft
     quantity is already counted as taken, so it is added back. */
  const returnable = (line: Line) => {
    const item = dispatch?.lines.find((l) => l.id === line.dispatch_line_id);
    return item ? item.qty_returnable + line.orig : null;
  };

  const chooseDispatch = (id: number | null) => {
    setDispatchId(id);
    const chosen = dispatches.find((d) => d.id === id);
    if (chosen) setSupplierName(chosen.customer_name || "");
    setLines(
      chosen
        ? chosen.lines.map((l) => ({
            key: `d${l.id}`,
            po_item_id: null,
            dispatch_line_id: l.id,
            sku: l.sku.toUpperCase(),
            description: l.product_name || "",
            uom: "",
            qty_ordered: String(l.qty_dispatched),
            orig: 0,
            qty_received: "",
            remarks: "",
          }))
        : [blank()],
    );
  };
  const linked = type === "RETURN" && !!dispatchId;
  const productBySku = useMemo(() => new Map(catalogue.map((p) => [p.sku, p])), [catalogue]);
  const warehouse = warehouses.find((w) => w.id === warehouseId);

  /* Received so far and still to come on a PO line, read from the PO as it
     is now. This GRN's own draft quantity is part of what the PO counts as
     held, so it is added back. */
  const progress = (line: Line) => {
    const item = po?.items.find((i) => i.po_item_id === line.po_item_id);
    return item ? { already: item.qty_received, open: item.qty_open + line.orig } : null;
  };

  const choosePo = (id: number | null) => {
    setPoId(id);
    const chosen = orders.find((o) => o.id === id);
    setLines(
      chosen
        ? chosen.items
            .filter((i) => i.qty_open > 0)
            .map((i) => ({
              key: `p${i.po_item_id}`,
              po_item_id: i.po_item_id,
              dispatch_line_id: null,
              sku: (i.sku || "").toUpperCase(),
              description: i.product_name || i.description || "",
              uom: i.uom || "",
              qty_ordered: String(i.qty_ordered),
              orig: 0,
              qty_received: "",
              remarks: "",
            }))
        : [],
    );
  };

  const update = (key: string, patch: Partial<Line>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async (andSubmit: boolean) => {
    if (!warehouseId) return addToast("Choose the warehouse the goods came into.", "warning");
    if (type === "PURCHASE" && !poId) return addToast("Choose the purchase order.", "warning");
    if (type !== "PURCHASE" && !linked && !supplierName.trim()) return addToast("Enter who the goods came from.", "warning");

    const chosen = lines.filter((l) => l.qty_received.trim() !== "");
    if (chosen.length === 0) return addToast("Enter the quantity received for at least one product.", "warning");

    const payloadLines = [];
    for (const line of chosen) {
      const label = line.description || line.sku || "A line";
      const received = Number(line.qty_received);
      if (!Number.isFinite(received) || received <= 0) return addToast(`${label}: the quantity received must be above zero.`, "warning");
      const open = progress(line)?.open;
      if (open !== undefined && received > open)
        return addToast(`${label}: ${received} received but only ${open} is still to come on this PO.`, "warning");
      const back = linked ? returnable(line) : null;
      if (back !== null && received > back)
        return addToast(`${label}: only ${back} can still come back on ${dispatch?.do_number}.`, "warning");
      if (!line.sku.trim()) return addToast(`${label}: choose the product from the catalogue.`, "warning");
      const ordered = line.qty_ordered.trim() === "" ? null : Number(line.qty_ordered);
      payloadLines.push({
        po_item_id: type === "PURCHASE" ? line.po_item_id : null,
        dispatch_line_id: linked ? line.dispatch_line_id : null,
        sku: line.sku.trim().toUpperCase(),
        description: line.description.trim() || null,
        uom: line.uom.trim() || null,
        qty_ordered: type === "PURCHASE" || linked ? null : ordered,
        qty_received: received,
        remarks: line.remarks.trim() || null,
      });
    }

    const payload: GrnSave = {
      warehouse_id: warehouseId,
      receipt_type: type,
      purchase_order_id: type === "PURCHASE" ? poId : null,
      dispatch_order_id: linked ? dispatchId : null,
      supplier_name: type === "PURCHASE" ? null : supplierName.trim() || null,
      supplier_address: type === "PURCHASE" ? null : supplierAddress.trim() || null,
      delivery_note_no: noteNo.trim() || null,
      delivery_note_date: noteDate || null,
      receipt_date: receiptDate || null,
      transport_remarks: transport.trim() || null,
      remarks: remarks.trim() || null,
      lines: payloadLines,
    };

    try {
      setSaving(andSubmit ? "qc" : "draft");
      let grn = editing ? await updateGrnApi(editing.id, payload) : await createGrnApi(payload);
      if (andSubmit) grn = await submitGrnApi(grn.id);
      addToast(andSubmit ? `GRN ${grn.grn_number} sent in for receipt posting.` : `GRN ${grn.grn_number} saved as draft.`, "success");
      onSaved(grn);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not save the GRN."), "error");
    } finally {
      setSaving(null);
    }
  };

  const fact = (label: string, value?: string | null) => (
    <div className="flex gap-3 text-[13px]">
      <span className={`w-28 shrink-0 ${LABEL}`}>{label}</span>
      <span className="font-medium text-[#141414] dark:text-white">{value || "-"}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">Stock-In</h1>
          <GrnStatusPill status={editing?.status || "DRAFT"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" loading={saving === "draft"} disabled={!!saving} onClick={() => save(false)}>
            Save as Draft
          </Button>
          <Button size="sm" loading={saving === "qc"} disabled={!!saving} onClick={() => save(true)}>
            Save &amp; Send In
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className={CARD}>
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
              <FiInfo /> Purchase Order Details
            </h2>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className={LABEL}>Warehouse *</span>
                <select
                  className={FIELD}
                  disabled={!!editing}
                  value={warehouseId}
                  onChange={(e) => {
                    setWarehouseId(e.target.value);
                    choosePo(null);
                    /* A dispatch belongs to its warehouse's company; start the
                       return over rather than keep one from elsewhere. */
                    setDispatchId(null);
                    setDispatches([]);
                    if (type !== "PURCHASE") setLines([blank()]);
                  }}
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.location_name} ({w.location_code}){w.company_name ? ` · ${w.company_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL}>Received Against *</span>
                <select
                  className={FIELD}
                  disabled={!!editing}
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as GrnType);
                    choosePo(null);
                    setDispatchId(null);
                    if (e.target.value !== "PURCHASE") setLines([blank()]);
                  }}
                >
                  {Object.entries(GRN_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {type === "PURCHASE" ? (
                <>
                  <label className="space-y-1">
                    <span className={LABEL}>PO ID *</span>
                    <select
                      className={FIELD}
                      disabled={!warehouseId || !!editing}
                      value={poId ?? ""}
                      onChange={(e) => choosePo(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">{warehouseId ? (orders.length ? "Select PO ID" : "No open purchase orders") : "Choose a warehouse first"}</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.po_number} · {o.vendor_name}
                        </option>
                      ))}
                      {editing?.purchase_order_id && !orders.some((o) => o.id === editing.purchase_order_id) && (
                        <option value={editing.purchase_order_id}>{editing.po_number}</option>
                      )}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 dark:bg-[#0b2034] lg:grid-cols-2 md:col-span-2">
                    {fact("Vendor Name", po?.vendor_name || (editing?.receipt_type === "PURCHASE" ? editing.supplier_name : null))}
                    {fact("PO Date", formatDate(po?.po_date || editing?.po_date, "-"))}
                    {fact("Created by", po?.created_by_name)}
                    {fact("Company", warehouse?.company_name)}
                  </div>
                </>
              ) : (
                <>
                  {type === "RETURN" && (
                    <label className="space-y-1 md:col-span-2">
                      <span className={LABEL}>Against Dispatch</span>
                      <select
                        className={FIELD}
                        disabled={!warehouseId || !!editing}
                        value={dispatchId ?? ""}
                        onChange={(e) => chooseDispatch(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Not linked (no dispatch on record)</option>
                        {dispatches.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.do_number} · {d.customer_name || "-"}
                            {d.order_number ? ` · ${d.order_number}` : ""}
                          </option>
                        ))}
                        {editing?.dispatch_order_id && !dispatches.some((d) => d.id === editing.dispatch_order_id) && (
                          <option value={editing.dispatch_order_id}>{editing.do_number}</option>
                        )}
                      </select>
                      <span className="block text-[11px] text-[#777777]">
                        Linked, only what went out on that dispatch can come back. Returned goods go to quarantine for quality check.
                      </span>
                    </label>
                  )}
                  <label className="space-y-1">
                    <span className={LABEL}>{linked ? "Customer" : "Supplier / Received From *"}</span>
                    <input
                      className={FIELD}
                      placeholder={linked ? "From the sales order" : undefined}
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className={LABEL}>Supplier Address</span>
                    <input className={FIELD} value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} />
                  </label>
                </>
              )}

              <label className="space-y-1">
                <span className={LABEL}>Date of Receipt *</span>
                <input type="date" className={FIELD} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className={LABEL}>Delivery Note / Invoice No.</span>
                  <input className={FIELD} value={noteNo} onChange={(e) => setNoteNo(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className={LABEL}>Its Date</span>
                  <input type="date" className={FIELD} value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
                </label>
              </div>
              <label className="space-y-1 md:col-span-2">
                <span className={LABEL}>Received Via (transporter, vehicle, porter)</span>
                <input
                  className={FIELD}
                  placeholder="e.g. Received from PORTER"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                />
              </label>
            </div>
            {loadError && (
              <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-[13px] text-rose-600">
                {loadError}
              </p>
            )}
          </section>

          <section className={CARD}>
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
              <FiPackage /> Products &amp; Order Items
            </h2>
            <datalist id="grn-catalogue">
              {catalogue.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.name || p.sku}
                </option>
              ))}
            </datalist>
            {lines.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#777777]">
                {type === "PURCHASE" ? "Choose a purchase order to list its products." : "Add the products received."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#e2e2e2] text-[12px] text-[#777777] dark:border-[#17304a]">
                      <th className="px-2 py-2 font-normal">S.No</th>
                      <th className="px-2 py-2 font-normal">Product (SKU)</th>
                      <th className="px-2 py-2 font-normal text-right">{linked ? "Qty Dispatched" : "Qty Ordered"}</th>
                      {type === "PURCHASE" && <th className="px-2 py-2 font-normal text-right">Already In</th>}
                      <th className="px-2 py-2 font-normal">Qty Received *</th>
                      <th className="px-2 py-2 font-normal">Remarks</th>
                      {type !== "PURCHASE" && <th className="px-2 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.key} className="align-top">
                        <td className="px-2 py-3 text-[#777777]">{index + 1}</td>
                        <td className="min-w-[240px] px-2 py-2">
                          <input
                            list="grn-catalogue"
                            aria-label={`Product for line ${index + 1}`}
                            disabled={linked}
                            className={FIELD}
                            placeholder="Search the catalogue"
                            value={line.sku}
                            onChange={(e) => update(line.key, { sku: e.target.value })}
                          />
                          <span className="mt-1 block truncate text-[11px] text-[#777777]">
                            {line.description || productBySku.get(line.sku.trim().toUpperCase())?.name ||
                              (line.sku ? "Not in this company's catalogue" : "")}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          {type === "PURCHASE" || linked ? (
                            <>
                              {qty(Number(line.qty_ordered))}
                              {linked && returnable(line) !== null && (
                                <span className="block text-[11px] text-[#777777]">{qty(returnable(line))} can come back</span>
                              )}
                            </>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              aria-label={`Quantity ordered for line ${index + 1}`}
                              className={`${FIELD} w-24 text-right`}
                              value={line.qty_ordered}
                              onChange={(e) => update(line.key, { qty_ordered: e.target.value })}
                            />
                          )}
                        </td>
                        {type === "PURCHASE" && (
                          <td className="px-2 py-3 text-right text-[#777777]">
                            {qty(progress(line)?.already)}
                            {progress(line) && <span className="block text-[11px]">{qty(progress(line)?.open)} to come</span>}
                          </td>
                        )}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`Quantity received for line ${index + 1}`}
                            className={`${FIELD} w-28`}
                            value={line.qty_received}
                            onChange={(e) => update(line.key, { qty_received: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Remarks for line ${index + 1}`}
                            className={FIELD}
                            value={line.remarks}
                            onChange={(e) => update(line.key, { remarks: e.target.value })}
                          />
                        </td>
                        {type !== "PURCHASE" && (
                          <td className="px-2 py-2">
                            {!linked && (
                            <button
                              type="button"
                              aria-label={`Remove line ${index + 1}`}
                              disabled={lines.length === 1}
                              onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-30"
                            >
                              <FiTrash2 />
                            </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {type !== "PURCHASE" && !linked && (
              <Button className="mt-3" variant="outline" size="sm" icon={<FiPlus />} onClick={() => setLines((c) => [...c, blank()])}>
                Add Product
              </Button>
            )}
            {type === "PURCHASE" && lines.length > 0 && (
              <p className="mt-3 text-[12px] text-[#777777]">Leave Qty Received empty for products that did not come in this delivery.</p>
            )}
            <label className="mt-4 block space-y-1">
              <span className={LABEL}>Remarks</span>
              <textarea rows={2} className={FIELD} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </label>
          </section>
        </div>

        <GrnProcess status={editing?.status || "DRAFT"} poChosen={type !== "PURCHASE" || !!poId} poNumber={po?.po_number || editing?.po_number} />
      </div>
    </div>
  );
}
