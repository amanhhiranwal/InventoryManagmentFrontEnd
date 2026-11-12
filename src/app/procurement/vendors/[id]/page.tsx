"use client";

/**
 * One vendor: details, documents, the approval workflow (submit, verify
 * documents, approve, activate, hold, block, deactivate), performance from
 * its quotations and POs, and its history. Edit needs vendor.manage; the
 * workflow actions need vendor.approve except Submit. The server checks
 * each one again.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiEdit2 } from "react-icons/fi";

import Modal from "@/components/ui/Modal";
import { AttachmentList } from "@/features/attachments/AttachmentList";
import { hasPermission } from "@/features/auth/utils/permissions";
import { errorDetail, getVendorApi, vendorActionApi, type Vendor } from "@/features/procurement/api/procurement.api";
import VendorForm from "@/features/procurement/components/VendorForm";
import {
  ErrorState,
  Field,
  Loading,
  Panel,
  ProcStatus,
  RemarksPrompt,
  day,
  money,
  when,
} from "@/features/procurement/components/shared";
import DataList from "@/features/procurement/components/DataList";
import { DetailHeader } from "@/features/procurement/components/DetailParts";
import { ActivityHistory } from "@/features/procurement/components/ApprovalAndActivity";
import { useUIStore } from "@/lib/store/ui.store";

const BUTTON = "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition disabled:opacity-50";

/** Which moves make sense from each status. The server enforces its own rules. */
const MOVES: Record<string, string[]> = {
  DRAFT: ["SUBMIT", "VERIFY"],
  PENDING_VERIFICATION: ["VERIFY", "APPROVE", "HOLD", "BLOCK"],
  APPROVED: ["ACTIVATE", "HOLD", "BLOCK", "DEACTIVATE"],
  ACTIVE: ["HOLD", "BLOCK", "DEACTIVATE"],
  ON_HOLD: ["ACTIVATE", "BLOCK", "DEACTIVATE"],
  BLOCKED: ["ACTIVATE", "DEACTIVATE"],
  INACTIVE: ["ACTIVATE"],
};

const ACTION: Record<string, { label: string; needs: "manage" | "approve"; required?: boolean; danger?: boolean }> = {
  SUBMIT: { label: "Submit for Verification", needs: "manage" },
  VERIFY: { label: "Mark Documents Verified", needs: "approve" },
  APPROVE: { label: "Approve", needs: "approve" },
  ACTIVATE: { label: "Activate", needs: "approve" },
  HOLD: { label: "Put on Hold", needs: "approve", required: true, danger: true },
  BLOCK: { label: "Block", needs: "approve", required: true, danger: true },
  DEACTIVATE: { label: "Deactivate", needs: "approve", required: true, danger: true },
};

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useUIStore();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setVendor(await getVendorApi(id));
    } catch (failure) {
      setError(errorDetail(failure, "Could not load this vendor."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (remarks: string) => {
    if (!vendor || !action) return;
    setBusy(true);
    try {
      await vendorActionApi(vendor.id, action, remarks || undefined);
      addToast(`${ACTION[action].label}: done.`, "success");
      setAction(null);
      await load();
    } catch {
      /* reported by the API client */
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!vendor) return <Loading text="Loading vendor..." />;
  if (editing) return <VendorForm existing={vendor} />;

  const moves = (MOVES[vendor.status] || []).filter(
    (a) => hasPermission(`vendor.${ACTION[a].needs}`) && !(a === "VERIFY" && vendor.documents_verified),
  );
  const docs = vendor.documents || {};
  const perf = vendor.performance;

  return (
    <div className="space-y-5 pb-8">
      <DetailHeader
        back={{ href: "/procurement/vendors", label: "Vendors" }}
        title={vendor.name}
        status={
          <>
            <ProcStatus status={vendor.status} />
            <span className="text-[12px] text-[#777777]">{vendor.vendor_code}</span>
          </>
        }
        subtitle={[vendor.vendor_type, vendor.city].filter(Boolean).join(", ") || undefined}
        actions={
          <>
            {hasPermission("vendor.manage") && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={`${BUTTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200`}
              >
                <FiEdit2 size={13} /> Edit
              </button>
            )}
            {moves.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`${BUTTON} ${ACTION[a].danger ? "border border-[#f7969e] bg-white text-[#d00517] hover:bg-rose-50 dark:bg-transparent" : "bg-[#243454] text-white hover:bg-[#18243a]"}`}
              >
                {ACTION[a].label}
              </button>
            ))}
          </>
        }
        facts={[
          { label: "Documents", value: vendor.documents_verified ? "Verified" : "Not verified" },
          { label: "Can quote and be ordered from", value: vendor.usable ? "Yes" : "No" },
          { label: "Purchase orders", value: perf ? `${perf.purchase_orders}, ${money(perf.po_value)}` : "—" },
          { label: "Win rate", value: perf?.win_rate != null ? `${perf.win_rate}% of ${perf.quotations} quotes` : "No quotes yet" },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Vendor">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Type">{vendor.vendor_type}</Field>
              <Field label="Contact Person">{vendor.contact_person}{vendor.designation ? ` (${vendor.designation})` : ""}</Field>
              <Field label="Mobile">{vendor.mobile}</Field>
              <Field label="Email">{vendor.email}</Field>
              <div className="sm:col-span-2">
                <Field label="Address">{[vendor.address, vendor.city, vendor.state, vendor.pin_code].filter(Boolean).join(", ")}</Field>
              </div>
              <Field label="GSTIN">{vendor.gstin}</Field>
              <Field label="PAN">{vendor.pan}</Field>
              <Field label="Bank">{[vendor.bank_name, vendor.branch].filter(Boolean).join(", ")}</Field>
              <Field label="Account">{vendor.account_holder}{vendor.account_number ? ` · ${vendor.account_number}` : ""}</Field>
              <Field label="IFSC">{vendor.ifsc}</Field>
              <Field label="Payment Terms">{vendor.payment_terms}{vendor.credit_days != null ? ` · ${vendor.credit_days} days credit` : ""}</Field>
              <Field label="Lead Time">{vendor.lead_time_days != null ? `${vendor.lead_time_days} days` : null}</Field>
              <Field label="Freight Terms">{vendor.freight_terms}</Field>
              <Field label="Warranty">{vendor.warranty_terms}</Field>
              <Field label="Categories">{vendor.product_categories.join(", ")}</Field>
              <Field label="Brands">{vendor.brands.join(", ")}</Field>
              {vendor.remarks && <div className="sm:col-span-2 lg:col-span-4"><Field label="Remarks">{vendor.remarks}</Field></div>}
            </div>
          </Panel>

          <Panel title="Performance">
            {perf ? (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                  <Field label="Quotations">{perf.quotations}</Field>
                  <Field label="Selected">{perf.selected}</Field>
                  <Field label="Win Rate">{perf.win_rate != null ? `${perf.win_rate}%` : "No data"}</Field>
                  <Field label="Purchase Orders">{perf.purchase_orders}</Field>
                  <Field label="PO Value">{money(perf.po_value)}</Field>
                </div>
                {perf.note && <p className="mt-3 text-[11px] text-[#999999]">{perf.note}</p>}
              </>
            ) : (
              <p className="text-[12px] text-[#999999]">No performance data.</p>
            )}
          </Panel>

          <Panel title={`Purchase Orders (${vendor.purchase_orders?.length || 0})`}>
            {vendor.purchase_orders?.length ? (
              <DataList
                dense
                rows={vendor.purchase_orders}
                rowKey={(po) => po.id}
                rowHref={(po) => `/procurement/purchase-orders/${po.id}`}
                columns={[
                  {
                    header: "Purchase Order",
                    primary: true,
                    cell: (po) => (
                      <Link href={`/procurement/purchase-orders/${po.id}`} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
                        {po.po_number}
                      </Link>
                    ),
                  },
                  { header: "Date", nowrap: true, cell: (po) => day(po.po_date) },
                  { header: "Requisition", cell: (po) => po.pr_number || "—" },
                  { header: "Total", align: "right", nowrap: true, cell: (po) => money(po.grand_total, po.currency) },
                  { header: "Status", primary: true, cell: (po) => <ProcStatus status={po.status} /> },
                ]}
              />
            ) : (
              <p className="text-[12px] text-[#999999]">No purchase orders yet.</p>
            )}
          </Panel>

          <Panel title={`Quotations (${vendor.quotations?.length || 0})`}>
            {vendor.quotations?.length ? (
              <ul className="space-y-2">
                {vendor.quotations.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <Link href={`/procurement/desk/quotations/${q.id}`} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">{q.quotation_number}</Link>
                    <span className="text-[#777777]">{q.pr_number} · {q.version_label}</span>
                    <span>{money(q.grand_total, q.currency)}</span>
                    <ProcStatus status={q.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#999999]">No quotations yet.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Verification">
            <div className="space-y-3">
              <Field label="Documents">
                {vendor.documents_verified ? <span className="font-semibold text-emerald-600">Verified · {when(vendor.verified_at)}</span> : "Not verified"}
              </Field>
              <Field label="Approved">{when(vendor.approved_at)}</Field>
              <Field label="Usable for quotations and POs">{vendor.usable ? "Yes" : "No — approve or activate first"}</Field>
            </div>
          </Panel>
          <Panel title="Documents">
            <div className="space-y-3">
              {([["gst", "GST Certificate"], ["pan", "PAN Card"], ["bank", "Bank Proof"], ["msme", "MSME Certificate"]] as const).map(([key, label]) => (
                <div key={key}>
                  <p className="mb-1 text-[11px] text-[#777777]">{label}</p>
                  <AttachmentList files={[docs[key]].filter((f): f is NonNullable<typeof f> => Boolean(f))} empty="Not uploaded." />
                </div>
              ))}
              {(docs.other || []).length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] text-[#777777]">Other</p>
                  <AttachmentList files={docs.other || []} />
                </div>
              )}
            </div>
          </Panel>
          <ActivityHistory rows={vendor.activity} />
        </div>
      </div>

      <Modal isOpen={action !== null} onClose={() => !busy && setAction(null)} title={action ? `${ACTION[action].label} — ${vendor.name}` : ""}>
        {action && (
          <RemarksPrompt
            title={ACTION[action].label}
            required={ACTION[action].required}
            danger={ACTION[action].danger}
            confirmLabel={ACTION[action].label}
            busy={busy}
            onCancel={() => setAction(null)}
            onConfirm={act}
          />
        )}
      </Modal>
    </div>
  );
}
