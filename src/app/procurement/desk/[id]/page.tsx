"use client";

/**
 * The procurement workspace for one approved requisition: assignment,
 * status, notes, which vendors are asked to quote for which line, the
 * quotations entered so far, and the purchase orders created from them -
 * a PO is created from the comparison by choosing a vendor's quotation.
 *
 * The buttons shown follow the person's permissions as the server reports
 * them; every action is checked again on the server when it is pressed.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiBarChart2, FiEdit2, FiFilePlus, FiSend, FiUserCheck } from "react-icons/fi";

import Modal from "@/components/ui/Modal";
import {
  addNoteApi,
  assignRequisitionApi,
  changeQuantityApi,
  logRequisitionActivityApi,
  errorDetail,
  getExecutivesApi,
  getProcurementMetaApi,
  getWorkspaceApi,
  setProcurementRemarksApi,
  setProcurementStatusApi,
  requestQuotationsApi,
  vendorOptionsApi,
  type ProcurementMeta,
  type Workspace,
} from "@/features/procurement/api/procurement.api";
import DataList from "@/features/procurement/components/DataList";
import { ActivityHistory } from "@/features/procurement/components/ApprovalAndActivity";
import { DetailHeader, ProcurementTrack } from "@/features/procurement/components/DetailParts";
import { RequisitionLines, RequisitionSummary } from "@/features/procurement/components/RequisitionView";
import {
  Empty,
  ErrorState,
  INPUT,
  LABEL,
  Loading,
  Panel,
  ProcStatus,
  day,
  humanize,
  money,
  when,
} from "@/features/procurement/components/shared";
import { AttachmentList } from "@/features/attachments/AttachmentList";
import { useUIStore } from "@/lib/store/ui.store";

const BUTTON =
  "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition disabled:opacity-50";
const PRIMARY = `${BUTTON} bg-[#243454] text-white hover:bg-[#18243a]`;
const OUTLINE = `${BUTTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200`;
const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";
const LINK = "font-semibold text-[#233353] hover:underline dark:text-sky-300";

type Dialog = null | "assign" | "status" | "collection" | { quantity: number };

export default function ProcurementWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useUIStore();

  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ProcurementMeta | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  const [executives, setExecutives] = useState<{ id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ id: number; name: string; vendor_code: string }[]>([]);
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  /** Vendors to ask, per requisition line. */
  const [asking, setAsking] = useState<Record<number, number[]>>({});
  const [collectionNotes, setCollectionNotes] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quantityReason, setQuantityReason] = useState("");
  const [note, setNote] = useState("");
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getWorkspaceApi(id);
      setWs(data);
      setRemarks(data.procurement_remarks || "");
    } catch (failure) {
      setError(errorDetail(failure, "Could not load this requisition."));
    }
  }, [id]);

  useEffect(() => {
    load();
    getProcurementMetaApi().then(setMeta).catch(() => {});
  }, [load]);

  const can = (key: string) => Boolean(meta?.permissions?.[key]);
  const manage = can("procurement.manage");

  /** Run a desk action, take the workspace it returns, report its message. */
  const run = async (action: () => Promise<{ data: Workspace; message?: string }>) => {
    setBusy(true);
    try {
      const answer = await action();
      setWs(answer.data);
      setRemarks(answer.data.procurement_remarks || "");
      if (answer.message) addToast(answer.message, "success");
      setDialog(null);
      return true;
    } catch {
      return false; // the API client shows the server's reason
    } finally {
      setBusy(false);
    }
  };

  const openAssign = () => {
    setAssignee(ws?.assigned_to || "");
    getExecutivesApi().then(setExecutives).catch(() => setExecutives([]));
    setDialog("assign");
  };

  /* Opens with the vendors each line has already been asked, so adding
     one more vendor to a line is a single tick. */
  const openCollection = () => {
    setAsking(Object.fromEntries((ws?.items || []).map((item) => [item.id, item.rfq_vendor_ids || []])));
    setCollectionNotes("");
    vendorOptionsApi()
      .then(setVendors)
      .catch(() => setVendors([]));
    setDialog("collection");
  };

  const toggleVendor = (itemId: number, vendorId: number, on: boolean) =>
    setAsking((current) => {
      const list = current[itemId] || [];
      return { ...current, [itemId]: on ? [...new Set([...list, vendorId])] : list.filter((v) => v !== vendorId) };
    });

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!ws) return <Loading text="Loading the procurement workspace..." />;

  const latestQuotes = ws.quotations.filter((q) => q.is_latest);
  const closed = ["CANCELLED", "COMPLETED"].includes(ws.procurement_status || "");

  return (
    <div className="space-y-5 pb-8">
      <DetailHeader
        back={{ href: "/procurement/desk", label: "Procurement Desk" }}
        title={ws.pr_number}
        status={<ProcStatus status={ws.procurement_status} />}
        subtitle={ws.purpose}
        actions={
          manage && !closed ? (
            <>
              <button type="button" className={OUTLINE} onClick={openAssign}>
                <FiUserCheck size={13} /> {ws.assigned_name ? "Reassign" : "Assign"}
              </button>
              <button type="button" className={OUTLINE} onClick={() => { setStatus(""); setStatusRemarks(""); setDialog("status"); }}>
                <FiEdit2 size={13} /> Change Status
              </button>
              <button type="button" className={OUTLINE} onClick={openCollection}>
                <FiSend size={13} /> Request Quotations
              </button>
              <Link href={`/procurement/desk/${ws.id}/quotations/new`} className={PRIMARY}>
                <FiFilePlus size={13} /> Add Quotation
              </Link>
              {latestQuotes.length > 0 && (
                <Link href={`/procurement/desk/${ws.id}/compare`} className={PRIMARY}>
                  <FiBarChart2 size={13} /> Compare
                </Link>
              )}
            </>
          ) : undefined
        }
        facts={[
          {
            label: "Ordered",
            value: ws.purchase_orders.some((po) => po.status !== "CANCELLED")
              ? money(ws.purchase_orders.filter((po) => po.status !== "CANCELLED").reduce((sum, po) => sum + po.grand_total, 0))
              : "No PO yet",
          },
          { label: "Requested by", value: `${ws.requester_name}${ws.department_name ? `, ${ws.department_name}` : ""}` },
          { label: "Required by", value: day(ws.required_by) },
          { label: "Assigned to", value: ws.assigned_name || "Not assigned" },
          { label: "Quotations", value: latestQuotes.length },
        ]}
      />

      <ProcurementTrack pr={ws} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title={`Vendor Quotations (${latestQuotes.length})`}>
            {ws.quotations.length === 0 ? (
              <Empty text="No quotations entered yet. Collect them offline from vendors, then use Add Quotation to enter each one." />
            ) : (
              <DataList
                dense
                rows={latestQuotes}
                rowKey={(q) => q.id}
                rowHref={(q) => `/procurement/desk/quotations/${q.id}`}
                columns={[
                  {
                    header: "Vendor",
                    primary: true,
                    cell: (q) => (
                      <>
                        <Link href={`/procurement/desk/quotations/${q.id}`} className={LINK}>{q.vendor_name}</Link>
                        <span className={SUB}>{q.quotation_number}, {q.version_label}{q.vendor_reference ? `, ref ${q.vendor_reference}` : ""}</span>
                      </>
                    ),
                  },
                  { header: "Quoted On", nowrap: true, cell: (q) => day(q.quotation_date) },
                  {
                    header: "Valid Until",
                    nowrap: true,
                    cell: (q) => (
                      <>
                        {day(q.valid_until)}
                        {q.expired && <span className="mt-0.5 block text-[11px] font-semibold text-rose-600">Expired</span>}
                      </>
                    ),
                  },
                  { header: "Grand Total", align: "right", nowrap: true, cell: (q) => money(q.grand_total, q.currency) },
                  { header: "Status", primary: true, cell: (q) => <ProcStatus status={q.expired ? "EXPIRED" : q.status} /> },
                ]}
              />
            )}

            {ws.collections.length > 0 && (
              <div className="mt-4 border-t border-[#f3f3f3] pt-3 dark:border-[#17304a]">
                <p className="mb-2 text-[12px] text-[#777777]">Quotation requests (recorded here, sent by you)</p>
                <ul className="space-y-2 text-[12px] text-slate-700 dark:text-slate-300">
                  {ws.collections.map((c) => (
                    <li key={c.reference}>
                      <span className="font-semibold">{c.reference}</span>
                      {c.lines?.length ? (
                        <ul className="mt-0.5 space-y-0.5">
                          {c.lines.map((l) => (
                            <li key={l.item}>{l.item}: {l.vendors.join(", ")}</li>
                          ))}
                        </ul>
                      ) : (
                        <>: {c.vendors.join(", ")}</>
                      )}
                      <span className={SUB}>Recorded by {c.started_by_name || "—"} on {when(c.created_at)}</span>
                      {c.notes && <span className="block text-[#777777]">{c.notes}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {ws.purchase_orders.length > 0 && (
            <Panel title={`Purchase Orders (${ws.purchase_orders.length})`}>
              <DataList
                dense
                rows={ws.purchase_orders}
                rowKey={(po) => po.id}
                rowHref={(po) => `/procurement/purchase-orders/${po.id}`}
                columns={[
                  {
                    header: "Purchase Order",
                    primary: true,
                    cell: (po) => (
                      <>
                        <Link href={`/procurement/purchase-orders/${po.id}`} className={LINK}>{po.po_number}</Link>
                        <span className={SUB}>{day(po.po_date)}</span>
                      </>
                    ),
                  },
                  { header: "Vendor", cell: (po) => po.vendor_name },
                  { header: "Expected", nowrap: true, cell: (po) => day(po.expected_delivery) },
                  { header: "Grand Total", align: "right", nowrap: true, cell: (po) => money(po.grand_total, po.currency) },
                  { header: "Status", primary: true, cell: (po) => <ProcStatus status={po.status} /> },
                ]}
              />
            </Panel>
          )}

          <RequisitionLines
            pr={ws}
            showVendors
            action={
              manage && !closed
                ? (itemId) =>
                    ws.ordered_item_ids.includes(itemId) ? (
                      <span className="text-[11px] text-[#999999]">On a PO</span>
                    ) : (
                      <button
                        type="button"
                        className="whitespace-nowrap text-[12px] font-medium text-[#233353] hover:underline dark:text-sky-300"
                        onClick={() => {
                          const item = ws.items?.find((i) => i.id === itemId);
                          setQuantity(String(item?.effective_quantity ?? item?.quantity ?? ""));
                          setQuantityReason("");
                          setDialog({ quantity: itemId });
                        }}
                      >
                        Change Qty
                      </button>
                    )
                : undefined
            }
          />

          <RequisitionSummary pr={ws} />
        </div>

        <div className="space-y-5">
          <Panel title="Procurement Remarks">
            <div className="space-y-3">
              <p className="text-[12px] text-[#777777]">With procurement since {when(ws.procurement_since || ws.approved_at)}.</p>
              <div>
                <label className="sr-only" htmlFor="ws-remarks">Procurement remarks</label>
                <textarea id="ws-remarks" rows={3} className={INPUT} value={remarks} disabled={!manage} onChange={(e) => setRemarks(e.target.value)} />
                {manage && (
                  <button
                    type="button"
                    disabled={busy || remarks === (ws.procurement_remarks || "")}
                    onClick={() => run(() => setProcurementRemarksApi(ws.id, remarks))}
                    className={`${OUTLINE} mt-2`}
                  >
                    Save Remarks
                  </button>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Internal Notes">
            {(ws.internal_notes || []).length === 0 ? (
              <p className="text-[12px] text-[#999999]">No notes yet.</p>
            ) : (
              <ul className="mb-3 max-h-[260px] space-y-2 overflow-y-auto">
                {[...(ws.internal_notes || [])].reverse().map((n, i) => (
                  <li key={i} className="rounded-md bg-slate-50 px-2.5 py-2 text-[12px] dark:bg-[#0b2034]">
                    <p className="text-slate-700 dark:text-slate-200">{n.text}</p>
                    <p className="mt-0.5 text-[11px] text-[#999999]">{n.by} · {when(n.at)}</p>
                  </li>
                ))}
              </ul>
            )}
            {manage && (
              <div className="mt-2">
                <label className="sr-only" htmlFor="ws-note">Add a note</label>
                <textarea id="ws-note" rows={2} className={INPUT} placeholder="Add a note for the procurement team" value={note} onChange={(e) => setNote(e.target.value)} />
                <button
                  type="button"
                  disabled={busy || !note.trim()}
                  onClick={async () => { if (await run(() => addNoteApi(ws.id, note.trim()))) setNote(""); }}
                  className={`${OUTLINE} mt-2`}
                >
                  Add Note
                </button>
              </div>
            )}
          </Panel>

          <Panel title="Documents">
            <AttachmentList files={ws.attachments || []} empty="Nothing attached." />
          </Panel>

          <ActivityHistory
            rows={ws.activity}
            onLog={async (activity, remarks) => {
              try {
                const answer = await logRequisitionActivityApi(ws.id, activity, remarks);
                addToast(answer.message || "Activity logged.", "success");
                await load();
                return true;
              } catch {
                return false; // the API client shows the server's reason
              }
            }}
          />
        </div>
      </div>

      <Modal isOpen={dialog === "assign"} onClose={() => !busy && setDialog(null)} title="Assign procurement executive">
        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="assign-to">Executive *</label>
            <select id="assign-to" className={INPUT} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Select a person</option>
              {executives.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-[#999999]">People who hold procurement.manage.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={OUTLINE} onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className={PRIMARY} disabled={busy || !assignee} onClick={() => run(() => assignRequisitionApi(ws.id, assignee))}>
              Assign
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={dialog === "status"} onClose={() => !busy && setDialog(null)} title="Change procurement status">
        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="ws-status">New Status *</label>
            <select id="ws-status" className={INPUT} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Select</option>
              {(meta?.manual_statuses || []).map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-[#999999]">
              The other statuses follow the work itself: quotations, selection and purchase orders move them.
            </p>
          </div>
          <div>
            <label className={LABEL} htmlFor="ws-status-remarks">
              Remarks{["ON_HOLD", "CANCELLED"].includes(status) ? " *" : ""}
            </label>
            <textarea id="ws-status-remarks" rows={3} className={INPUT} value={statusRemarks} onChange={(e) => setStatusRemarks(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={OUTLINE} onClick={() => setDialog(null)}>Cancel</button>
            <button
              type="button"
              className={PRIMARY}
              disabled={busy || !status || (["ON_HOLD", "CANCELLED"].includes(status) && !statusRemarks.trim())}
              onClick={() => run(() => setProcurementStatusApi(ws.id, status, statusRemarks.trim() || undefined))}
            >
              Update Status
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={dialog === "collection"} onClose={() => !busy && setDialog(null)} title="Request quotations" size="xl">
        <div className="space-y-4">
          <p className="text-[13px] text-[#555555] dark:text-slate-300">
            Choose which vendors you are asking to quote for each line - as many as you like per line. This records it; you
            contact the vendors yourself. Nothing is sent from here.
          </p>
          {vendors.length === 0 ? (
            <p className="text-[12px] text-[#999999]">No approved or active vendors. Add and approve one under Vendors first.</p>
          ) : (
            <ol className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {(ws.items || []).map((item) => {
                const chosen = asking[item.id ?? -1] || [];
                const onPo = item.id != null && ws.ordered_item_ids.includes(item.id);
                return (
                  <li key={item.id} className="rounded-lg border border-[#ececec] p-3 dark:border-[#17304a]">
                    <fieldset disabled={onPo}>
                      <legend className="flex w-full flex-wrap items-baseline justify-between gap-2 text-[13px]">
                        <span className="font-medium text-[#141414] dark:text-white">
                          {item.line_no}. {item.product_name}
                          <span className="ml-1.5 font-normal text-[#777777]">
                            {item.effective_quantity ?? item.quantity} {item.uom}
                          </span>
                        </span>
                        <span className="text-[11px] text-[#777777]">
                          {onPo ? "Already on a PO" : `${chosen.length} vendor${chosen.length === 1 ? "" : "s"}`}
                        </span>
                      </legend>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {vendors.map((v) => {
                          const on = chosen.includes(v.id);
                          return (
                            <label
                              key={v.id}
                              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition focus-within:ring-2 focus-within:ring-[#233353]/40 ${
                                on
                                  ? "border-[#233353] bg-[#233353] text-white"
                                  : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
                              } ${onPo ? "cursor-not-allowed opacity-50" : ""}`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={on}
                                onChange={(e) => item.id != null && toggleVendor(item.id, v.id, e.target.checked)}
                              />
                              {v.name}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </li>
                );
              })}
            </ol>
          )}
          <div>
            <label className={LABEL} htmlFor="collection-notes">Notes</label>
            <textarea id="collection-notes" rows={2} className={INPUT} value={collectionNotes} onChange={(e) => setCollectionNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={OUTLINE} onClick={() => setDialog(null)}>Cancel</button>
            <button
              type="button"
              className={PRIMARY}
              disabled={
                busy ||
                /* Only a vendor not already asked makes a new request. */
                !(ws.items || []).some((item) =>
                  (asking[item.id ?? -1] || []).some((v) => !(item.rfq_vendor_ids || []).includes(v)),
                )
              }
              onClick={() => run(() => requestQuotationsApi(ws.id, asking, collectionNotes.trim() || undefined))}
            >
              Save Request
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={typeof dialog === "object" && dialog !== null}
        onClose={() => !busy && setDialog(null)}
        title="Change quantity for procurement"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-[#555555] dark:text-slate-300">
            The requester&apos;s quantity stays on record; this sets the quantity procurement will buy.
          </p>
          <div>
            <label className={LABEL} htmlFor="qty-new">Quantity *</label>
            <input id="qty-new" type="number" min="0" step="any" className={INPUT} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="qty-reason">Reason *</label>
            <textarea id="qty-reason" rows={3} className={INPUT} value={quantityReason} onChange={(e) => setQuantityReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={OUTLINE} onClick={() => setDialog(null)}>Cancel</button>
            <button
              type="button"
              className={PRIMARY}
              disabled={busy || quantity === "" || Number(quantity) <= 0 || !quantityReason.trim()}
              onClick={() =>
                typeof dialog === "object" && dialog &&
                run(() => changeQuantityApi(ws.id, dialog.quantity, Number(quantity), quantityReason.trim()))
              }
            >
              Save Quantity
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
