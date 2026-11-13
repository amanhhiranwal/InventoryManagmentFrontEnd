"use client";

/**
 * One purchase order: the vendor, lines and terms copied from the chosen
 * quotation, its approval by amount, the payment terms and the schedule of
 * instalments, the status workflow and the PDF.
 *
 * A draft's addresses, delivery date, payment terms and remarks can be
 * edited; the lines and prices cannot - they are the quotation's. The
 * approver whose turn it is approves or rejects here (a rejection sends it
 * back to draft). Each instalment's cheque or transfer details are kept
 * here and marked paid once the PO is approved. Every action is checked
 * again on the server.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiDownload, FiEdit2, FiX } from "react-icons/fi";

import Modal from "@/components/ui/Modal";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  decidePurchaseOrderApi,
  downloadPurchaseOrderPdfApi,
  errorDetail,
  getProcurementMetaApi,
  getPurchaseOrderApi,
  logPurchaseOrderActivityApi,
  paymentActionApi,
  purchaseOrderActionApi,
  updatePaymentApi,
  updatePurchaseOrderApi,
  type PaymentAction,
  type PaymentInstalment,
  type ProcurementMeta,
  type PurchaseOrder,
} from "@/features/procurement/api/procurement.api";
import { ActivityHistory, ApprovalBanner } from "@/features/procurement/components/ApprovalAndActivity";
import DataList, { Totals } from "@/features/procurement/components/DataList";
import { DetailHeader } from "@/features/procurement/components/DetailParts";
import PaymentTermsFields, {
  EMPTY_TERMS,
  termsPayload,
  termsProblem,
  type TermsValue,
} from "@/features/procurement/components/PaymentTerms";
import {
  ErrorState,
  Field,
  INPUT,
  LABEL,
  Loading,
  Panel,
  PaymentStatusPill,
  ProcStatus,
  RemarksPrompt,
  day,
  money,
  when,
} from "@/features/procurement/components/shared";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";
const BUTTON = "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition disabled:opacity-50";
const OUTLINE = `${BUTTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200`;
const LINK = "font-semibold text-[#233353] hover:underline dark:text-sky-300";

const ACTION: Record<string, { label: string; required?: boolean; danger?: boolean; tone: string }> = {
  SUBMIT: { label: "Submit for Approval", tone: "bg-[#243454] hover:bg-[#18243a]" },
  SEND: { label: "Mark as Sent", tone: "bg-[#243454] hover:bg-[#18243a]" },
  ACKNOWLEDGE: { label: "Mark Acknowledged", tone: "bg-[#243454] hover:bg-[#18243a]" },
  CLOSE: { label: "Close PO", tone: "bg-[#243454] hover:bg-[#18243a]" },
  CANCEL: { label: "Cancel PO", required: true, danger: true, tone: "bg-rose-600 hover:bg-rose-700" },
};

const MODE_LABEL: Record<string, string> = { BANK_TRANSFER: "Bank transfer", PDC: "Post-dated cheque" };

/** Approval has happened: instalments may be marked paid. */
const PAYABLE = ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED"];

type PaymentDraft = {
  mode: string;
  bank_name: string;
  cheque_number: string;
  cheque_date: string;
  due_date: string;
  reference: string;
  remarks: string;
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useUIStore();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [meta, setMeta] = useState<ProcurementMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<"APPROVE" | "REJECT" | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ bill_to: "", ship_to: "", expected_delivery: "", terms: "", remarks: "" });
  const [terms, setTerms] = useState<TermsValue>(EMPTY_TERMS);
  const [instalment, setInstalment] = useState<PaymentInstalment | null>(null);
  const [payment, setPayment] = useState<PaymentDraft | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  const manage = hasPermission("purchase_order.manage");
  /* Procurement fill in and submit each instalment; accounts approve it
     (or return it) and mark it paid. The server decides; these only pick
     which buttons to show. */
  const canPay = po?.can_approve_payments ?? hasPermission("purchase_order.pay");
  const canSubmit = po?.can_submit_payments ?? manage;
  const canSeeList = hasPermission("purchase_order.read") || hasPermission("purchase_order.pay");

  const load = useCallback(async () => {
    setError(null);
    try {
      setPo(await getPurchaseOrderApi(id));
    } catch (failure) {
      setError(errorDetail(failure, "Could not load this purchase order."));
    }
  }, [id]);

  useEffect(() => {
    load();
    /* The payment term labels; the fields fall back to their own list for
       an approver who cannot read the procurement meta. */
    if (hasPermission("procurement.read")) getProcurementMetaApi().then(setMeta).catch(() => {});
  }, [load]);

  /** Run a call that answers with the PO, and take it. */
  const run = async (call: () => Promise<{ data: PurchaseOrder; message?: string }>, fallback: string) => {
    setBusy(true);
    try {
      const answer = await call();
      setPo(answer.data);
      addToast(answer.message || fallback, "success");
      return true;
    } catch {
      return false; // the API client shows the server's reason
    } finally {
      setBusy(false);
    }
  };

  const act = async (remarks: string) => {
    if (!po || !action) return;
    if (await run(() => purchaseOrderActionApi(po.id, action, remarks || undefined), "Purchase order updated.")) setAction(null);
  };

  const decide = async (remarks: string) => {
    if (!po || !deciding) return;
    if (await run(() => decidePurchaseOrderApi(po.id, deciding, remarks || undefined), "Decision recorded.")) setDeciding(null);
  };

  const startEdit = () => {
    if (!po) return;
    setDraft({
      bill_to: po.bill_to || "",
      ship_to: po.ship_to || "",
      expected_delivery: toDateInput(po.expected_delivery) || "",
      terms: (po.terms || []).join("\n"),
      remarks: po.remarks || "",
    });
    setTerms({
      payment_term_type: po.payment_term_type || "",
      advance_percent: po.advance_percent != null ? String(po.advance_percent) : "50",
      credit_days: po.credit_days != null ? String(po.credit_days) : "",
      payment_mode: po.payment_mode || "BANK_TRANSFER",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!po) return;
    if (terms.payment_term_type) {
      const problem = termsProblem(terms);
      if (problem) return addToast(problem, "error");
    }
    const saved = await run(
      () =>
        updatePurchaseOrderApi(po.id, {
          ...draft,
          expected_delivery: draft.expected_delivery || null,
          terms: draft.terms.split("\n").map((t) => t.trim()).filter(Boolean),
          ...termsPayload(terms),
        }),
      "Purchase order saved.",
    );
    if (saved) setEditing(false);
  };

  const openPayment = (row: PaymentInstalment) => {
    setInstalment(row);
    setReturnReason("");
    setPayment({
      mode: row.mode || po?.payment_mode || "BANK_TRANSFER",
      bank_name: row.bank_name || "",
      cheque_number: row.cheque_number || "",
      cheque_date: toDateInput(row.cheque_date) || "",
      due_date: toDateInput(row.due_date) || "",
      reference: row.reference || "",
      remarks: row.remarks || "",
    });
  };

  const closePayment = () => {
    setInstalment(null);
    setPayment(null);
  };

  /** Procurement: save the details, and with ``submit`` send them to accounts. */
  const savePayment = async (submit = false) => {
    if (!po || !instalment || !payment) return;
    const body: Record<string, unknown> = {
      ...payment,
      cheque_date: payment.cheque_date || null,
      due_date: payment.due_date || null,
    };
    const saved = await run(() => updatePaymentApi(po.id, instalment.id, body), "Payment details saved.");
    if (!saved) return;
    if (!submit) return closePayment();
    if (await run(() => paymentActionApi(po.id, instalment.id, "SUBMIT"), "Submitted to accounts.")) closePayment();
  };

  /** Accounts: approve, return with a reason, or mark paid. */
  const accountsStep = async (step: PaymentAction) => {
    if (!po || !instalment) return;
    if (step === "REJECT" && !returnReason.trim()) return addToast("Say why it is being returned.", "error");
    const done = await run(
      () => paymentActionApi(po.id, instalment.id, step, step === "REJECT" ? returnReason.trim() : undefined),
      "Payment updated.",
    );
    if (done) closePayment();
  };

  const pdf = async () => {
    if (!po) return;
    setPrinting(true);
    try {
      await downloadPurchaseOrderPdfApi(po.id, po.po_number);
    } catch {
      /* reported by the API client */
    } finally {
      setPrinting(false);
    }
  };

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!po) return <Loading text="Loading purchase order..." />;

  const payments = po.payments || [];
  const paidTotal = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const payable = PAYABLE.includes(po.status);
  const actions = manage ? po.next_actions : [];

  return (
    <div className="space-y-5 pb-8">
      <DetailHeader
        back={canSeeList ? { href: "/procurement/purchase-orders", label: "Purchase Orders" } : { href: "/procurement/requisitions", label: "My Requisitions" }}
        title={po.po_number}
        status={<ProcStatus status={po.status} />}
        subtitle={`To ${po.vendor_name}${po.requester_name ? `, for ${po.requester_name}'s ${po.pr_number}` : ""}`}
        actions={
          <>
            <button type="button" onClick={pdf} disabled={printing} className={OUTLINE}>
              <FiDownload size={13} /> {printing ? "Preparing..." : "Download PDF"}
            </button>
            {manage && po.status === "DRAFT" && (
              <button type="button" onClick={startEdit} className={OUTLINE}>
                <FiEdit2 size={13} /> Edit
              </button>
            )}
            {actions.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() =>
                  a === "SUBMIT" && !po.payment_term_type ? addToast("Set the payment terms first: Edit, then Payment.", "error") : setAction(a)
                }
                className={`${BUTTON} text-white ${ACTION[a]?.tone || "bg-[#243454]"}`}
              >
                {ACTION[a]?.label || a}
              </button>
            ))}
          </>
        }
        facts={[
          { label: "Grand total", value: money(po.grand_total, po.currency) },
          { label: "Payment terms", value: po.payment_terms || "Not set yet" },
          { label: "Expected delivery", value: day(po.expected_delivery) },
          { label: "Paid so far", value: payments.length ? `${money(paidTotal)} of ${money(po.grand_total)}` : "—" },
          { label: po.waiting_on ? "Waiting on" : "PO date", value: po.waiting_on ? `${po.waiting_on.step_label}: ${po.waiting_on.approver_label}` : day(po.po_date) },
        ]}
      />

      {/* A cancelled PO has no approval to show: its status and history say so. */}
      {(po.approvals?.length ?? 0) > 0 && po.status !== "CANCELLED" && (
        <ApprovalBanner
          state={po.status === "PENDING_APPROVAL" ? "PENDING" : po.approved_at ? "APPROVED" : "REJECTED"}
          steps={po.approvals || []}
          requestedBy={po.created_by_name}
          requestedAt={po.submitted_at}
          reason={
            po.status === "PENDING_APPROVAL"
              ? `${money(po.grand_total, po.currency)} to ${po.vendor_name}: by amount it goes to ${(po.approvals || [])
                  .filter((s) => s.round === Math.max(...(po.approvals || []).map((x) => x.round)))
                  .map((s) => s.step_label)
                  .join(", then ")}. A rejection needs remarks and returns it to the purchase team as a draft.`
              : po.approved_at
                ? "Approved. It goes to accounts, who record the payments as they fall due."
                : "Rejected and returned to the purchase team as a draft."
          }
          actions={
            po.can_decide ? (
              <>
                <button type="button" onClick={() => setDeciding("REJECT")} className={`${BUTTON} border border-rose-300 bg-white text-rose-600 hover:bg-rose-50 dark:bg-transparent`}>
                  <FiX size={13} /> Reject
                </button>
                <button type="button" onClick={() => setDeciding("APPROVE")} className={`${BUTTON} bg-[#273756] text-white hover:bg-[#18243a]`}>
                  <FiCheck size={13} /> Approve PO
                </button>
              </>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title={`Lines (${po.items?.length || 0})`}>
            <DataList
              dense
              rows={po.items || []}
              rowKey={(i) => i.id}
              columns={[
                {
                  header: "Item",
                  primary: true,
                  width: "w-[32%]",
                  cell: (i) => (
                    <>
                      <span className="font-medium">{i.product_name}</span>
                      {(i.sku || i.hsn) && <span className={SUB}>{[i.sku, i.hsn && `HSN ${i.hsn}`].filter(Boolean).join(", ")}</span>}
                    </>
                  ),
                },
                { header: "Qty", nowrap: true, cell: (i) => `${i.quantity} ${i.uom || ""}` },
                { header: "Rate", align: "right", nowrap: true, cell: (i) => money(i.unit_rate) },
                { header: "GST", align: "right", nowrap: true, cell: (i) => <>{money(i.gst_amount)}<span className={SUB}>{i.gst_rate}%</span></> },
                { header: "Charges", align: "right", nowrap: true, cell: (i) => money(i.freight + i.other_charges) },
                { header: "Total", align: "right", nowrap: true, primary: true, cell: (i) => <span className="font-medium">{money(i.total)}</span> },
              ]}
              footer={
                <Totals
                  rows={[
                    { label: "Taxable", value: money(po.taxable_total) },
                    { label: "GST", value: money(po.gst_total) },
                    { label: "Charges", value: money(po.charges_total) },
                    { label: "Grand total", value: money(po.grand_total, po.currency), strong: true },
                  ]}
                />
              }
            />
          </Panel>

          <Panel
            title="Payment Schedule"
            action={
              payments.length ? (
                <span className="text-[12px] text-[#777777]">
                  {money(paidTotal)} paid of {money(po.grand_total)}
                </span>
              ) : undefined
            }
          >
            {payments.length === 0 ? (
              <p className="text-[13px] text-[#777777]">
                No payment terms yet.{manage && po.status === "DRAFT" ? " Use Edit to set them; the instalments are laid out from them." : ""}
              </p>
            ) : (
              <>
                <DataList
                  dense
                  rows={payments}
                  rowKey={(p) => p.id}
                  columns={[
                    {
                      header: "Instalment",
                      primary: true,
                      cell: (p) => (
                        <>
                          <span className="font-medium">{p.label}</span>
                          <span className={SUB}>{p.percent}%</span>
                        </>
                      ),
                    },
                    {
                      header: "Due",
                      nowrap: true,
                      cell: (p) => (
                        <>
                          {day(p.due_date)}
                          {p.week != null && <span className={SUB}>Week {p.week}</span>}
                        </>
                      ),
                    },
                    {
                      header: "Paid by",
                      cell: (p) =>
                        p.mode === "PDC" ? (
                          <>
                            Cheque {p.cheque_number || "number not entered"}
                            <span className={SUB}>{[p.bank_name, p.cheque_date && day(p.cheque_date)].filter(Boolean).join(", ") || "Bank and date not entered"}</span>
                          </>
                        ) : (
                          <>
                            {MODE_LABEL[p.mode || ""] || "Not set"}
                            {(p.bank_name || p.reference) && <span className={SUB}>{[p.bank_name, p.reference].filter(Boolean).join(", ")}</span>}
                          </>
                        ),
                    },
                    { header: "Amount", align: "right", nowrap: true, cell: (p) => <span className="font-medium">{money(p.amount)}</span> },
                    {
                      header: "Status",
                      primary: true,
                      cell: (p) => (
                        <>
                          <PaymentStatusPill status={p.status} />
                          {p.status === "PAID" && p.paid_by_name ? (
                            <span className={SUB}>{p.paid_by_name}, {day(p.paid_at)}</span>
                          ) : p.status === "APPROVED" && p.approved_by_name ? (
                            <span className={SUB}>by {p.approved_by_name}</span>
                          ) : p.status === "SUBMITTED" && p.submitted_by_name ? (
                            <span className={SUB}>from {p.submitted_by_name}</span>
                          ) : p.status === "RETURNED" && p.returned_reason ? (
                            <span className={SUB}>{p.returned_reason}</span>
                          ) : null}
                        </>
                      ),
                    },
                    ...((canPay || canSubmit) && po.status !== "CANCELLED"
                      ? [
                          {
                            header: "",
                            align: "right" as const,
                            cell: (p: PaymentInstalment) => (
                              <button type="button" onClick={() => openPayment(p)} className="text-[12px] font-medium text-[#233353] hover:underline dark:text-sky-300">
                                Open
                              </button>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
                <p className="mt-3 text-[11px] text-[#999999]">
                  {payable
                    ? "Procurement enter each instalment's cheque or transfer and submit it; accounts approve it, then mark it paid."
                    : "Once the PO is approved, procurement submit each instalment to accounts for payment."}
                </p>
              </>
            )}
          </Panel>

          <Panel title="Vendor, Addresses and Terms">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Vendor">{po.vendor_name}</Field>
              <Field label="Vendor GSTIN">{po.vendor_gstin}</Field>
              <Field label="Vendor Quotation">{po.vendor_reference}</Field>
              <Field label="Quotation">
                {canSeeList ? (
                  <Link href={`/procurement/desk/quotations/${po.quotation_id}`} className={LINK}>{po.quotation_number}</Link>
                ) : (
                  po.quotation_number
                )}
                {po.quotation_version ? `, ${po.quotation_version}` : ""}
              </Field>
              <Field label="Requisition">
                <Link href={`/procurement/requisitions/${po.requisition_id}`} className={LINK}>{po.pr_number}</Link>
              </Field>
              <Field label="Sales Order">{po.sales_order_number}</Field>
              <Field label="Delivery Terms">{po.delivery_terms}</Field>
              <Field label="Warranty">{po.warranty_terms}</Field>
              <div className="sm:col-span-2"><Field label="Vendor Address">{po.vendor_address}</Field></div>
              <div className="sm:col-span-2 lg:col-span-1"><Field label="Bill To">{po.bill_to}</Field></div>
              <div className="sm:col-span-2 lg:col-span-1"><Field label="Ship To">{po.ship_to}</Field></div>
            </div>
            {po.terms?.length ? (
              <ol className="mt-4 list-decimal space-y-1 border-t border-[#f3f3f3] pl-5 pt-3 text-[13px] text-slate-700 dark:border-[#17304a] dark:text-slate-300">
                {po.terms.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            ) : null}
            {po.remarks && <p className="mt-3 text-[13px] text-slate-700 dark:text-slate-300"><span className="text-[#777777]">Remarks: </span>{po.remarks}</p>}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Workflow">
            <div className="space-y-3">
              <Field label="Created">{po.created_by_name ? `${po.created_by_name}, ${day(po.po_date)}` : day(po.po_date)}</Field>
              <Field label="Submitted">{when(po.submitted_at)}</Field>
              <Field label="Approved">{po.approved_by_name ? `${po.approved_by_name}, ${when(po.approved_at)}` : "—"}</Field>
              <Field label="Sent to Vendor">{when(po.sent_at)}</Field>
              <Field label="Acknowledged">{when(po.acknowledged_at)}</Field>
              <Field label="Closed">{when(po.closed_at)}</Field>
            </div>
            <p className="mt-3 text-[11px] text-[#999999]">
              Sending is recorded by hand; nothing is emailed to the vendor from here. Goods receipt is not part of this module.
            </p>
          </Panel>
          <ActivityHistory
            rows={po.activity}
            onLog={async (activity, remarks) => {
              try {
                const answer = await logPurchaseOrderActivityApi(po.id, activity, remarks);
                setPo(answer.data);
                addToast(answer.message || "Activity logged.", "success");
                return true;
              } catch {
                return false; // the API client shows the server's reason
              }
            }}
          />
        </div>
      </div>

      <Modal isOpen={action !== null} onClose={() => !busy && setAction(null)} title={action ? `${ACTION[action]?.label || action}: ${po.po_number}` : ""}>
        {action && (
          <RemarksPrompt
            title={ACTION[action]?.label || action}
            required={ACTION[action]?.required}
            danger={ACTION[action]?.danger}
            confirmLabel={ACTION[action]?.label || action}
            busy={busy}
            onCancel={() => setAction(null)}
            onConfirm={act}
          />
        )}
      </Modal>

      <Modal isOpen={deciding !== null} onClose={() => !busy && setDeciding(null)} title={deciding === "APPROVE" ? `Approve ${po.po_number}` : `Reject ${po.po_number}`}>
        {deciding && (
          <RemarksPrompt
            title="Decision"
            required={deciding === "REJECT"}
            danger={deciding === "REJECT"}
            confirmLabel={deciding === "APPROVE" ? "Approve" : "Reject"}
            busy={busy}
            onCancel={() => setDeciding(null)}
            onConfirm={decide}
          />
        )}
      </Modal>

      <Modal isOpen={editing} onClose={() => !busy && setEditing(false)} title={`Edit ${po.po_number}`} size="lg">
        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-[13px] font-medium text-[#474747] dark:text-white">Payment</h3>
            <PaymentTermsFields value={terms} onChange={setTerms} meta={meta} total={po.grand_total} idPrefix="edit-terms" />
          </section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="po-bill">Bill To</label>
              <textarea id="po-bill" rows={3} className={INPUT} value={draft.bill_to} onChange={(e) => setDraft((d) => ({ ...d, bill_to: e.target.value }))} />
            </div>
            <div>
              <label className={LABEL} htmlFor="po-ship">Ship To</label>
              <textarea id="po-ship" rows={3} className={INPUT} value={draft.ship_to} onChange={(e) => setDraft((d) => ({ ...d, ship_to: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="po-expected">Expected Delivery</label>
            <input id="po-expected" type="date" className={INPUT} value={draft.expected_delivery} onChange={(e) => setDraft((d) => ({ ...d, expected_delivery: e.target.value }))} />
            <p className="mt-1 text-[11px] text-[#999999]">Delivery and credit-day instalments fall due from this date.</p>
          </div>
          <div>
            <label className={LABEL} htmlFor="po-terms">Terms and conditions (one per line)</label>
            <textarea id="po-terms" rows={5} className={INPUT} value={draft.terms} onChange={(e) => setDraft((d) => ({ ...d, terms: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL} htmlFor="po-remarks">Remarks</label>
            <textarea id="po-remarks" rows={2} className={INPUT} value={draft.remarks} onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] dark:border-[#17304a]">Cancel</button>
            <button type="button" disabled={busy} onClick={saveEdit} className="rounded-lg bg-[#243454] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50">
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={instalment !== null && payment !== null}
        onClose={() => !busy && setInstalment(null)}
        title={instalment ? `${instalment.label}: ${money(instalment.amount)}` : ""}
      >
        {instalment && payment && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PaymentStatusPill status={instalment.status} />
              <span className="text-[11px] text-[#777777] dark:text-slate-400">
                {[
                  instalment.submitted_by_name && `Submitted by ${instalment.submitted_by_name}, ${when(instalment.submitted_at)}`,
                  instalment.approved_by_name && `Approved by ${instalment.approved_by_name}, ${when(instalment.approved_at)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            {instalment.status === "RETURNED" && instalment.returned_reason && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                Returned by {instalment.returned_by_name || "accounts"}: {instalment.returned_reason}
              </p>
            )}
            <fieldset
              disabled={!canSubmit || !["PENDING", "RETURNED"].includes(instalment.status)}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="pay-mode">Paid by</label>
                  <select id="pay-mode" className={INPUT} value={payment.mode} onChange={(e) => setPayment({ ...payment, mode: e.target.value })}>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="PDC">Post-dated cheque</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor="pay-due">Due date</label>
                  <input id="pay-due" type="date" className={INPUT} value={payment.due_date} onChange={(e) => setPayment({ ...payment, due_date: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="pay-bank">Bank{payment.mode === "PDC" ? " *" : ""}</label>
                  <input id="pay-bank" className={INPUT} value={payment.bank_name} onChange={(e) => setPayment({ ...payment, bank_name: e.target.value })} />
                </div>
                {payment.mode === "PDC" ? (
                  <>
                    <div>
                      <label className={LABEL} htmlFor="pay-cheque">Cheque number *</label>
                      <input id="pay-cheque" className={INPUT} value={payment.cheque_number} onChange={(e) => setPayment({ ...payment, cheque_number: e.target.value })} />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="pay-cheque-date">Cheque date *</label>
                      <input id="pay-cheque-date" type="date" className={INPUT} value={payment.cheque_date} onChange={(e) => setPayment({ ...payment, cheque_date: e.target.value })} />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className={LABEL} htmlFor="pay-ref">Transfer reference (UTR)</label>
                    <input id="pay-ref" className={INPUT} value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                  </div>
                )}
              </div>
              <div>
                <label className={LABEL} htmlFor="pay-remarks">Remarks</label>
                <input id="pay-remarks" className={INPUT} value={payment.remarks} onChange={(e) => setPayment({ ...payment, remarks: e.target.value })} />
              </div>
            </fieldset>
            {instalment.status === "PAID" && (
              <p className="text-[12px] text-[#555555] dark:text-slate-300">
                Paid, recorded by {instalment.paid_by_name || "—"} on {when(instalment.paid_at)}.
              </p>
            )}
            {canPay && instalment.status === "SUBMITTED" && (
              <div>
                <label className={LABEL} htmlFor="pay-return">Reason, if returning it to procurement</label>
                <input
                  id="pay-return"
                  className={INPUT}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Cheque date does not match the due date"
                />
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-[#f3f3f3] pt-3 dark:border-[#17304a]">
              <button type="button" onClick={closePayment} className="rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] dark:border-[#17304a]">Close</button>

              {/* Procurement: details, then submit to accounts. */}
              {canSubmit && ["PENDING", "RETURNED"].includes(instalment.status) && (
                <>
                  <button type="button" disabled={busy} onClick={() => savePayment()} className="rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] dark:border-[#17304a] disabled:opacity-50">
                    Save Details
                  </button>
                  <button
                    type="button"
                    disabled={busy || !payable}
                    title={payable ? undefined : "The PO must be approved first"}
                    onClick={() => savePayment(true)}
                    className="rounded-lg bg-[#243454] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#18243a] disabled:opacity-50"
                  >
                    Submit to Accounts
                  </button>
                </>
              )}

              {/* Accounts: approve or return what procurement submitted, then pay it. */}
              {canPay && instalment.status === "SUBMITTED" && (
                <>
                  <button
                    type="button"
                    disabled={busy || !returnReason.trim()}
                    title={returnReason.trim() ? undefined : "Enter the reason first"}
                    onClick={() => accountsStep("REJECT")}
                    className="rounded-lg border border-[#f7969e] px-3.5 py-2 text-[13px] text-[#d00517] disabled:opacity-50"
                  >
                    Return to Procurement
                  </button>
                  <button type="button" disabled={busy} onClick={() => accountsStep("APPROVE")} className="rounded-lg bg-[#243454] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#18243a] disabled:opacity-50">
                    Approve
                  </button>
                </>
              )}
              {canPay && instalment.status === "APPROVED" && (
                <button type="button" disabled={busy} onClick={() => accountsStep("MARK_PAID")} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  Mark Paid
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
