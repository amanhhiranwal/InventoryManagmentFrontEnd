"use client";

/**
 * One dispatch order: its lines, where it is in the process, and the next
 * step - pick (serials), pack, delivery documents, commit (the stock-out),
 * proof of delivery. The server enforces every step and permission too.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiArrowLeft, FiCheck, FiClipboard, FiTruck, FiX } from "react-icons/fi";

import { ListPage } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  DispatchDocuments,
  DispatchOrder,
  cancelDispatchApi,
  commitDispatchApi,
  getDispatchApi,
  packDispatchApi,
  pickDispatchApi,
  recordPodApi,
  saveDispatchDocumentsApi,
} from "@/features/stock/api/dispatch.api";
import { DispatchStatusPill, errorText, money, qty } from "@/features/stock/components/stockUi";
import { formatDate, formatDateTime, toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const CARD = "rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]";
const FIELD =
  "w-full rounded-lg border border-[#cccccc] bg-white px-3 py-2 text-[13px] text-[#141414] outline-none transition focus:border-[#233353] disabled:bg-slate-50 disabled:text-slate-500 dark:border-[#17304a] dark:bg-[#071929] dark:text-white";
const LABEL = "text-[12px] text-[#777777] dark:text-slate-400";
const OPEN = ["DRAFT", "PICKED", "PACKED"];

const splitSerials = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

function Process({ status }: { status: string }) {
  const order = ["DRAFT", "PICKED", "PACKED", "DISPATCHED", "DELIVERED"];
  const reached = order.indexOf(status);
  const steps = [
    ["Dispatch Order", "Lines and quantities, within the reservation"],
    ["Picked", "Serials allocated; no stock moves"],
    ["Packed", "Packages and weight; no stock moves"],
    ["Dispatched", "Committed: stock has gone out"],
    ["Delivered", "Proof of delivery recorded"],
  ];
  return (
    <aside className={`${CARD} h-fit`}>
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
        <FiClipboard /> Dispatch Process
      </h2>
      {status === "CANCELLED" ? (
        <p className="text-[13px] text-[#777777]">This dispatch was cancelled before it left. No stock moved.</p>
      ) : (
        <ol className="space-y-4">
          {steps.map(([title, note], index) => {
            const done = index < reached || (status === "DELIVERED" && index === 4);
            const current = index === reached + 1 || (index === 0 && reached < 0);
            return (
              <li key={title} className="flex gap-3">
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    done ? "bg-emerald-500 text-white" : current ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700"
                  }`}
                >
                  {done ? <FiCheck /> : index + 1}
                </span>
                <div>
                  <p className={`text-[13px] font-semibold ${done || current ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                    {title}
                    <span className="sr-only">{done ? " (done)" : current ? " (next)" : " (to come)"}</span>
                  </p>
                  {(done || current) && <p className="text-[12px] text-[#777777]">{note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

export default function DispatchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useUIStore();
  const id = Number(params.id);

  const canView = hasPermission("dispatch.read");
  const canManage = hasPermission("dispatch.manage");
  const canCommit = hasPermission("dispatch.commit");

  const [d, setD] = useState<DispatchOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [serials, setSerials] = useState<Record<number, string>>({});
  const [packages, setPackages] = useState("");
  const [weight, setWeight] = useState("");
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [receiver, setReceiver] = useState("");
  const [podRemarks, setPodRemarks] = useState("");

  const adopt = useCallback((next: DispatchOrder) => {
    setD(next);
    setSerials(Object.fromEntries(next.lines.map((l) => [l.id, (l.serials || []).join("\n")])));
    setPackages(next.packages ? String(next.packages) : "");
    setWeight(next.gross_weight || "");
    setDocs({
      transporter: next.transporter || "",
      vehicle_number: next.vehicle_number || "",
      driver_name: next.driver_name || "",
      docket_no: next.docket_no || "",
      challan_no: next.challan_no || "",
      challan_date: toDateInput(next.challan_date),
      invoice_no: next.invoice_no || "",
      eway_bill_no: next.eway_bill_no || "",
      eway_bill_date: toDateInput(next.eway_bill_date),
      eway_valid_until: toDateInput(next.eway_valid_until),
      gate_pass_no: next.gate_pass_no || "",
      consignment_value: next.consignment_value === null || next.consignment_value === undefined ? "" : String(next.consignment_value),
    });
  }, []);

  useEffect(() => {
    if (!canView || !Number.isFinite(id)) return;
    getDispatchApi(id)
      .then(adopt)
      .catch((err: unknown) => setError(errorText(err, "Could not open this dispatch order.")));
  }, [canView, id, adopt]);

  const run = async (key: string, action: () => Promise<DispatchOrder>, message: string) => {
    try {
      setBusy(key);
      adopt(await action());
      addToast(message, "success");
    } catch (err: unknown) {
      addToast(errorText(err, "That did not go through."), "error");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return (
      <ListPage>
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929]">You do not have access to Dispatch.</p>
      </ListPage>
    );
  }
  if (error) {
    return (
      <ListPage>
        <p role="alert" className="rounded-xl bg-white p-8 text-center text-[13px] text-rose-600 dark:bg-[#071929]">
          {error}
        </p>
        <Link href="/inventory/stock-out?view=dispatch" className="text-[13px] text-[#233353] hover:underline">
          Back to Stock Out
        </Link>
      </ListPage>
    );
  }
  if (!d) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <CgSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  const open = OPEN.includes(d.status);
  const valueNumber = docs.consignment_value === "" ? null : Number(docs.consignment_value);
  const needsEway = valueNumber !== null && valueNumber >= d.eway_bill_threshold;

  const savePick = () =>
    run(
      "pick",
      () => pickDispatchApi(d.id, d.lines.map((l) => ({ line_id: l.id, serials: splitSerials(serials[l.id] || "") }))),
      "Picked. No stock has moved yet.",
    );

  const savePack = () => {
    const count = Number(packages);
    if (!Number.isInteger(count) || count < 1) return addToast("Enter how many packages.", "warning");
    return run("pack", () => packDispatchApi(d.id, count, weight.trim() || undefined), "Packed and ready to dispatch.");
  };

  const saveDocs = () => {
    if (valueNumber !== null && (!Number.isFinite(valueNumber) || valueNumber < 0))
      return addToast("The consignment value cannot be negative.", "warning");
    const payload: DispatchDocuments = {
      transporter: docs.transporter.trim() || null,
      vehicle_number: docs.vehicle_number.trim().toUpperCase() || null,
      driver_name: docs.driver_name.trim() || null,
      docket_no: docs.docket_no.trim() || null,
      challan_no: docs.challan_no.trim() || null,
      challan_date: docs.challan_date || null,
      invoice_no: docs.invoice_no.trim() || null,
      eway_bill_no: docs.eway_bill_no.trim() || null,
      eway_bill_date: docs.eway_bill_date || null,
      eway_valid_until: docs.eway_valid_until || null,
      gate_pass_no: docs.gate_pass_no.trim() || null,
      consignment_value: valueNumber,
    };
    return run("docs", () => saveDispatchDocumentsApi(d.id, payload), "Documents saved.");
  };

  const commit = () => {
    if (!window.confirm(`Commit ${d.do_number}? The goods have left the warehouse and stock goes out. This cannot be undone.`)) return;
    return run("commit", () => commitDispatchApi(d.id), `${d.do_number} dispatched. Stock has gone out.`);
  };

  const cancel = () => {
    const reason = window.prompt(`Why is ${d.do_number} being cancelled?`);
    if (reason === null) return;
    if (!reason.trim()) return addToast("Say why it is cancelled.", "warning");
    return run("cancel", () => cancelDispatchApi(d.id, reason.trim()), `${d.do_number} cancelled. Picked serials are back on the shelf.`);
  };

  const savePod = () => {
    if (!receiver.trim()) return addToast("Enter who received the goods.", "warning");
    return run("pod", () => recordPodApi(d.id, receiver.trim(), podRemarks.trim() || undefined), "Delivery recorded.");
  };

  const docField = (key: string, label: string, type = "text") => (
    <label key={key} className="space-y-1">
      <span className={LABEL}>{label}</span>
      <input
        type={type}
        className={FIELD}
        disabled={!open || !canManage}
        value={docs[key] ?? ""}
        onChange={(e) => setDocs({ ...docs, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <ListPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Back to Stock Out"
            onClick={() => router.push("/inventory/stock-out?view=dispatch")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#0b2034]"
          >
            <FiArrowLeft />
          </button>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">{d.do_number}</h1>
          <DispatchStatusPill status={d.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && open && (
            <Button variant="danger" size="sm" icon={<FiX />} loading={busy === "cancel"} disabled={!!busy} onClick={cancel}>
              Cancel Dispatch
            </Button>
          )}
          {canCommit && d.status === "PACKED" && (
            <Button size="sm" icon={<FiTruck />} loading={busy === "commit"} disabled={!!busy} onClick={commit}>
              Commit Dispatch
            </Button>
          )}
        </div>
      </div>

      {d.status === "CANCELLED" && d.cancelled_reason && (
        <p role="note" className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-[13px] text-slate-600 dark:bg-[#071929]">
          Cancelled: {d.cancelled_reason}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className={CARD}>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] lg:grid-cols-2">
              {[
                ["Sales Order", d.order_number || String(d.sales_order_id)],
                ["Customer", d.customer_name],
                ["Company", d.company_name],
                ["Ships From", `${d.warehouse_name || ""}${d.warehouse_code ? ` (${d.warehouse_code})` : ""}`],
                ["Dispatch Date", formatDate(d.dispatch_date)],
                ["Created By", d.created_by_name],
                ["Committed", d.committed_at ? `${formatDateTime(d.committed_at)} by ${d.committed_by_name}` : "-"],
                ["Delivered", d.delivered_at ? `${formatDateTime(d.delivered_at)} to ${d.pod_receiver}` : "-"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className={`w-28 shrink-0 ${LABEL}`}>{label}</dt>
                  <dd className="font-medium text-[#141414] dark:text-white">{value || "-"}</dd>
                </div>
              ))}
              <div className="flex gap-3 lg:col-span-2">
                <dt className={`w-28 shrink-0 ${LABEL}`}>Ship To</dt>
                <dd className="font-medium text-[#141414] dark:text-white">{d.ship_to || "-"}</dd>
              </div>
            </dl>
          </section>

          <section className={CARD}>
            <h2 className="mb-3 text-[15px] font-semibold text-slate-900 dark:text-white">Products &amp; Serials</h2>
            <div className="space-y-3">
              {d.lines.map((line) => (
                <div key={line.id} className="rounded-lg border border-slate-200 p-3 dark:border-[#17304a]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-semibold">
                      {line.product_name || line.sku} <span className="font-mono text-[11px] font-normal text-[#777777]">{line.sku}</span>
                    </p>
                    <p className="text-[12px] text-[#777777]">
                      Qty {qty(line.qty)} · picked {qty(line.qty_picked)}
                    </p>
                  </div>
                  {canManage && (d.status === "DRAFT" || d.status === "PICKED") ? (
                    <label className="mt-2 block space-y-1">
                      <span className={LABEL}>
                        Serial numbers ({splitSerials(serials[line.id] || "").length} of {qty(line.qty)}) - leave empty for products
                        counted by quantity
                      </span>
                      <textarea
                        rows={2}
                        className={`${FIELD} font-mono text-[12px]`}
                        value={serials[line.id] || ""}
                        onChange={(e) => setSerials({ ...serials, [line.id]: e.target.value })}
                      />
                    </label>
                  ) : (
                    line.serials.length > 0 && <p className="mt-2 font-mono text-[11px] text-[#555555]">S/N: {line.serials.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
            {canManage && (d.status === "DRAFT" || d.status === "PICKED") && (
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant={d.status === "PICKED" ? "outline" : "primary"} loading={busy === "pick"} disabled={!!busy} onClick={savePick}>
                  {d.status === "PICKED" ? "Update Pick" : "Confirm Pick"}
                </Button>
              </div>
            )}
          </section>

          {canManage && d.status === "PICKED" && (
            <section className={CARD}>
              <h2 className="mb-3 text-[15px] font-semibold text-slate-900 dark:text-white">Packing</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className={LABEL}>Packages *</span>
                  <input type="number" min="1" step="1" className={FIELD} value={packages} onChange={(e) => setPackages(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className={LABEL}>Gross Weight</span>
                  <input className={FIELD} placeholder="e.g. 84 kg" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </label>
                <div className="flex items-end">
                  <Button size="sm" loading={busy === "pack"} disabled={!!busy} onClick={savePack}>
                    Mark Packed
                  </Button>
                </div>
              </div>
            </section>
          )}

          <section className={CARD}>
            <h2 className="mb-1 text-[15px] font-semibold text-slate-900 dark:text-white">Delivery Documents</h2>
            <p className="mb-3 text-[12px] text-[#777777]">
              Challan, gate pass and a vehicle or docket are needed to dispatch. An e-way bill is needed when the consignment value is
              {" "}
              {money(d.eway_bill_threshold)} or more.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {docField("challan_no", "Delivery Challan No. *")}
              {docField("challan_date", "Challan Date", "date")}
              {docField("invoice_no", "Invoice No.")}
              {docField("gate_pass_no", "Gate Pass No. *")}
              {docField("consignment_value", "Consignment Value (Rs.) *", "number")}
              {docField("transporter", "Transporter / Courier")}
              {docField("vehicle_number", "Vehicle Number")}
              {docField("driver_name", "Driver Name")}
              {docField("docket_no", "Docket / LR No.")}
              {docField("eway_bill_no", needsEway ? "E-Way Bill No. *" : "E-Way Bill No.")}
              {docField("eway_bill_date", "E-Way Bill Date", "date")}
              {docField("eway_valid_until", needsEway ? "E-Way Bill Valid Until *" : "E-Way Bill Valid Until", "date")}
            </div>
            {canManage && open && (
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="outline" loading={busy === "docs"} disabled={!!busy} onClick={saveDocs}>
                  Save Documents
                </Button>
              </div>
            )}
          </section>

          {d.status === "DISPATCHED" && canManage && (
            <section className={CARD}>
              <h2 className="mb-3 text-[15px] font-semibold text-slate-900 dark:text-white">Proof of Delivery</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className={LABEL}>Received By *</span>
                  <input className={FIELD} value={receiver} onChange={(e) => setReceiver(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className={LABEL}>Remarks / exceptions</span>
                  <input className={FIELD} value={podRemarks} onChange={(e) => setPodRemarks(e.target.value)} />
                </label>
              </div>
              <p className="mt-2 text-[12px] text-[#777777]">Recording delivery moves no stock; it left when the dispatch was committed.</p>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="success" loading={busy === "pod"} disabled={!!busy} onClick={savePod}>
                  Record Delivery
                </Button>
              </div>
            </section>
          )}

          {d.status === "DELIVERED" && (
            <section className={CARD}>
              <h2 className="mb-2 text-[15px] font-semibold text-slate-900 dark:text-white">Proof of Delivery</h2>
              <p className="text-[13px]">
                Received by <strong>{d.pod_receiver}</strong> on {formatDateTime(d.delivered_at)}
                {d.pod_recorded_by_name ? `, recorded by ${d.pod_recorded_by_name}` : ""}.
              </p>
              {d.pod_remarks && <p className="mt-1 text-[13px] text-[#555555]">{d.pod_remarks}</p>}
            </section>
          )}
        </div>
        <Process status={d.status} />
      </div>
    </ListPage>
  );
}
