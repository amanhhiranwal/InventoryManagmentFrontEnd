"use client";

/**
 * One vendor quotation as entered from the vendor's offline document:
 * its terms, priced lines, the attached original, every version and the
 * history. Procurement can revise it (a new version; the old one stays)
 * or move it through the hand-set statuses.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiEdit2 } from "react-icons/fi";

import Modal from "@/components/ui/Modal";
import { AttachmentList } from "@/features/attachments/AttachmentList";
import {
  errorDetail,
  getProcurementMetaApi,
  getQuotationApi,
  setQuotationStatusApi,
  type ProcurementMeta,
  type Quotation,
} from "@/features/procurement/api/procurement.api";
import {
  ErrorState,
  Field,
  INPUT,
  LABEL,
  Loading,
  Panel,
  ProcStatus,
  day,
  humanize,
  money,
} from "@/features/procurement/components/shared";
import DataList, { Totals } from "@/features/procurement/components/DataList";
import { DetailHeader } from "@/features/procurement/components/DetailParts";
import { ActivityHistory } from "@/features/procurement/components/ApprovalAndActivity";
import { useUIStore } from "@/lib/store/ui.store";

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";
const BUTTON = "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition disabled:opacity-50";

export default function QuotationDetailPage() {
  const { qid } = useParams<{ qid: string }>();
  const { addToast } = useUIStore();
  const [q, setQ] = useState<Quotation | null>(null);
  const [meta, setMeta] = useState<ProcurementMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setQ(await getQuotationApi(qid));
    } catch (failure) {
      setError(errorDetail(failure, "Could not load this quotation."));
    }
  }, [qid]);

  useEffect(() => {
    load();
    getProcurementMetaApi().then(setMeta).catch(() => {});
  }, [load]);

  const changeStatus = async () => {
    if (!q) return;
    setBusy(true);
    try {
      setQ((await setQuotationStatusApi(q.id, status, remarks.trim() || undefined)).data);
      addToast("Quotation status updated.", "success");
      setOpen(false);
    } catch {
      /* reported by the API client */
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!q) return <Loading text="Loading quotation..." />;

  const manage = Boolean(meta?.permissions?.["procurement.manage"]);
  const editable = manage && q.is_latest && q.status !== "SELECTED";

  return (
    <div className="space-y-5 pb-8">
      <DetailHeader
        back={{ href: `/procurement/desk/${q.requisition_id}`, label: q.pr_number || "Requisition" }}
        title={`${q.vendor_name}: ${q.quotation_number}`}
        status={
          <>
            <ProcStatus status={q.expired ? "EXPIRED" : q.status} />
            <span className="text-[12px] text-[#777777]">{q.version_label}</span>
          </>
        }
        actions={
          editable ? (
            <>
              <button
                type="button"
                onClick={() => { setStatus(""); setRemarks(""); setOpen(true); }}
                className={`${BUTTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200`}
              >
                Change Status
              </button>
              <Link href={`/procurement/desk/quotations/${q.id}/revise`} className={`${BUTTON} bg-[#243454] text-white hover:bg-[#18243a]`}>
                <FiEdit2 size={13} /> Revise
              </Link>
            </>
          ) : undefined
        }
        facts={[
          { label: "Grand total", value: money(q.grand_total, q.currency) },
          { label: "Delivery", value: q.delivery_days != null ? `${q.delivery_days} days` : "Not stated" },
          { label: "Valid until", value: day(q.valid_until) },
          { label: "Payment terms", value: q.payment_terms || "Not stated" },
        ]}
      />

      {!q.is_latest && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          This is an earlier version, kept for the record. The latest is listed under Versions.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Terms">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Vendor">{q.vendor_name}</Field>
              <Field label="Vendor Quotation No.">{q.vendor_reference}</Field>
              <Field label="Quotation Date">{day(q.quotation_date)}</Field>
              <Field label="Valid Until">{day(q.valid_until)}</Field>
              <Field label="Received On">{day(q.received_date)}</Field>
              <Field label="Entered By">{q.entered_by_name}</Field>
              <Field label="Delivery">{q.delivery_days != null ? `${q.delivery_days} days` : null}</Field>
              <Field label="Currency">{q.currency}</Field>
              <Field label="Payment Terms">{q.payment_terms}</Field>
              <Field label="Delivery Terms">{q.delivery_terms}</Field>
              <Field label="Freight Terms">{q.freight_terms}</Field>
              <Field label="Warranty">{q.warranty_terms}</Field>
              {q.remarks && <div className="sm:col-span-2 lg:col-span-4"><Field label="Remarks">{q.remarks}</Field></div>}
            </div>
          </Panel>

          <Panel title={`Lines (${q.items?.length || 0})`}>
            <DataList
              dense
              rows={q.items || []}
              rowKey={(i) => i.id ?? String(i.requisition_item_id)}
              columns={[
                {
                  header: "Item",
                  primary: true,
                  width: "w-[30%]",
                  cell: (i) => (
                    <>
                      <span className="font-medium">{i.product_name}</span>
                      {[i.vendor_product_name, i.vendor_model, i.brand, i.hsn && `HSN ${i.hsn}`].some(Boolean) && (
                        <span className={SUB}>{[i.vendor_product_name, i.vendor_model, i.brand, i.hsn && `HSN ${i.hsn}`].filter(Boolean).join(", ")}</span>
                      )}
                      {i.compliance !== "COMPLIANT" && (
                        <span className="mt-0.5 block text-[11px] text-amber-700">
                          {humanize(i.compliance)}{i.deviation ? `: ${i.deviation}` : ""}
                        </span>
                      )}
                    </>
                  ),
                },
                { header: "Qty", nowrap: true, cell: (i) => `${i.quantity} ${i.uom || ""}` },
                {
                  header: "Rate",
                  align: "right",
                  nowrap: true,
                  cell: (i) => (
                    <>
                      {money(Number(i.unit_rate))}
                      {Number(i.discount_amount) > 0 && <span className={SUB}>less {money(i.discount_amount)}</span>}
                    </>
                  ),
                },
                { header: "GST", align: "right", nowrap: true, cell: (i) => <>{money(i.gst_amount)}<span className={SUB}>{i.gst_rate}%</span></> },
                { header: "Charges", align: "right", nowrap: true, cell: (i) => money(Number(i.freight) + Number(i.packing) + Number(i.other_charges)) },
                { header: "Total", align: "right", nowrap: true, primary: true, cell: (i) => <span className="font-medium">{money(i.total)}</span> },
              ]}
              footer={
                <Totals
                  rows={[
                    { label: "Taxable", value: money(q.taxable_total) },
                    { label: "GST", value: money(q.gst_total) },
                    { label: "Charges", value: money(q.charges_total) },
                    { label: "Grand total", value: money(q.grand_total, q.currency), strong: true },
                  ]}
                />
              }
            />
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Vendor Document">
            <AttachmentList files={q.attachments || []} empty="No document attached (draft)." />
          </Panel>
          <Panel title={`Versions (${q.versions?.length || 1})`}>
            <ul className="space-y-2">
              {(q.versions || [q]).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 text-[13px]">
                  {v.id === q.id ? (
                    <span className="font-semibold">{v.version_label}</span>
                  ) : (
                    <Link href={`/procurement/desk/quotations/${v.id}`} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
                      {v.version_label}
                    </Link>
                  )}
                  <span>{money(v.grand_total, v.currency)}</span>
                  <ProcStatus status={v.status} />
                </li>
              ))}
            </ul>
          </Panel>
          <ActivityHistory rows={q.activity} />
        </div>
      </div>

      <Modal isOpen={open} onClose={() => !busy && setOpen(false)} title="Change quotation status">
        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="q-status">Status *</label>
            <select id="q-status" className={INPUT} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Select</option>
              {(meta?.manual_quotation_statuses || []).map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="q-status-remarks">Remarks{status === "REJECTED" ? " *" : ""}</label>
            <textarea id="q-status-remarks" rows={3} className={INPUT} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] dark:border-[#17304a]">Cancel</button>
            <button
              type="button"
              disabled={busy || !status || (status === "REJECTED" && !remarks.trim())}
              onClick={changeStatus}
              className="rounded-lg bg-[#243454] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Update
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
