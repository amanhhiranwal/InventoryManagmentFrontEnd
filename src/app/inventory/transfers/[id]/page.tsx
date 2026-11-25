"use client";

/**
 * One transfer: what goes from where to where, where it is in the process,
 * and the next step - submit, approve (someone else), ship (stock leaves
 * and is in transit), receive at the other end with shortage and damage.
 * The server enforces every step, permission and warehouse too.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiArrowLeft, FiCheck, FiClipboard, FiEdit2, FiSend, FiTrash2, FiTruck, FiX } from "react-icons/fi";

import { ListPage } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import { getMyWarehousesApi, MyWarehouse } from "@/features/locations/api/locations.api";
import {
  ReceiveLine,
  Transfer,
  approveTransferApi,
  cancelTransferApi,
  deleteTransferApi,
  getTransferApi,
  receiveTransferApi,
  shipTransferApi,
  submitTransferApi,
} from "@/features/stock/api/transfers.api";
import TransferForm from "@/features/stock/components/TransferForm";
import { TransferStatusPill, errorText, qty, splitSerials } from "@/features/stock/components/stockUi";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const CARD = "rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]";
const FIELD =
  "w-full rounded-lg border border-[#cccccc] bg-white px-3 py-2 text-[13px] text-[#141414] outline-none transition focus:border-[#233353] disabled:bg-slate-50 disabled:text-slate-500 dark:border-[#17304a] dark:bg-[#071929] dark:text-white";
const LABEL = "text-[12px] text-[#777777] dark:text-slate-400";
const BEFORE_SHIP = ["DRAFT", "SUBMITTED", "APPROVED"];

/** What arrived on one line, as typed; numbers stay text until sent. */
interface Arrival {
  good: string;
  damaged: string;
  serialsGood: string;
  serialsDamaged: string;
  remarks: string;
}

function Process({ status }: { status: string }) {
  const order = ["DRAFT", "SUBMITTED", "APPROVED", "SHIPPED", "RECEIVED"];
  const reached = order.indexOf(status);
  const steps = [
    ["Requested", "Products and quantities from the sending warehouse"],
    ["Submitted", "Sent for approval; no stock moves"],
    ["Approved", "By someone other than the requester; no stock moves"],
    ["Shipped", "Stock has left and is in transit"],
    ["Received", "In stock at the receiving warehouse"],
  ];
  return (
    <aside className={`${CARD} h-fit`}>
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
        <FiClipboard /> Transfer Process
      </h2>
      {status === "CANCELLED" ? (
        <p className="text-[13px] text-[#777777]">This transfer was cancelled before it shipped. No stock moved.</p>
      ) : (
        <ol className="space-y-4">
          {steps.map(([title, note], index) => {
            const done = index <= reached;
            const current = index === reached + 1;
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

export default function TransferDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useUIStore();
  const userId = useAuthStore((s) => s.user?.id);
  const id = Number(params.id);

  const canView = hasPermission("stock.read");
  const canCreate = hasPermission("transfer.create");
  const canApprove = hasPermission("transfer.approve");
  const canShip = hasPermission("transfer.ship");
  const canReceive = hasPermission("transfer.receive");

  const [t, setT] = useState<Transfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [warehouses, setWarehouses] = useState<MyWarehouse[]>([]);
  const [ship, setShip] = useState({ vehicle_number: "", docket_no: "", challan_no: "" });
  const [arrivals, setArrivals] = useState<Record<number, Arrival>>({});
  const [receiptRemarks, setReceiptRemarks] = useState("");

  const adopt = useCallback((next: Transfer) => {
    setT(next);
    setShip({ vehicle_number: next.vehicle_number || "", docket_no: next.docket_no || "", challan_no: next.challan_no || "" });
    setArrivals(
      Object.fromEntries(
        next.lines.map((l) => [
          l.id,
          { good: String(l.qty), damaged: "", serialsGood: (l.serials || []).join("\n"), serialsDamaged: "", remarks: "" },
        ]),
      ),
    );
  }, []);

  useEffect(() => {
    if (!canView || !Number.isFinite(id)) return;
    getTransferApi(id)
      .then(adopt)
      .catch((err: unknown) => setError(errorText(err, "Could not open this transfer.")));
  }, [canView, id, adopt]);

  const run = async (key: string, action: () => Promise<Transfer>, message: string) => {
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
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929]">You do not have access to warehouse stock.</p>
      </ListPage>
    );
  }
  if (error) {
    return (
      <ListPage>
        <p role="alert" className="rounded-xl bg-white p-8 text-center text-[13px] text-rose-600 dark:bg-[#071929]">
          {error}
        </p>
        <Link href="/inventory/stock?tab=transfers" className="text-[13px] text-[#233353] hover:underline">
          Back to Stock
        </Link>
      </ListPage>
    );
  }
  if (!t) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <CgSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  const mine = !!t.created_by && t.created_by === userId;

  const openEdit = async () => {
    try {
      setWarehouses(await getMyWarehousesApi());
      setEditing(true);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not load your warehouses."), "error");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete draft ${t.transfer_number}? This cannot be undone.`)) return;
    try {
      setBusy("delete");
      await deleteTransferApi(t.id);
      addToast(`${t.transfer_number} deleted.`, "success");
      router.push("/inventory/stock?tab=transfers");
    } catch (err: unknown) {
      addToast(errorText(err, "Could not delete the draft."), "error");
      setBusy(null);
    }
  };

  const cancel = () => {
    const reason = window.prompt(`Why is ${t.transfer_number} being cancelled?`);
    if (reason === null) return;
    if (!reason.trim()) return addToast("Say why it is cancelled.", "warning");
    return run("cancel", () => cancelTransferApi(t.id, reason.trim()), `${t.transfer_number} cancelled. No stock moved.`);
  };

  const doShip = () => {
    if (!ship.vehicle_number.trim() && !ship.docket_no.trim()) return addToast("Enter the vehicle number or the docket number.", "warning");
    if (!window.confirm(`Ship ${t.transfer_number}? The goods leave ${t.from_warehouse_name} and are in transit until received.`)) return;
    return run(
      "ship",
      () =>
        shipTransferApi(t.id, {
          vehicle_number: ship.vehicle_number.trim().toUpperCase() || undefined,
          docket_no: ship.docket_no.trim() || undefined,
          challan_no: ship.challan_no.trim() || undefined,
        }),
      `${t.transfer_number} shipped. The goods are in transit.`,
    );
  };

  const doReceive = () => {
    const lines: ReceiveLine[] = [];
    for (const line of t.lines) {
      const a = arrivals[line.id];
      const label = `${line.sku}`;
      const good = a.good.trim() === "" ? null : Number(a.good);
      const damaged = a.damaged.trim() === "" ? 0 : Number(a.damaged);
      if (good === null || !Number.isFinite(good) || good < 0) return addToast(`${label}: enter how many arrived in good order.`, "warning");
      if (!Number.isFinite(damaged) || damaged < 0) return addToast(`${label}: the damaged quantity cannot be negative.`, "warning");
      if (good + damaged > line.qty) return addToast(`${label}: ${good + damaged} recorded but only ${line.qty} shipped.`, "warning");
      if (good + damaged < line.qty && !a.remarks.trim()) return addToast(`${label}: say what happened to the missing goods.`, "warning");
      if (damaged > 0 && !a.remarks.trim()) return addToast(`${label}: say what is damaged.`, "warning");
      lines.push({
        line_id: line.id,
        qty_received: good,
        qty_damaged: damaged,
        serials_received: line.serials.length ? splitSerials(a.serialsGood) : [],
        serials_damaged: line.serials.length ? splitSerials(a.serialsDamaged) : [],
        remarks: a.remarks.trim() || undefined,
      });
    }
    if (!window.confirm(`Receive ${t.transfer_number} at ${t.to_warehouse_name}? Stock goes in as recorded; any shortfall is written off.`)) return;
    return run(
      "receive",
      () => receiveTransferApi(t.id, { lines, remarks: receiptRemarks.trim() || undefined }),
      `${t.transfer_number} received.`,
    );
  };

  const setArrival = (lineId: number, patch: Partial<Arrival>) => setArrivals({ ...arrivals, [lineId]: { ...arrivals[lineId], ...patch } });

  return (
    <ListPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Back to Stock"
            onClick={() => router.push("/inventory/stock?tab=transfers")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#0b2034]"
          >
            <FiArrowLeft />
          </button>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">{t.transfer_number}</h1>
          <TransferStatusPill status={t.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && t.status === "DRAFT" && (
            <>
              <Button variant="outline" size="sm" icon={<FiTrash2 />} loading={busy === "delete"} disabled={!!busy} onClick={remove}>
                Delete
              </Button>
              <Button variant="outline" size="sm" icon={<FiEdit2 />} disabled={!!busy} onClick={openEdit}>
                Edit
              </Button>
              <Button
                size="sm"
                icon={<FiSend />}
                loading={busy === "submit"}
                disabled={!!busy}
                onClick={() => run("submit", () => submitTransferApi(t.id), "Sent for approval. No stock has moved.")}
              >
                Submit for Approval
              </Button>
            </>
          )}
          {canCreate && BEFORE_SHIP.includes(t.status) && t.status !== "DRAFT" && (
            <Button variant="danger" size="sm" icon={<FiX />} loading={busy === "cancel"} disabled={!!busy} onClick={cancel}>
              Cancel Transfer
            </Button>
          )}
          {!canCreate && canApprove && t.status === "SUBMITTED" && (
            <Button variant="danger" size="sm" icon={<FiX />} loading={busy === "cancel"} disabled={!!busy} onClick={cancel}>
              Decline
            </Button>
          )}
          {canApprove && t.status === "SUBMITTED" && (
            <Button
              variant="success"
              size="sm"
              icon={<FiCheck />}
              loading={busy === "approve"}
              disabled={!!busy || mine}
              title={mine ? "Someone other than the requester has to approve it." : undefined}
              onClick={() => run("approve", () => approveTransferApi(t.id), "Approved. It can now ship.")}
            >
              Approve
            </Button>
          )}
        </div>
      </div>

      {canApprove && t.status === "SUBMITTED" && mine && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-700 dark:bg-amber-950/20">
          You requested this transfer, so someone else has to approve it.
        </p>
      )}
      {t.status === "CANCELLED" && t.cancelled_reason && (
        <p role="note" className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-[13px] text-slate-600 dark:bg-[#071929]">
          Cancelled: {t.cancelled_reason}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className={CARD}>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] lg:grid-cols-2">
              {[
                ["From", `${t.from_warehouse_name || ""}${t.from_warehouse_code ? ` (${t.from_warehouse_code})` : ""}`],
                ["To", `${t.to_warehouse_name || ""}${t.to_warehouse_code ? ` (${t.to_warehouse_code})` : ""}`],
                ["Company", t.company_name],
                ["Transfer Date", formatDate(t.transfer_date)],
                ["Requested By", t.created_by_name],
                ["Approved", t.approved_at ? `${formatDateTime(t.approved_at)} by ${t.approved_by_name}` : "-"],
                ["Shipped", t.shipped_at ? `${formatDateTime(t.shipped_at)} by ${t.shipped_by_name}` : "-"],
                ["Received", t.received_at ? `${formatDateTime(t.received_at)} by ${t.received_by_name}` : "-"],
                ["Vehicle / Docket", [t.vehicle_number, t.docket_no].filter(Boolean).join(" · ")],
                ["Challan No.", t.challan_no],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className={`w-28 shrink-0 ${LABEL}`}>{label}</dt>
                  <dd className="font-medium text-[#141414] dark:text-white">{value || "-"}</dd>
                </div>
              ))}
              {(t.reason || t.remarks || t.receipt_remarks) && (
                <div className="flex gap-3 lg:col-span-2">
                  <dt className={`w-28 shrink-0 ${LABEL}`}>Notes</dt>
                  <dd className="font-medium text-[#141414] dark:text-white">
                    {[t.reason, t.remarks, t.receipt_remarks].filter(Boolean).join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className={CARD}>
            <h2 className="mb-3 text-[15px] font-semibold text-slate-900 dark:text-white">Products</h2>
            <div className="space-y-3">
              {t.lines.map((line) => {
                const a = arrivals[line.id];
                const receiving = canReceive && t.status === "SHIPPED" && a;
                return (
                  <div key={line.id} className="rounded-lg border border-slate-200 p-3 dark:border-[#17304a]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13px] font-semibold">
                        {line.product_name || line.sku} <span className="font-mono text-[11px] font-normal text-[#777777]">{line.sku}</span>
                      </p>
                      <p className="text-[12px] text-[#777777]">
                        Qty {qty(line.qty)}
                        {line.qty_received !== null && line.qty_received !== undefined && (
                          <>
                            {" "}· received {qty(line.qty_received)}
                            {line.qty_damaged ? ` · damaged ${qty(line.qty_damaged)}` : ""}
                            {line.qty_short ? ` · short ${qty(line.qty_short)}` : ""}
                          </>
                        )}
                      </p>
                    </div>
                    {line.serials.length > 0 && !receiving && (
                      <p className="mt-2 font-mono text-[11px] text-[#555555]">S/N: {line.serials.join(", ")}</p>
                    )}
                    {line.remarks && !receiving && <p className="mt-1 text-[12px] text-[#555555]">{line.remarks}</p>}
                    {receiving && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="space-y-1">
                          <span className={LABEL}>Arrived in good order *</span>
                          <input
                            type="number"
                            min="0"
                            max={line.qty}
                            step="any"
                            className={FIELD}
                            value={a.good}
                            onChange={(e) => setArrival(line.id, { good: e.target.value })}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className={LABEL}>Arrived damaged</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className={FIELD}
                            value={a.damaged}
                            onChange={(e) => setArrival(line.id, { damaged: e.target.value })}
                          />
                        </label>
                        {line.serials.length > 0 && (
                          <>
                            <label className="space-y-1 sm:col-span-3 lg:col-span-1">
                              <span className={LABEL}>Serials received good</span>
                              <textarea
                                rows={2}
                                className={`${FIELD} font-mono text-[12px]`}
                                value={a.serialsGood}
                                onChange={(e) => setArrival(line.id, { serialsGood: e.target.value })}
                              />
                            </label>
                            <label className="space-y-1 sm:col-span-3 lg:col-span-1">
                              <span className={LABEL}>Serials damaged</span>
                              <textarea
                                rows={2}
                                className={`${FIELD} font-mono text-[12px]`}
                                value={a.serialsDamaged}
                                onChange={(e) => setArrival(line.id, { serialsDamaged: e.target.value })}
                              />
                            </label>
                          </>
                        )}
                        <label className="space-y-1 sm:col-span-3 lg:col-span-1">
                          <span className={LABEL}>What happened (needed for shortage or damage)</span>
                          <input className={FIELD} value={a.remarks} onChange={(e) => setArrival(line.id, { remarks: e.target.value })} />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {canShip && t.status === "APPROVED" && (
            <section className={CARD}>
              <h2 className="mb-1 text-[15px] font-semibold text-slate-900 dark:text-white">Ship</h2>
              <p className="mb-3 text-[12px] text-[#777777]">
                Shipping takes the goods out of {t.from_warehouse_name}; they are in transit at {t.to_warehouse_name} until received.
                Reserved stock cannot ship.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className={LABEL}>Vehicle Number</span>
                  <input className={FIELD} value={ship.vehicle_number} onChange={(e) => setShip({ ...ship, vehicle_number: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className={LABEL}>Courier Docket No.</span>
                  <input className={FIELD} value={ship.docket_no} onChange={(e) => setShip({ ...ship, docket_no: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className={LABEL}>Delivery Challan No.</span>
                  <input className={FIELD} value={ship.challan_no} onChange={(e) => setShip({ ...ship, challan_no: e.target.value })} />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" icon={<FiTruck />} loading={busy === "ship"} disabled={!!busy} onClick={doShip}>
                  Ship Transfer
                </Button>
              </div>
            </section>
          )}

          {canReceive && t.status === "SHIPPED" && (
            <section className={CARD}>
              <h2 className="mb-1 text-[15px] font-semibold text-slate-900 dark:text-white">Receive</h2>
              <p className="mb-3 text-[12px] text-[#777777]">
                Record what arrived on each line above. Good units go into stock, damaged units are blocked, and anything missing is
                written off with the reason you give.
              </p>
              <label className="block space-y-1">
                <span className={LABEL}>Remarks</span>
                <input className={FIELD} value={receiptRemarks} onChange={(e) => setReceiptRemarks(e.target.value)} />
              </label>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="success" icon={<FiCheck />} loading={busy === "receive"} disabled={!!busy} onClick={doReceive}>
                  Receive Transfer
                </Button>
              </div>
            </section>
          )}
        </div>
        <Process status={t.status} />
      </div>

      {editing && (
        <TransferForm
          warehouses={warehouses}
          editing={t}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            adopt(saved);
          }}
        />
      )}
    </ListPage>
  );
}
